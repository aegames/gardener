import { Channel, Client, Guild, GuildChannel, Role, TextChannel, VoiceChannel } from 'discord.js';
import { handleCommand } from './commandHandlers';
import { Game } from './game';
import logger from './logger';

export type ManagedGuild = {
  areaTextChannels: Map<string, TextChannel>;
  areaVoiceChannels: Map<string, VoiceChannel>;
  characterRoles: Map<string, Role>;
  gmRole?: Role;
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

export function checkReadyToPlay(
  managedGuild: ManagedGuild,
  game: Game<any>,
): { readyToPlay: true; errorMessage: undefined } | { readyToPlay: false; errorMessage: string } {
  const { guild } = managedGuild;
  const areaNames = [...game.areas.values()].map((area) => area.name);
  const missingAreaTextChannels = findMissing(
    areaNames,
    managedGuild.areaTextChannels ?? new Map<string, GuildChannel>(),
  );
  const missingAreaVoiceChannels = findMissing(
    areaNames,
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
  if (!managedGuild.gmRole) {
    errors.push('Missing GM role');
  }

  if (errors.length > 0) {
    const errorMessage = [...errors, "Can't start game until these errors are fixed."].join('\n');
    managedGuild.readyToPlay = false;
    return { readyToPlay: false, errorMessage };
  } else {
    if (!managedGuild.readyToPlay) {
      logger.info(`${guild.name} is ready to play`);
    }
    managedGuild.readyToPlay = true;
    return { readyToPlay: true, errorMessage: undefined };
  }
}

async function checkReadyToPlayAndReportInSystemChannel(
  managedGuild: ManagedGuild,
  game: Game<any>,
) {
  const previouslyReady = managedGuild.readyToPlay;
  const result = checkReadyToPlay(managedGuild, game);
  if (!previouslyReady && result.readyToPlay) {
    await managedGuild.guild.systemChannel?.send('Errors corrected!  Ready to play.');
  } else if (!result.readyToPlay) {
    await managedGuild.guild.systemChannel?.send(result.errorMessage);
  }
}

function loadAreaChannelsForGuild(managedGuild: ManagedGuild, game: Game<any>) {
  const areaTextChannels = new Map<string, TextChannel>();
  const areaVoiceChannels = new Map<string, VoiceChannel>();

  const areas = [...game.areas.values()];

  managedGuild.guild.channels.cache.forEach((channel) => {
    if (channel.type === 'voice') {
      const area = areas.find((area) => area.voiceChannelName === channel.name);
      if (area) {
        areaVoiceChannels.set(area.name, channel as VoiceChannel);
      }
    } else if (channel.type === 'text') {
      const area = areas.find((area) => area.textChannelName === channel.name);
      if (area) {
        areaTextChannels.set(area.name, channel as TextChannel);
      }
    }
  });
  managedGuild.areaTextChannels = areaTextChannels;
  managedGuild.areaVoiceChannels = areaVoiceChannels;
}

export async function loadRolesForGuild(managedGuild: ManagedGuild, game: Game<any>) {
  const characterRoles = new Map<string, Role>();
  let gmRole: Role | undefined;

  const roles = await managedGuild.guild.roles.fetch();
  roles.cache.forEach((role) => {
    if (role.name === game.gmRoleName) {
      gmRole = role;
    } else if (game.characters.has(role.name)) {
      characterRoles.set(role.name, role);
    }
  });

  managedGuild.characterRoles = characterRoles;
  managedGuild.gmRole = gmRole;
}

function channelIsGuildChannel(channel: Channel): channel is GuildChannel {
  return 'guild' in channel;
}

function maybeLoadGuildChannels(channel: Channel, game: Game<any>) {
  if (channelIsGuildChannel(channel)) {
    const managedGuild = managedGuildsByGuildId.get(channel.guild.id);
    if (managedGuild) {
      loadAreaChannelsForGuild(managedGuild, game);
      checkReadyToPlayAndReportInSystemChannel(managedGuild, game);
    }
  }
}

async function maybeLoadGuildRoles(role: Role, game: Game<any>) {
  const managedGuild = managedGuildsByGuildId.get(role.guild.id);
  if (managedGuild) {
    await loadRolesForGuild(managedGuild, game);
    checkReadyToPlayAndReportInSystemChannel(managedGuild, game);
  }
}

export function setupClient(game: Game<any>) {
  const client = new Client();

  const channelChanged = (channel: Channel) => maybeLoadGuildChannels(channel, game);
  const roleChanged = (role: Role) => maybeLoadGuildRoles(role, game);

  client.on('channelCreate', channelChanged);
  client.on('channelUpdate', channelChanged);
  client.on('channelDelete', channelChanged);
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
    await handleCommand(managedGuild, game, msg, command, args);
  });

  client.on('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag}!`);
    client.guilds.cache.forEach(async (guild) => {
      bringGuildUnderManagement(guild, game);
    });
  });

  client.login(process.env.DISCORD_TOKEN);

  return client;
}

export async function bringGuildUnderManagement(guild: Guild, game: Game<any>) {
  const managedGuild: ManagedGuild = {
    guild,
    areaTextChannels: new Map<string, TextChannel>(),
    areaVoiceChannels: new Map<string, VoiceChannel>(),
    characterRoles: new Map<string, Role>(),
    readyToPlay: true,
  };
  managedGuildsByGuildId.set(guild.id, managedGuild);

  loadAreaChannelsForGuild(managedGuild, game);
  await loadRolesForGuild(managedGuild, game);
  checkReadyToPlayAndReportInSystemChannel(managedGuild, game);
}
