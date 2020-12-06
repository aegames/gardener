import { GuildMember, Message } from 'discord.js';
import { flatMap } from 'lodash';
import { prepScene, PrepSceneResults } from './commands';
import { Area, Game, GameVariableBase, Scene } from './game';
import { checkReadyToPlay, ManagedGuild } from './managedGuild';
import { notEmpty } from '../utils';
import logger from './logger';
import {
  deleteGameData,
  getGameVariableValues,
  getQualifiedVariableId,
  getQualifiedVariableValues,
  setQualifiedVariableValue,
} from './database';
import { resolveVariable } from './gameLogic';
import { findScene } from './sceneHelpers';

export type CommandHandler<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
> = (
  managedGuild: ManagedGuild,
  game: Game<VariableType, AreaType, SceneType>,
  msg: Message,
  args: string,
) => Promise<any>;

export function assertHasGMRole(managedGuild: ManagedGuild, member: GuildMember | null) {
  const gmRole = managedGuild.gmRole;
  if (!gmRole) {
    throw new Error('Guild has no GM role');
  }

  if (!member?.roles.cache.has(gmRole.id)) {
    throw new Error('Sorry, only GMs can do that.');
  }
}

const helpHandler: CommandHandler<any, any, any> = async (managedGuild, game, msg) => {
  await msg.reply(
    `Available commands:\n${Object.keys(game.commandHandlers)
      .sort()
      .map((commandName) => `!${commandName}`)
      .join('\n')}`,
  );
};

function formatPrepSceneResults(results: PrepSceneResults<any, any, any>) {
  const warnings: string[] = flatMap(results.areaSetupResults, (areaSetupResults) =>
    flatMap(areaSetupResults.placementResults, (placementResult) => [
      placementResult.voiceChannelJoined
        ? undefined
        : `Member ${placementResult.member.user.tag} not joined to voice channel: ${placementResult.voiceChannelJoinError?.message}`,
      placementResult.nicknameChanged
        ? undefined
        : `Member ${placementResult.member.user.tag} nickname not changed: ${placementResult.nicknameChangeError?.message}`,
    ]),
  ).filter(notEmpty);

  if (warnings.length === 0) {
    return '';
  } else {
    return `\n${warnings.join('\n')}`;
  }
}

async function replyWithPrepSceneResults(msg: Message, results: PrepSceneResults<any, any, any>) {
  const reply = `Prepped ${results.scene.name}${formatPrepSceneResults(results)}`;
  reply.split('\n').forEach((line) => logger.info(line));
  return await msg.reply(reply);
}

const prep: CommandHandler<any, any, any> = async (managedGuild, game, msg, args) => {
  assertHasGMRole(managedGuild, msg.member);
  const scene = await findScene(managedGuild, game, args);
  const results = await prepScene(managedGuild, game, scene);
  await replyWithPrepSceneResults(msg, results);
};

const getHandler: CommandHandler<any, any, any> = async (managedGuild, game, msg, args) => {
  assertHasGMRole(managedGuild, msg.member);

  if (args !== '') {
    const variableIds = args.split(/\s+/);
    const values = await getQualifiedVariableValues(managedGuild, ...variableIds);
    msg.reply(
      variableIds.map((variableId, index) => `${variableId} = ${JSON.stringify(values[index])}`),
    );
  } else {
    const variables = [
      ...[...game.globalVariables.values()].map((variable) =>
        resolveVariable(game, { variableId: variable.id, scope: 'global' as const }, {}),
      ),
      ...flatMap([...game.areas.values()], (area) =>
        Object.values(area.variables).map((variable: GameVariableBase) =>
          resolveVariable(game, { variableId: variable.id, scope: 'area' as const }, { area }),
        ),
      ),
    ].filter(notEmpty);
    const values = await getGameVariableValues(managedGuild, ...variables);
    msg.reply(
      variables.map(
        (variable, index) =>
          `${getQualifiedVariableId(variable)} = ${JSON.stringify(values[index])}`,
      ),
    );
  }
};

const setHandler: CommandHandler<any, any, any> = async (managedGuild, game, msg, args) => {
  assertHasGMRole(managedGuild, msg.member);

  const [variableId, ...rest] = args.split(' ');
  if (!variableId) {
    throw new Error('Please provide a variable ID to set.');
  }

  const valueJSON = rest.join(' ').trim();
  if (!valueJSON) {
    throw new Error('Please provide a value in JSON format.');
  }

  const value = JSON.parse(valueJSON);
  await setQualifiedVariableValue(managedGuild, variableId, value);
  msg.reply(`Set ${variableId} to ${JSON.stringify(value)}`);
};

const resetgame: CommandHandler<any, any, any> = async (managedGuild, game, msg, args) => {
  assertHasGMRole(managedGuild, msg.member);

  if (args === 'confirm') {
    await deleteGameData(managedGuild);
    msg.reply('Game data reset.');
  } else {
    msg.reply('Are you sure?  If so, use `!resetgame confirm` to reset.');
  }
};

const checkServer: CommandHandler<any, any, any> = async (managedGuild, game, msg, args) => {
  const result = await checkReadyToPlay(managedGuild, game, true);
  if (result.readyToPlay) {
    msg.reply('Everything looks good!');
  } else {
    msg.reply(result.errorMessage);
  }
};

export const commonCommandHandlers = {
  help: helpHandler,
  prep,
  get: getHandler,
  set: setHandler,
  resetgame,
  checkserver: checkServer,
  // TODO: derole command
};

export async function handleCommand<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
>(
  managedGuild: ManagedGuild,
  game: Game<VariableType, AreaType, SceneType>,
  msg: Message,
  command: string,
  args: string,
) {
  if (!managedGuild.readyToPlay) {
    const result = await checkReadyToPlay(managedGuild, game, false);
    if (!result.readyToPlay) {
      msg.reply(result.errorMessage);
      return;
    }
  }

  const dispatcher = game.commandHandlers[command];
  if (dispatcher == null) {
    msg.reply(`Unknown command: ${command}.  To see available commands, say \`!help\`.`);
  } else {
    try {
      await dispatcher(managedGuild, game, msg, args);
    } catch (error) {
      logger.error(error);
      msg.reply(error.message);
    }
  }
}
