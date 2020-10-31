import assertNever from 'assert-never';
import { GuildChannel, GuildMember, OverwriteResolvable, Role, TextChannel } from 'discord.js';
import { flatMap, flatten } from 'lodash';
import { getGameScene, setGameScene, setGameVariableValue } from './database';
import {
  Action,
  Area,
  AreaSetup,
  findAreaForPrimaryCharacterRole,
  Game,
  getSceneChoices,
  Scene,
} from './game';
import { evaluateBooleanExpression } from './gameLogic';
import { loadRolesForGuild, ManagedGuild } from './managedGuild';
import { notEmpty } from './utils';

export type PlacementResult = {
  member: GuildMember;
  nicknameChanged: boolean;
  nicknameChangeError?: Error;
  voiceChannelJoined: boolean;
  voiceChannelJoinError?: Error;
};

async function placeCharacter(
  voiceChannel: GuildChannel,
  primaryRole: Role,
  secondaryRole: Role | undefined,
  game: Game,
): Promise<PlacementResult[]> {
  if (primaryRole.members.size === 0) {
    console.warn(`No player for ${primaryRole.name}`);
  }

  const promises = primaryRole.members.array().map(async (member) => {
    const rolesToAdd = secondaryRole ? [secondaryRole] : [];

    const rolesToRemove = member.roles.cache.filter((role) => {
      const character = game.characters.get(role.name);
      if (!character || character.type.primary) {
        // never remove a primary character role
        return false;
      }

      return !secondaryRole || role.name !== secondaryRole.name;
    });

    console.log(
      `Giving ${member.user.tag} ${rolesToAdd.map((role) => role.name).join(', ')}, moving to ${
        voiceChannel.name
      }${
        rolesToRemove.size > 0
          ? `, removing ${rolesToRemove.map((role) => role.name).join(', ')}`
          : ''
      }`,
    );

    await Promise.all([
      ...rolesToAdd.map((role) => member.roles.add(role)),
      ...rolesToRemove.map((role) => member.roles.remove(role)),
    ]);

    const result: PrepSceneResults['areaSetupResults'][0]['placementResults'][0] = {
      member,
      nicknameChanged: false,
      nicknameChangeError: undefined,
      voiceChannelJoined: false,
      voiceChannelJoinError: undefined,
    };

    try {
      await member.setNickname(
        secondaryRole ? `${secondaryRole.name} (${primaryRole.name})` : primaryRole.name,
      );
      result.nicknameChanged = true;
    } catch (error) {
      result.nicknameChangeError = error;
    }

    try {
      await member.voice.setChannel(voiceChannel);
      result.voiceChannelJoined = true;
    } catch (error) {
      result.voiceChannelJoinError = error;
    }

    return result;
  });

  return await Promise.all(promises);
}

async function lockArea(managedGuild: ManagedGuild, area: Area) {
  const voiceChannel = managedGuild.areaVoiceChannels.get(area.name);
  const textChannel = managedGuild.areaTextChannels.get(area.name);
  if (!voiceChannel || !textChannel) {
    return Promise.reject(new Error(`Missing voice or text channel for area ${area.name}`));
  }

  const permissionOverwrites: OverwriteResolvable[] = [
    { id: managedGuild.guild.id, deny: ['VIEW_CHANNEL'] },
  ];

  return await Promise.all([
    voiceChannel.overwritePermissions(permissionOverwrites),
    textChannel.overwritePermissions(permissionOverwrites),
  ]);
}

async function setupArea(managedGuild: ManagedGuild, areaSetup: AreaSetup) {
  const voiceChannel = managedGuild.areaVoiceChannels.get(areaSetup.area.name);
  const textChannel = managedGuild.areaTextChannels.get(areaSetup.area.name);
  if (!voiceChannel || !textChannel) {
    return Promise.reject(
      new Error(`Missing voice or text channel for area ${areaSetup.area.name}`),
    );
  }

  // Refresh roles in case they changed
  await loadRolesForGuild(managedGuild);

  const primaryRoles = areaSetup.placements
    .map((placement) => managedGuild.characterRoles.get(placement.primaryCharacter.name))
    .filter(notEmpty);

  const permissionOverwrites: OverwriteResolvable[] = [
    { id: managedGuild.guild.id, deny: ['VIEW_CHANNEL'] },
    ...primaryRoles.map((role) => ({ id: role.id, allow: ['VIEW_CHANNEL'] as const })),
  ];

  await Promise.all([
    textChannel.overwritePermissions(permissionOverwrites),
    voiceChannel.overwritePermissions(permissionOverwrites),
  ]);

  const placementPromises = flatMap(areaSetup.placements, (placement) => {
    const primaryRole = managedGuild.characterRoles.get(placement.primaryCharacter.name);
    if (!primaryRole) {
      return Promise.reject(
        new Error(`No role for frame character ${placement.primaryCharacter.name}`),
      );
    }
    if (placement.secondaryCharacter) {
      const secondaryRole = managedGuild.characterRoles.get(placement.secondaryCharacter.name);
      if (!secondaryRole) {
        return Promise.reject(
          new Error(`No role for inner character ${placement.secondaryCharacter.name}`),
        );
      }

      return [placeCharacter(voiceChannel, primaryRole, secondaryRole, managedGuild.game)];
    } else {
      return [placeCharacter(voiceChannel, primaryRole, undefined, managedGuild.game)];
    }
  });

  const placementResults = await Promise.all(placementPromises);
  return { area: areaSetup.area, placementResults: flatten(placementResults) };
}

