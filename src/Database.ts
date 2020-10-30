import { Pool } from "pg";
import { Game, GameVariable, Scene } from "./Game";
import { ManagedGuild } from "./ManagedGuild";

export const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function getQualifiedVariableId(variable: GameVariable) {
  return `${variable.scope}.${variable.id}`;
}

export async function getGameVariableValue(
  managedGuild: ManagedGuild,
  variable: GameVariable
) {
  const result = await dbPool.query(
    "SELECT value FROM game_variables WHERE guild_id = $1 AND variable_id = $2",
    [managedGuild.guild.id, getQualifiedVariableId(variable)]
  );

  if (result.rowCount === 0) {
    return undefined;
  }

  return result.rows[0].value;
}

export function setGameVariableValue(
  managedGuild: ManagedGuild,
  variable: GameVariable,
  value: any
) {
  const jsonValue = JSON.stringify(value);

  return dbPool.query(
    `INSERT INTO game_variables (guild_id, variable_id, value)
    VALUES ($1, $2, $3)
    ON CONFLICT (guild_id, variable_id)
    DO
      UPDATE SET value = $4`,
    [
      managedGuild.guild.id,
      getQualifiedVariableId(variable),
      jsonValue,
      jsonValue,
    ]
  );
}

export async function getGameScene(managedGuild: ManagedGuild, game: Game) {
  const result = await dbPool.query(
    "SELECT scene_name FROM game_states WHERE guild_id = $1",
    [managedGuild.guild.id]
  );

  if (result.rowCount === 0) {
    return undefined;
  }

  const sceneName = result.rows[0].scene_name;
  if (sceneName == null) {
    return undefined;
  }

  return game.scenes.find((scene) => scene.name === sceneName);
}

export function setGameScene(managedGuild: ManagedGuild, scene?: Scene) {
  return dbPool.query(
    `INSERT INTO game_states (guild_id, scene_name)
    VALUES ($1, $2)
    ON CONFLICT (guild_id)
    DO
      UPDATE SET scene_name = $3`,
    [managedGuild.guild.id, scene?.name, scene?.name]
  );
}
