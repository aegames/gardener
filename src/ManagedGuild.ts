import { Channel, Client, Guild, GuildChannel, Role } from "discord.js";
import { prepScene } from "./Commands";
import { Game } from "./Game";

export type ManagedGuild = {
  areaChannels: Map<string, GuildChannel>;
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

function checkReadyToPlay(managedGuild: ManagedGuild) {
  const { guild, game } = managedGuild;
  const missingAreaChannels = findMissing(
    game.areaNames,
    managedGuild.areaChannels ?? new Map<string, GuildChannel>()
  );
  const missingInnerCharacterRoles = findMissing(
    game.innerCharacterNames,
    managedGuild.innerCharacterRoles ?? new Map<string, Role>()
  );
  const missingFrameCharacterRoles = findMissing(
    game.frameCharacterNames,
    managedGuild.frameCharacterRoles ?? new Map<string, Role>()
  );
  const missingRoles = [
    ...missingInnerCharacterRoles,
    ...missingFrameCharacterRoles,
  ];

  let errors: string[] = [];
  if (missingAreaChannels.length > 0) {
    errors.push(
      `Missing voice channels for ${missingAreaChannels.join(", ")}!`
    );
  }
  if (missingRoles.length > 0) {
    errors.push(`Missing roles for ${missingRoles.join(", ")}!`);
  }

  if (errors.length > 0) {
    guild.systemChannel?.send(
      [...errors, "Can't start game until these errors are fixed."].join("\n")
    );
    managedGuild.readyToPlay = false;
  } else {
    if (!managedGuild.readyToPlay) {
      guild.systemChannel?.send("Errors corrected!  Ready to play.");
    }
    console.log(`${guild.name} is ready to play`);
    managedGuild.readyToPlay = true;
  }
}

function loadAreaChannelsForGuild(managedGuild: ManagedGuild) {
  const areaChannels = new Map<string, GuildChannel>();
  managedGuild.guild.channels.cache
    .filter((channel) => channel.type === "voice")
    .forEach((channel) => {
      const channelName = channel.name;
      if (managedGuild.game.areaNames.includes(channelName)) {
        areaChannels.set(channelName, channel);
      }
    });
  managedGuild.areaChannels = areaChannels;
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
  return "guild" in channel;
}

function maybeLoadGuildChannels(channel: Channel) {
  if (channelIsGuildChannel(channel) && channel.type === "voice") {
    const managedGuild = managedGuildsByGuildId.get(channel.guild.id);
    if (managedGuild) {
      loadAreaChannelsForGuild(managedGuild);
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
  client.on("channelCreate", maybeLoadGuildChannels);
  client.on("channelUpdate", maybeLoadGuildChannels);
  client.on("channelDelete", maybeLoadGuildChannels);
  client.on("roleCreate", roleChanged);
  client.on("roleUpdate", roleChanged);
  client.on("roleDelete", roleChanged);

  client.on("message", async (msg) => {
    if (!msg.guild) {
      return;
    }

    const managedGuild = managedGuildsByGuildId.get(msg.guild.id);
    if (!managedGuild) {
      return;
    }

    if (msg.content === "!list" && managedGuild.guild) {
      msg.reply(
        managedGuild.guild.channels.cache
          .filter((channel) => channel.type === "voice")
          .map((channel) => channel.name)
          .join(", ")
      );
    } else if (msg.content === "!prep") {
      try {
        await prepScene(managedGuild, managedGuild.game.scenes[0]);
      } catch (error) {
        msg.reply(error.message);
      }
    }
  });
}

export async function bringGuildUnderManagement(guild: Guild, game: Game) {
  const managedGuild: ManagedGuild = {
    guild,
    game,
    areaChannels: new Map<string, GuildChannel>(),
    frameCharacterRoles: new Map<string, Role>(),
    innerCharacterRoles: new Map<string, Role>(),
    readyToPlay: true,
  };
  managedGuildsByGuildId.set(guild.id, managedGuild);

  loadAreaChannelsForGuild(managedGuild);
  await loadRolesForGuild(managedGuild);
  checkReadyToPlay(managedGuild);
}
