import {
  Channel,
  Client,
  Guild,
  GuildChannel,
  Message,
  Role,
} from "discord.js";
import { flatMap } from "lodash";
import { prepScene } from "./Commands";
import { getGameScene, setGameVariableValue } from "./Database";
import { ChoiceVariable, Game } from "./Game";

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

type CommandDispatcher = (
  managedGuild: ManagedGuild,
  msg: Message,
  args: string
) => Promise<any> | void;

const commandDispatchers: Record<string, CommandDispatcher> = {
  list: (managedGuild: ManagedGuild, msg: Message) => {
    msg.reply(
      managedGuild.guild.channels.cache
        .filter((channel) => channel.type === "voice")
        .map((channel) => channel.name)
        .join(", ")
    );
  },
  prep: (managedGuild: ManagedGuild) =>
    prepScene(managedGuild, managedGuild.game.scenes[0]),
  choose: async (managedGuild: ManagedGuild, msg: Message, args: string) => {
    const { member } = msg;
    if (member == null) {
      return;
    }

    const currentScene = await getGameScene(managedGuild, managedGuild.game);
    if (currentScene == null) {
      throw new Error(
        "Choices can only be made in a scene, and the game currently isn't in one"
      );
    }

    const frameCharacterRoles = member.roles.cache
      .array()
      .filter((role) =>
        managedGuild.game.frameCharacterNames.includes(role.name)
      );

    const areas = currentScene.areaSetups
      .filter((areaSetup) =>
        areaSetup.placements.some((placement) =>
          frameCharacterRoles.some(
            (role) => role.name === placement.frameCharacter.name
          )
        )
      )
      .map((areaSetup) => areaSetup.area);

    const availableChoiceVariables = flatMap(currentScene.choices, (choice) => {
      if (choice.scope === "global") {
        return managedGuild.game.globalVariables.get(choice.variableId);
      } else if (choice.scope === "area") {
        return areas.map((area) => area.variables.get(choice.variableId));
      }
    });
    if (availableChoiceVariables.length === 0) {
      throw new Error("You don't have any choices available right now.");
    }

    const availableChoiceValues = flatMap(
      availableChoiceVariables,
      (variable: ChoiceVariable) => variable.choices
    );

    const choiceHelp = `Here are your options:\n${availableChoiceValues
      .map((choice) => `${choice.value}: ${choice.label}`)
      .join("\n")}\n\nTo choose one, say something like "!choose ${
      availableChoiceValues[0].value
    }".`;

    const choiceArg = args;
    if (choiceArg === "") {
      throw new Error(`Please specify a choice.  ${choiceHelp}`);
    }

    const choice = availableChoiceValues.find(
      (choiceValue) => choiceValue.value === choiceArg
    );
    if (choice == null) {
      throw new Error(
        `${choiceArg} is not a valid choice right now.  ${choiceHelp}`
      );
    }

    const variable = availableChoiceVariables.find((variable) =>
      variable?.choices.some(
        (choiceValue) => choiceValue.value === choice.value
      )
    )!;

    await setGameVariableValue(managedGuild, variable, choice.value);
    msg.reply(`Thank you.  Choice recorded: ${choice.label}`);
  },
};

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

    const match = msg.content.match(/^\!(\w+)(\s+(.*))?$/);
    if (!match) {
      return;
    }

    const command = match[1].toLowerCase();
    const args = match[2]?.trim() ?? "";

    console.log(`>> ${msg.member?.user.tag}: ${msg.content}`);

    const dispatcher = commandDispatchers[command];
    if (dispatcher != null) {
      try {
        await dispatcher(managedGuild, msg, args);
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
