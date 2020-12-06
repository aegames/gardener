import { GuildMember } from 'discord.js';
import { Pool, QueryConfig, QueryResult, QueryResultRow } from 'pg';
import { Area, Game, GameVariableBase, Scene } from './game';
import { ResolvedVariable } from './gameLogic';
import logger from './logger';
import { ManagedGuild } from './managedGuild';

export const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  log: (...messages: any[]) => {
    messages.forEach((message) => logger.debug(`Connection pool: ${message}`));
  },
});

function query<R extends QueryResultRow = any, I extends any[] = any[]>(
  queryTextOrConfig: string | QueryConfig<I>,
  values?: I,
): Promise<QueryResult<R>> {
  logger.verbose(`SQL: ${queryTextOrConfig}\n${JSON.stringify(values)}`);
  return dbPool.query(queryTextOrConfig, values);
}

export function getQualifiedVariableId<VariableType extends GameVariableBase>(
  variable: ResolvedVariable<VariableType>,
) {
  return `${variable.qualifier}.${variable.variable.id}`;
}

export async function getQualifiedVariableValues(
  managedGuild: ManagedGuild,
  ...qualifiedIds: string[]
) {
  const result = await query(
    'SELECT variable_id, value FROM game_variables WHERE guild_id = $1 AND variable_id = ANY($2::text[])',
    [managedGuild.guild.id, qualifiedIds],
  );

  return qualifiedIds.map((qualifiedId) => {
    const row = result.rows.find((row) => row.variable_id === qualifiedId);
    return row?.value;
  });
}

export async function getQualifiedVariableValue(managedGuild: ManagedGuild, qualifiedId: string) {
  const values = await getQualifiedVariableValues(managedGuild, qualifiedId);
  return values[0];
}

export async function getGameVariableValues<VariableType extends GameVariableBase>(
  managedGuild: ManagedGuild,
  ...variables: ResolvedVariable<VariableType>[]
) {
  return await getQualifiedVariableValues(managedGuild, ...variables.map(getQualifiedVariableId));
}

export async function getGameVariableValue<VariableType extends GameVariableBase>(
  managedGuild: ManagedGuild,
  variable: ResolvedVariable<VariableType>,
) {
  const values = await getGameVariableValues(managedGuild, variable);
  return values[0];
}

export function setQualifiedVariableValue(
  managedGuild: ManagedGuild,
  qualifiedId: string,
  value: any,
) {
  const jsonValue = JSON.stringify(value);

  return query(
    `INSERT INTO game_variables (guild_id, variable_id, value)
    VALUES ($1, $2, $3)
    ON CONFLICT (guild_id, variable_id)
    DO
      UPDATE SET value = $4`,
    [managedGuild.guild.id, qualifiedId, jsonValue, jsonValue],
  );
}

export function setGameVariableValue<VariableType extends GameVariableBase>(
  managedGuild: ManagedGuild,
  variable: ResolvedVariable<VariableType>,
  value: any,
) {
  return setQualifiedVariableValue(managedGuild, getQualifiedVariableId(variable), value);
}

export async function getGameScene<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
>(managedGuild: ManagedGuild, game: Game<VariableType, AreaType, SceneType>) {
  const result = await dbPool.query('SELECT scene_name FROM game_states WHERE guild_id = $1', [
    managedGuild.guild.id,
  ]);

  if (result.rowCount === 0) {
    return undefined;
  }

  const sceneName = result.rows[0].scene_name;
  if (sceneName == null) {
    return undefined;
  }

  return game.scenes.find((scene) => scene.name === sceneName);
}

export function setGameScene(managedGuild: ManagedGuild, scene?: Scene<any, any>) {
  return query(
    `INSERT INTO game_states (guild_id, scene_name)
    VALUES ($1, $2)
    ON CONFLICT (guild_id)
    DO
      UPDATE SET scene_name = $3`,
    [managedGuild.guild.id, scene?.name, scene?.name],
  );
}

export async function getOriginalMemberNicknames(managedGuild: ManagedGuild) {
  const result = await query(
    `SELECT member_id, original_nickname FROM member_nicknames WHERE guild_id = $1`,
    [managedGuild.guild.id],
  );

  return result.rows.reduce<Map<string, string>>((nicknames, row) => {
    nicknames.set(row.member_id, row.original_nickname);
    return nicknames;
  }, new Map<string, string>());
}

export function setOriginalMemberNicknameIfNotExists(
  managedGuild: ManagedGuild,
  member: GuildMember,
) {
  return query(
    `INSERT INTO member_nicknames (guild_id, member_id, original_nickname)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING`,
    [managedGuild.guild.id, member.id, member.nickname],
  );
}

export async function deleteGameData(managedGuild: ManagedGuild) {
  await query(`DELETE FROM game_states WHERE guild_id = $1`, [managedGuild.guild.id]);
  await query(`DELETE FROM game_variables WHERE guild_id = $1`, [managedGuild.guild.id]);
  await query(`DELETE FROM member_nicknames WHERE guild_id = $1`, [managedGuild.guild.id]);
}
