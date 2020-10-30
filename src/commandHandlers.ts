import { Message } from 'discord.js';
import { flatMap } from 'lodash';
import { makeChoice, prepNextScene, prepScene, PrepSceneResults } from './commands';
import { ManagedGuild } from './managedGuild';
import { notEmpty } from './utils';

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

function formatPrepSceneResults(results: PrepSceneResults) {
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

const prep: CommandHandler = async (managedGuild, msg, args) => {
  if (args === 'next') {
    const results = await prepNextScene(managedGuild);
    msg.reply(`Prepped ${results.scene.name}${formatPrepSceneResults(results)}`);
  } else {
    const scene = managedGuild.game.scenes.find((scene) => scene.name === args);
    if (scene) {
      const results = await prepScene(managedGuild, scene);
      msg.reply(`Prepped ${results.scene.name}${formatPrepSceneResults(results)}`);
    } else {
      msg.reply(
        `Invalid command.  To prep a scene, you can say:\n!prep next (for the next scene)\n${managedGuild.game.scenes
          .map((scene) => `!prep ${scene.name}`)
          .join('\n')}`,
      );
    }
  }
};

const choose: CommandHandler = async (managedGuild, msg, args) => {
  const { member } = msg;
  if (member == null) {
    return;
  }

  const choice = await makeChoice(managedGuild, member, args);
  msg.reply(`Thank you.  Choice recorded: ${choice.label}`);
};

const commandHandlers: Record<string, CommandHandler> = {
  list,
  prep,
  choose,
};

export async function handleCommand(
  managedGuild: ManagedGuild,
  msg: Message,
  command: string,
  args: string,
) {
  const dispatcher = commandHandlers[command];
  if (dispatcher != null) {
    try {
      await dispatcher(managedGuild, msg, args);
    } catch (error) {
      console.error(error);
      msg.reply(error.message);
    }
  }
}
