import { Channel, Client, Guild, GuildChannel, Role } from 'discord.js';
import { handleCommand } from './commandHandlers';
import { Game } from './game';

export type ManagedGuild = {
  areaTextChannels: Map<string, GuildChannel>;
  areaVoiceChannels: Map<string, GuildChannel>;
  frameCharacterRoles: Map<string, Role>;
  game: Game;
  guild: Guild;
  innerCharacterRoles: Map<string, Role>;
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
  const missingInnerCharacterRoles = findMissing(
    game.innerCharacterNames,
    managedGuild.innerCharacterRoles ?? new Map<string, Role>(),
  );
  const missingFrameCharacterRoles = findMissing(
    game.frameCharacterNames,
    managedGuild.frameCharacterRoles ?? new Map<string, Role>(),
  );
  const missingRoles = [...missingInnerCharacterRoles, ...missingFrameCharacterRoles];

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
      console.log(`${guild.name} is ready to play`);
    }
    managedGuild.readyToPlay = true;
  }
}

function loadAreaChannelsForGuild(managedGuild: ManagedGuild, game: Game) {
  const areaTextChannels = new Map<string, GuildChannel>();
  const areaVoiceChannels = new Map<string, GuildChannel>();

  const areas = [...game.areas.values()];
  const areaNames = new Set(areas.map((area) => area.name));
  const areaNameByTextChannelName = new Map(
    areas.map((area) => [getAreaTextChannelName(area.name), area.name]),
  );

  managedGuild.guild.channels.cache.forEach((channel) => {
    const channelName = channel.name;
    if (channel.type === 'voice' && areaNames.has(channelName)) {
      areaVoiceChannels.set(channelName, channel);
    } else if (channel.type === 'text' && areaNameByTextChannelName.has(channelName)) {
      areaTextChannels.set(areaNameByTextChannelName.get(channelName)!, channel);
    }
  });
  managedGuild.areaTextChannels = areaTextChannels;
  managedGuild.areaVoiceChannels = areaVoiceChannels;
}

async function loadRolesForGuild(managedGuild: ManagedGuild) {
  const frameCharacterRoles = new Map<string, Role>();
  const innerCharacterRoles = new Map<string, Role>();

  const roles = await managedGuild.guild.roles.fetch();
  roles.cache.forEach((role) => {
    if (managedGuild.game.frameCharacterNames.includes(role.name)) {
      frameCharacterRoles.set(role.name, role);
    } else if (managedGuild.game.innerCharacterNames.includes(role.name)) {
      innerCharacterRoles.set(role.name, role);
    }
  });

  managedGuild.frameCharacterRoles = frameCharacterRoles;
  managedGuild.innerCharacterRoles = innerCharacterRoles;
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

    console.log(`>> ${msg.member?.user.tag}: ${msg.content}`);
    await handleCommand(managedGuild, msg, command, args);
  });
}

export async function bringGuildUnderManagement(guild: Guild, game: Game) {
  const managedGuild: ManagedGuild = {
    guild,
    game,
    areaTextChannels: new Map<string, GuildChannel>(),
    areaVoiceChannels: new Map<string, GuildChannel>(),
    frameCharacterRoles: new Map<string, Role>(),
    innerCharacterRoles: new Map<string, Role>(),
    readyToPlay: true,
  };
  managedGuildsByGuildId.set(guild.id, managedGuild);

  loadAreaChannelsForGuild(managedGuild, game);
  await loadRolesForGuild(managedGuild);
  checkReadyToPlay(managedGuild);
}
