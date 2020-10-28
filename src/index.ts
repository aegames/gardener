import DiscordJS, {
  Channel,
  Guild,
  GuildChannel,
  GuildMember,
  Role,
} from "discord.js";
import dotenv from "dotenv";
import { flatMap } from "lodash";
import GameStructure from "./gameStructure.json";

dotenv.config();
const client = new DiscordJS.Client();

function channelIsGuildChannel(channel: Channel): channel is GuildChannel {
  return "guild" in channel;
}

const areaNames = GameStructure.areas.map((area) => area.name);
const innerCharacterNames = GameStructure.innerCharacters.map(
  (character) => character.name
);
const frameCharacterNames = GameStructure.frameCharacters.map(
  (character) => character.name
);

const areaChannelsByGuildId = new Map<string, Map<string, GuildChannel>>();
const frameCharacterRolesByGuildId = new Map<string, Map<string, Role>>();
const innerCharacterRolesByGuildId = new Map<string, Map<string, Role>>();
const readyToPlayByGuildId = new Map<string, boolean>();

function findMissing<T>(expected: T[], actual: Map<T, any>) {
  return expected.filter((item) => !actual.has(item));
}

function checkReadyToPlay(guild: Guild) {
  const missingAreaChannels = findMissing(
    areaNames,
    areaChannelsByGuildId.get(guild.id) ?? new Map<string, GuildChannel>()
  );
  const missingInnerCharacterRoles = findMissing(
    innerCharacterNames,
    innerCharacterRolesByGuildId.get(guild.id) ?? new Map<string, Role>()
  );
  const missingFrameCharacterRoles = findMissing(
    frameCharacterNames,
    frameCharacterRolesByGuildId.get(guild.id) ?? new Map<string, Role>()
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
    guild.systemChannel.send(
      [...errors, "Can't start game until these errors are fixed."].join("\n")
    );
    readyToPlayByGuildId.set(guild.id, false);
  } else {
    if (
      readyToPlayByGuildId.has(guild.id) &&
      !readyToPlayByGuildId.get(guild.id)
    ) {
      guild.systemChannel.send("Errors corrected!  Ready to play.");
    }
    console.log(`${guild.name} is ready to play`);
    readyToPlayByGuildId.set(guild.id, true);
  }
}

function loadAreaChannelsForGuild(guild: Guild) {
  const areaChannels = new Map<string, GuildChannel>();
  guild.channels.cache
    .filter((channel) => channel.type === "voice")
    .forEach((channel) => {
      const channelName = channel.name;
      if (areaNames.includes(channelName)) {
        areaChannels.set(channelName, channel);
      }
    });
  areaChannelsByGuildId.set(guild.id, areaChannels);
}

async function loadRolesForGuild(guild: Guild) {
  const frameCharacterRoles = new Map<string, Role>();
  const innerCharacterRoles = new Map<string, Role>();

  const roles = await guild.roles.fetch();
  roles.cache.forEach((role) => {
    if (frameCharacterNames.includes(role.name)) {
      frameCharacterRoles.set(role.name, role);
    } else if (innerCharacterNames.includes(role.name)) {
      innerCharacterRoles.set(role.name, role);
    }
  });

  frameCharacterRolesByGuildId.set(guild.id, frameCharacterRoles);
  innerCharacterRolesByGuildId.set(guild.id, innerCharacterRoles);
}

function maybeLoadGuildChannels(channel: Channel) {
  if (channelIsGuildChannel(channel) && channel.type === "voice") {
    loadAreaChannelsForGuild(channel.guild);
    checkReadyToPlay(channel.guild);
  }
}

async function roleChanged(role: Role) {
  await loadRolesForGuild(role.guild);
  checkReadyToPlay(role.guild);
}

function placeCharacter(
  guild: Guild,
  channel: GuildChannel,
  frameRole: Role,
  innerRole: Role
) {
  if (frameRole.members.size === 0) {
    console.warn(`No player for ${frameRole.name}`);
  }

  const promises = flatMap(frameRole.members.array(), (member) => {
    const extraRoles = member.roles.cache.filter(
      (role) =>
        innerCharacterNames.includes(role.name) && role.name !== innerRole.name
    );

    console.log(
      `Giving ${member.displayName} ${innerRole.name}, moving to ${
        channel.name
      }, removing ${extraRoles.map((role) => role.name).join(", ")}`
    );
    return [
      member.roles.add(innerRole),
      member.voice.setChannel(channel),
      ...extraRoles.map((role) => member.roles.remove(role)),
    ];
  });

  return Promise.all(promises);
}

function setupArea(
  guild: Guild,
  areaSetup: NonNullable<typeof GameStructure.scenes[0]["areaSetups"]>[0]
) {
  const channel = areaChannelsByGuildId.get(guild.id).get(areaSetup.areaName);
  const promises = flatMap(areaSetup.placements, (placement) => {
    const innerName = /* placement.innerCharacterName ?? */ GameStructure.innerCharacters.find(
      (c) => c.defaultFrameCharacterNames.includes(placement.frameCharacterName)
    )?.name;
    const frameRole = frameCharacterRolesByGuildId
      .get(guild.id)
      .get(placement.frameCharacterName);

    if (innerName) {
      const innerRole = innerCharacterRolesByGuildId
        .get(guild.id)
        .get(innerName);

      return [placeCharacter(guild, channel, frameRole, innerRole)];
    } else {
      console.log(`No inner character for ${frameRole.name}`);
      return [];
    }
  });

  return Promise.all(promises);
}

function prepScene(guild: Guild, scene: typeof GameStructure.scenes[0]) {
  return Promise.all(
    (scene.areaSetups ?? []).map((areaSetup) => setupArea(guild, areaSetup))
  );
}

client.on("channelCreate", maybeLoadGuildChannels);
client.on("channelUpdate", maybeLoadGuildChannels);
client.on("channelDelete", maybeLoadGuildChannels);
client.on("roleCreate", roleChanged);
client.on("roleUpdate", roleChanged);
client.on("roleDelete", roleChanged);

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.guilds.cache.forEach(async (guild) => {
    loadAreaChannelsForGuild(guild);
    await loadRolesForGuild(guild);
    checkReadyToPlay(guild);
  });
});

client.on("message", async (msg) => {
  if (msg.content === "!list") {
    msg.reply(
      msg.guild.channels.cache
        .filter((channel) => channel.type === "voice")
        .map((channel) => channel.name)
        .join(", ")
    );
  } else if (msg.content === "!prep") {
    try {
      await prepScene(msg.guild, GameStructure.scenes[0]);
    } catch (error) {
      msg.reply(error.message);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
