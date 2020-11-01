import { Channel, Client, Guild, GuildChannel, Role, TextChannel, VoiceChannel } from 'discord.js';
import { handleCommand } from './commandHandlers';
import { Game } from './game';
import logger from './logger';

export type ManagedGuild = {
  areaTextChannels: Map<string, TextChannel>;
  areaVoiceChannels: Map<string, VoiceChannel>;
  characterRoles: Map<string, Role>;
  game: Game<any>;
  guild: Guild;
  readyToPlay: boolean;
};

const managedGuildsByGuildId = new Map<string, ManagedGuild>();

function findMissing<T>(expected: T[], actual: Map<T, any>) {
  return expected.filter((item) => !actual.has(item));
}

function getAreaTextChannelName(areaName: string) {
  return areaName.toLowerCase().replace(/\W+/g, '-');
}

export function getAreaTextChannel(managedGuild: ManagedGuild, areaName: string) {
  return managedGuild.areaTextChannels.get(getAreaTextChannelName(areaName));
}

export function getAreaVoiceChannel(managedGuild: ManagedGuild, areaName: string) {
  return managedGuild.areaVoiceChannels.get(areaName);
}

function checkReadyToPlay(managedGuild: ManagedGuild) {
  const { guild, game } = managedGuild;
  const missingAreaTextChannels = findMissing(
    game.areaNames,
    managedGuild.areaTextChannels ?? new Map<string, GuildChannel>(),
  );
  const missingAreaVoiceChannels = findMissing(
    game.areaNames,
    managedGuild.areaVoiceChannels ?? new Map<string, GuildChannel>(),
  );
  const missingRoles = findMissing(
    [...game.characters.keys()],
    managedGuild.characterRoles ?? new Map<string, Role>(),
  );

  let errors: string[] = [];
  if (missingAreaTextChannels.length > 0) {
    errors.push(`Missing text channels for ${missingAreaTextChannels.join(', ')}!`);
  }
  if (missingAreaVoiceChannels.length > 0) {
    errors.push(`Missing voice channels for ${missingAreaVoiceChannels.join(', ')}!`);
  }
  if (missingRoles.length > 0) {
    errors.push(`Missing roles for ${missingRoles.join(', ')}!`);
  }

  if (errors.length > 0) {
    guild.systemChannel?.send(
      [...errors, "Can't start game until these errors are fixed."].join('\n'),
    );
    managedGuild.readyToPlay = false;
  } else {
    if (!managedGuild.readyToPlay) {
      guild.systemChannel?.send('Errors corrected!  Ready to play.');
      logger.info(`${guild.name} is ready to play`);
    }
    managedGuild.readyToPlay = true;
  }
}

function loadAreaChannelsForGuild(managedGuild: ManagedGuild, game: Game<any>) {
  const areaTextChannels = new Map<string, TextChannel>();
  const areaVoiceChannels = new Map<string, VoiceChannel>();

  const areas = [...game.areas.values()];
  const areaNames = new Set(areas.map((area) => area.name));
  const areaNameByTextChannelName = new Map(
    areas.map((area) => [getAreaTextChannelName(area.name), area.name]),
  );

  managedGuild.guild.channels.cache.forEach((channel) => {
    const channelName = channel.name;
    if (channel.type === 'voice' && areaNames.has(channelName)) {
      areaVoiceChannels.set(channelName, channel as VoiceChannel);
    } else if (channel.type === 'text' && areaNameByTextChannelName.has(channelName)) {
      areaTextChannels.set(areaNameByTextChannelName.get(channelName)!, channel as TextChannel);
    }
  });
  managedGuild.areaTextChannels = areaTextChannels;
  managedGuild.areaVoiceChannels = areaVoiceChannels;
}

export async function loadRolesForGuild(managedGuild: ManagedGuild) {
  const characterRoles = new Map<string, Role>();

  const roles = await managedGuild.guild.roles.fetch();
  roles.cache.forEach((role) => {
    if (managedGuild.game.characters.has(role.name)) {
      characterRoles.set(role.name, role);
    }
  });

  managedGuild.characterRoles = characterRoles;
}

function channelIsGuildChannel(channel: Channel): channel is GuildChannel {
  return 'guild' in channel;
}

function maybeLoadGuildChannels(channel: Channel) {
  if (channelIsGuildChannel(channel)) {
    const managedGuild = managedGuildsByGuildId.get(channel.guild.id);
    if (managedGuild) {
      loadAreaChannelsForGuild(managedGuild, managedGuild.game);
      checkReadyToPlay(managedGuild);
    }
  }
}

async function roleChanged(role: Role) {
  const managedGuild = managedGuildsByGuildId.get(role.guild.id);
  if (managedGuild) {
    await loadRolesForGuild(managedGuild);
    checkReadyToPlay(managedGuild);
  }
}

export function setupClient(client: Client) {
  client.on('channelCreate', maybeLoadGuildChannels);
  client.on('channelUpdate', maybeLoadGuildChannels);
  client.on('channelDelete', maybeLoadGuildChannels);
  client.on('roleCreate', roleChanged);
  client.on('roleUpdate', roleChanged);
  client.on('roleDelete', roleChanged);

  client.on('message', async (msg) => {
    if (!msg.guild) {
      return;
    }

    const managedGuild = managedGuildsByGuildId.get(msg.guild.id);
    if (!managedGuild) {
      return;
    }

    const match = msg.content.match(/^\!(\w+)(\s+(.*))?$/);
    if (!match) {
      return;
    }

    const command = match[1].toLowerCase();
    const args = match[2]?.trim() ?? '';

    logger.info(`>> ${msg.member?.user.tag}: ${msg.content}`);
    await handleCommand(managedGuild, managedGuild.game, msg, command, args);
  });
}

export async function bringGuildUnderManagement(guild: Guild, game: Game<any>) {
  const managedGuild: ManagedGuild = {
    guild,
    game,
    areaTextChannels: new Map<string, TextChannel>(),
    areaVoiceChannels: new Map<string, VoiceChannel>(),
    characterRoles: new Map<string, Role>(),
    readyToPlay: true,
  };
  managedGuildsByGuildId.set(guild.id, managedGuild);

  loadAreaChannelsForGuild(managedGuild, game);
  await loadRolesForGuild(managedGuild);
  checkReadyToPlay(managedGuild);
}
