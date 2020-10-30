import { GuildChannel, GuildMember, Role } from "discord.js";
import { flatMap } from "lodash";
import { getGameScene, setGameScene, setGameVariableValue } from "./Database";
import {
  AreaSetup,
  findAreaForFrameCharacter,
  Game,
  getSceneChoices,
  Scene,
} from "./Game";
import type { ManagedGuild } from "./ManagedGuild";

function placeCharacter(
  channel: GuildChannel,
  frameRole: Role,
  innerRole: Role,
  game: Game
) {
  if (frameRole.members.size === 0) {
    console.warn(`No player for ${frameRole.name}`);
  }

  const promises = flatMap(frameRole.members.array(), (member) => {
    const extraRoles = member.roles.cache.filter(
      (role) =>
        game.innerCharacterNames.includes(role.name) &&
        role.name !== innerRole.name
    );

    console.log(
      `Giving ${member.user.tag} ${innerRole.name}, moving to ${channel.name}${
        extraRoles.size > 0
          ? `removing ${extraRoles.map((role) => role.name).join(", ")}`
          : ""
      }`
    );
    return [
      member.roles.add(innerRole),
      member.voice.setChannel(channel),
      ...extraRoles.map((role) => member.roles.remove(role)),
    ];
  });

  return Promise.all(promises);
}

function setupArea(managedGuild: ManagedGuild, areaSetup: AreaSetup) {
  const channel = managedGuild.areaChannels.get(areaSetup.area.name);
  if (!channel) {
    return Promise.reject(
      new Error(`No channel for area ${areaSetup.area.name}`)
    );
  }

  const promises = flatMap(areaSetup.placements, (placement) => {
    const frameRole = managedGuild.frameCharacterRoles.get(
      placement.frameCharacter.name
    );
    if (!frameRole) {
      return Promise.reject(
        new Error(
          `No role for frame character ${placement.frameCharacter.name}`
        )
      );
    }
    const innerRole = managedGuild.innerCharacterRoles.get(
      placement.innerCharacter.name
    );
    if (!innerRole) {
      return Promise.reject(
        new Error(
          `No role for inner character ${placement.innerCharacter.name}`
        )
      );
    }

    return [placeCharacter(channel, frameRole, innerRole, managedGuild.game)];
  });

  return Promise.all(promises);
}

export function prepScene(managedGuild: ManagedGuild, scene: Scene) {
  return Promise.all<any>([
    setGameScene(managedGuild, scene),
    ...(scene.areaSetups ?? []).map((areaSetup) =>
      setupArea(managedGuild, areaSetup)
    ),
  ]);
}

export async function prepNextScene(managedGuild: ManagedGuild) {
  const currentScene = await getGameScene(managedGuild, managedGuild.game);
  if (currentScene == null) {
    throw new Error("There is no active scene right now.");
  }

  const nextScene =
    managedGuild.game.scenes[
      managedGuild.game.scenes.findIndex(
        (scene) => scene.name === currentScene.name
      ) + 1
    ];
  if (nextScene == null) {
    throw new Error("This is the last scene in the game.");
  }

  await prepScene(managedGuild, nextScene);
  return nextScene;
}

export function getFrameCharacterRoles(member: GuildMember, game: Game) {
  return member.roles.cache
    .array()
    .filter((role) => game.frameCharacterNames.includes(role.name));
}

export async function getAvailableChoicesForMember(
  managedGuild: ManagedGuild,
  member: GuildMember
) {
  const currentScene = await getGameScene(managedGuild, managedGuild.game);
  if (currentScene == null) {
    throw new Error(
      "Choices can only be made in a scene, and the game currently isn't in one"
    );
  }

  const frameCharacterRoles = getFrameCharacterRoles(member, managedGuild.game);
  const area = findAreaForFrameCharacter(frameCharacterRoles, currentScene);
  const availableChoiceVariables = await getSceneChoices(
    managedGuild,
    managedGuild.game,
    currentScene,
    { area }
  );

  return flatMap(availableChoiceVariables, (variable) =>
    variable.choices.map((choice) => ({
      variable,
      value: choice.value,
      label: choice.label,
    }))
  );
}

export async function makeChoice(
  managedGuild: ManagedGuild,
  member: GuildMember,
  args: string
) {
  const availableChoices = await getAvailableChoicesForMember(
    managedGuild,
    member
  );
  if (availableChoices.length === 0) {
    throw new Error("You don't have any choices available right now.");
  }

  const choiceHelp = `Here are your options:\n${availableChoices
    .map((choice) => `${choice.value}: ${choice.label}`)
    .join("\n")}\n\nTo choose one, say something like "!choose ${
    availableChoices[0].value
  }".`;

  const choiceArg = args;
  if (choiceArg === "") {
    throw new Error(`Please specify a choice.  ${choiceHelp}`);
  }

  const choice = availableChoices.find(
    (choiceValue) => choiceValue.value === choiceArg
  );
  if (choice == null) {
    throw new Error(
      `${choiceArg} is not a valid choice right now.  ${choiceHelp}`
    );
  }

  await setGameVariableValue(managedGuild, choice.variable, choice.value);
  return choice;
}