export type PrepSceneResults = {
  scene: Scene;
  areaSetupResults: {
    area: Area;
    placementResults: PlacementResult[];
  }[];
};

async function sendLongMessage(channel: TextChannel, content: string) {
  const paragraphs = content.split('\n\n').filter((paragraph) => paragraph.trim() !== '');
  return await paragraphs.reduce(
    (promise, paragraph) => promise.then(() => channel.send(paragraph)),
    Promise.resolve(),
  );
}

async function sendFiles(channel: TextChannel, files: string[]) {
  return await channel.send({ files });
}

export async function executeAction(
  managedGuild: ManagedGuild,
  game: Game,
  action: Action,
  activeAreas: Area[],
) {
  if (action.scope === 'area') {
    const areaApplicability = await Promise.all(
      activeAreas.map(async (area) =>
        action.if
          ? ([
              area,
              await evaluateBooleanExpression(managedGuild, game, action.if, { area }),
            ] as const)
          : ([area, true] as const),
      ),
    );
    const applicableAreas = areaApplicability
      .filter(([, applicable]) => applicable)
      .map(([area]) => area);

    if (action.action === 'sendMessage') {
      return await Promise.all(
        applicableAreas.map((area) =>
          sendLongMessage(managedGuild.areaTextChannels.get(area.name)!, action.content),
        ),
      );
    } else if (action.action === 'sendFiles') {
      return await Promise.all(
        applicableAreas.map((area) =>
          sendFiles(managedGuild.areaTextChannels.get(area.name)!, action.files),
        ),
      );
    }

    assertNever(action);
  } else if (action.scope === 'global') {
    const applicable = action.if
      ? await evaluateBooleanExpression(managedGuild, game, action.if, {})
      : true;
    if (!applicable) {
      return;
    }

    if (action.action === 'sendMessage') {
      return await sendLongMessage(managedGuild.guild.systemChannel!, action.content);
    } else if (action.action === 'sendFiles') {
      return await sendFiles(managedGuild.guild.systemChannel!, action.files);
    }

    assertNever(action);
  }

  assertNever(action.scope);
}

export async function prepScene(
  managedGuild: ManagedGuild,
  scene: Scene,
): Promise<PrepSceneResults> {
  await setGameScene(managedGuild, scene);
  const areaSetups = scene.areaSetups ?? [];
  const activeAreas = areaSetups.map((areaSetup) => areaSetup.area);
  const areaNames = new Set(activeAreas.map((area) => area.name));
  const unusedAreas = [...managedGuild.game.areas.values()].filter(
    (area) => !areaNames.has(area.name),
  );
  const areaSetupResults = await Promise.all<any>([
    ...areaSetups.map((areaSetup) => setupArea(managedGuild, areaSetup)),
    ...unusedAreas.map((area) => lockArea(managedGuild, area)),
  ]);
  await Promise.all(
    activeAreas.map((area) =>
      managedGuild.areaTextChannels.get(area.name)!.send(`__**${scene.name}**__`),
    ),
  );
  await scene.actions.reduce(
    (promise, action) =>
      promise.then(() => executeAction(managedGuild, managedGuild.game, action, activeAreas)),
    Promise.resolve(),
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

export function getPrimaryCharacterRole(member: GuildMember, game: Game) {
  return member.roles.cache.array().find((role) => game.characters.get(role.name)?.type.primary);
}

export async function getAvailableChoicesForMember(
  managedGuild: ManagedGuild,
  member: GuildMember,
) {
  const currentScene = await getGameScene(managedGuild, managedGuild.game);
  if (currentScene == null) {
    throw new Error("Choices can only be made in a scene, and the game currently isn't in one");
  }

  const primaryRole = getPrimaryCharacterRole(member, managedGuild.game);
  if (!primaryRole) {
    throw new Error(
      "You don't have a primary character role assigned, so you can't make choices.  This is probably a mistake, please ask the GM about this.",
    );
  }

  const area = findAreaForPrimaryCharacterRole(primaryRole, currentScene);
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
