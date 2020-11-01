import { Message } from 'discord.js';
import { flatMap } from 'lodash';
import { prepNextScene, prepScene, PrepSceneResults } from './commands';
import { Game, GameVariableBase } from './game';
import { ManagedGuild } from './managedGuild';
import { notEmpty } from '../utils';
import logger from './logger';

export type CommandHandler = (
  managedGuild: ManagedGuild,
  msg: Message,
  args: string,
) => Promise<any> | void;

const list: CommandHandler = (managedGuild, msg) => {
  msg.reply(
    managedGuild.guild.channels.cache
      .filter((channel) => channel.type === 'voice')
      .map((channel) => channel.name)
      .join(', '),
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

const prep: CommandHandler = async (managedGuild, msg, args) => {
  if (args === 'next') {
    const results = await prepNextScene(managedGuild);
    await replyWithPrepSceneResults(msg, results);
  } else {
    const scene = managedGuild.game.scenes.find((scene) => scene.name === args);
    if (scene) {
      const results = await prepScene(managedGuild, scene);
      await replyWithPrepSceneResults(msg, results);
    } else {
      msg.reply(
        `Invalid command.  To prep a scene, you can say:\n!prep next (for the next scene)\n${managedGuild.game.scenes
          .map((scene) => `!prep ${scene.name}`)
          .join('\n')}`,
      );
    }
  }
};

const builtInCommandHandlers: Record<string, CommandHandler> = {
  list,
  prep,
};

export async function handleCommand(
  managedGuild: ManagedGuild,
  game: Game<any>,
  msg: Message,
  command: string,
  args: string,
) {
  const dispatcher = game.commandHandlers[command] ?? builtInCommandHandlers[command];
  if (dispatcher != null) {
    try {
      await dispatcher(managedGuild, msg, args);
    } catch (error) {
      logger.error(error);
      msg.reply(error.message);
    }
  }
}
