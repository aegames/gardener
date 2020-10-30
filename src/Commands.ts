import { GuildChannel, GuildMember, OverwriteResolvable, Role } from 'discord.js';
import { flatMap, flatten } from 'lodash';
import { getGameScene, setGameScene, setGameVariableValue } from './database';
import { Area, AreaSetup, findAreaForFrameCharacter, Game, getSceneChoices, Scene } from './game';
import type { ManagedGuild } from './managedGuild';
import { notEmpty } from './utils';

async function placeCharacter(
  voiceChannel: GuildChannel,
  frameRole: Role,
  innerRole: Role,
  game: Game,
) {
  if (frameRole.members.size === 0) {
    console.warn(`No player for ${frameRole.name}`);
  }

  const promises = frameRole.members.array().map(async (member) => {
    const extraRoles = member.roles.cache.filter(
      (role) => game.innerCharacterNames.includes(role.name) && role.name !== innerRole.name,
    );

    console.log(
      `Giving ${member.user.tag} ${innerRole.name}, moving to ${voiceChannel.name}${
        extraRoles.size > 0 ? `removing ${extraRoles.map((role) => role.name).join(', ')}` : ''
      }`,
    );

    await Promise.all([
      member.roles.add(innerRole),
      ...extraRoles.map((role) => member.roles.remove(role)),
    ]);

    try {
      await member.voice.setChannel(voiceChannel);
      return { member, voiceChannelJoined: true };
    } catch (error) {
      return { member, voiceChannelJoined: false, voiceChannelJoinError: error };
    }
  });

  return await Promise.all(promises);
}

async function setupArea(managedGuild: ManagedGuild, areaSetup: AreaSetup) {
  const voiceChannel = managedGuild.areaVoiceChannels.get(areaSetup.area.name);
  const textChannel = managedGuild.areaTextChannels.get(areaSetup.area.name);
  if (!voiceChannel || !textChannel) {
    return Promise.reject(
      new Error(`Missing voice or text channel for area ${areaSetup.area.name}`),
    );
  }

  const frameRoles = areaSetup.placements
    .map((placement) => managedGuild.frameCharacterRoles.get(placement.frameCharacter.name))
    .filter(notEmpty);

  const permissionOverwrites: OverwriteResolvable[] = [
    { id: managedGuild.guild.id, deny: ['VIEW_CHANNEL'] },
    ...frameRoles.map((role) => ({ id: role.id, allow: ['VIEW_CHANNEL'] as const })),
  ];

  await Promise.all([
    textChannel.overwritePermissions(permissionOverwrites),
    voiceChannel.overwritePermissions(permissionOverwrites),
  ]);

  const placementPromises = flatMap(areaSetup.placements, (placement) => {
    const frameRole = managedGuild.frameCharacterRoles.get(placement.frameCharacter.name);
    if (!frameRole) {
      return Promise.reject(
        new Error(`No role for frame character ${placement.frameCharacter.name}`),
      );
    }
    const innerRole = managedGuild.innerCharacterRoles.get(placement.innerCharacter.name);
    if (!innerRole) {
      return Promise.reject(
        new Error(`No role for inner character ${placement.innerCharacter.name}`),
      );
    }

    return [placeCharacter(voiceChannel, frameRole, innerRole, managedGuild.game)];
  });

  const placementResults = await Promise.all(placementPromises);
  return { area: areaSetup.area, placementResults: flatten(placementResults) };
}

export type PrepSceneResults = {
  scene: Scene;
  areaSetupResults: {
    area: Area;
    placementResults: {
      member: GuildMember;
      voiceChannelJoined: boolean;
      voiceChannelJoinError?: Error;
    }[];
  }[];
};

export async function prepScene(
  managedGuild: ManagedGuild,
  scene: Scene,
): Promise<PrepSceneResults> {
  await setGameScene(managedGuild, scene);
  const areaSetupResults = await Promise.all(
    (scene.areaSetups ?? []).map((areaSetup) => setupArea(managedGuild, areaSetup)),
  );
  return { scene, areaSetupResults };
}

export async function prepNextScene(managedGuild: ManagedGuild) {
  const currentScene = await getGameScene(managedGuild, managedGuild.game);
  if (currentScene == null) {
    throw new Error('There is no active scene right now.');
  }

  const nextScene =
    managedGuild.game.scenes[
      managedGuild.game.scenes.findIndex((scene) => scene.name === currentScene.name) + 1
    ];
  if (nextScene == null) {
    throw new Error('This is the last scene in the game.');
  }

  return await prepScene(managedGuild, nextScene);
}

export function getFrameCharacterRoles(member: GuildMember, game: Game) {
  return member.roles.cache.array().filter((role) => game.frameCharacterNames.includes(role.name));
}

export async function getAvailableChoicesForMember(
  managedGuild: ManagedGuild,
  member: GuildMember,
) {
  const currentScene = await getGameScene(managedGuild, managedGuild.game);
  if (currentScene == null) {
    throw new Error("Choices can only be made in a scene, and the game currently isn't in one");
  }

  const frameCharacterRoles = getFrameCharacterRoles(member, managedGuild.game);
  const area = findAreaForFrameCharacter(frameCharacterRoles, currentScene);
  const availableChoiceVariables = await getSceneChoices(
    managedGuild,
    managedGuild.game,
    currentScene,
    { area },
  );

  return flatMap(availableChoiceVariables, (variable) =>
    variable.choices.map((choice) => ({
      variable,
      value: choice.value,
      label: choice.label,
    })),
  );
}

export async function makeChoice(managedGuild: ManagedGuild, member: GuildMember, args: string) {
  const availableChoices = await getAvailableChoicesForMember(managedGuild, member);
  if (availableChoices.length === 0) {
    throw new Error("You don't have any choices available right now.");
  }

  const choiceHelp = `Here are your options:\n${availableChoices
    .map((choice) => `${choice.value}: ${choice.label}`)
    .join('\n')}\n\nTo choose one, say something like "!choose ${availableChoices[0].value}".`;

  const choiceArg = args;
  if (choiceArg === '') {
    throw new Error(`Please specify a choice.  ${choiceHelp}`);
  }

  const choice = availableChoices.find((choiceValue) => choiceValue.value === choiceArg);
  if (choice == null) {
    throw new Error(`${choiceArg} is not a valid choice right now.  ${choiceHelp}`);
  }

  await setGameVariableValue(managedGuild, choice.variable, choice.value);
  return choice;
}
