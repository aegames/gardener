import { Message } from 'discord.js';
import { flatMap } from 'lodash';
import { prepNextScene, prepScene, PrepSceneResults } from './commands';
import { Game, GameVariableBase } from './game';
import { ManagedGuild } from './managedGuild';
import { notEmpty } from '../utils';
import logger from './logger';
import {
  deleteGameData,
  getGameVariableValues,
  getQualifiedVariableId,
  getQualifiedVariableValue,
  getQualifiedVariableValues,
  setQualifiedVariableValue,
} from './database';
import { resolveVariable } from './gameLogic';

export type CommandHandler<VariableType extends GameVariableBase> = (
  managedGuild: ManagedGuild,
  game: Game<VariableType>,
  msg: Message,
  args: string,
) => Promise<any>;

const list: CommandHandler<any> = async (managedGuild, game, msg) => {
  await msg.reply(
    managedGuild.guild.channels.cache
      .filter((channel) => channel.type === 'voice')
      .map((channel) => channel.name)
      .join(', '),
  );
};

const helpHandler: CommandHandler<any> = async (managedGuild, game, msg) => {
  await msg.reply(
    `Available commands:\n${Object.keys(game.commandHandlers)
      .sort()
      .map((commandName) => `!${commandName}`)
      .join('\n')}`,
  );
};

function formatPrepSceneResults<VariableType extends GameVariableBase>(
  results: PrepSceneResults<VariableType>,
) {
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

async function replyWithPrepSceneResults(msg: Message, results: PrepSceneResults<any>) {
  const reply = `Prepped ${results.scene.name}${formatPrepSceneResults(results)}`;
  reply.split('\n').forEach((line) => logger.info(line));
  return await msg.reply(reply);
}

const prep: CommandHandler<any> = async (managedGuild, game, msg, args) => {
  if (args === 'next') {
    const results = await prepNextScene(managedGuild, game);
    await replyWithPrepSceneResults(msg, results);
  } else if (args === 'first') {
    const results = await prepScene(managedGuild, game, game.scenes[0]);
    await replyWithPrepSceneResults(msg, results);
  } else {
    const scene = game.scenes.find((scene) => scene.name === args);
    if (scene) {
      const results = await prepScene(managedGuild, game, scene);
      await replyWithPrepSceneResults(msg, results);
    } else {
      msg.reply(
        `Invalid command.  To prep a scene, you can say:\n!prep next (for the next scene)\n${game.scenes
          .map((scene) => `!prep ${scene.name}`)
          .join('\n')}`,
      );
    }
  }
};

const getHandler: CommandHandler<any> = async (managedGuild, game, msg, args) => {
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

const setHandler: CommandHandler<any> = async (managedGuild, game, msg, args) => {
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

const resetgame: CommandHandler<any> = async (managedGuild, game, msg, args) => {
  if (args === 'confirm') {
    await deleteGameData(managedGuild);
    msg.reply('Game data reset.');
  } else {
    msg.reply('Are you sure?  If so, use `!resetgame confirm` to reset.');
  }
};

export const commonCommandHandlers = {
  help: helpHandler,
  list,
  prep,
  get: getHandler,
  set: setHandler,
  resetgame,
};

export async function handleCommand(
  managedGuild: ManagedGuild,
  game: Game<any>,
  msg: Message,
  command: string,
  args: string,
) {
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
