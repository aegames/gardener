import { GuildChannel, GuildMember, OverwriteResolvable, Role, TextChannel } from 'discord.js';
import { flatMap, flatten } from 'lodash';
import { setGameScene } from './database';
import { Area, AreaSetup, Game, GameVariableBase, Scene } from './game';
import { loadRolesForGuild, ManagedGuild } from './managedGuild';
import { notEmpty } from '../utils';
import logger from './logger';

export type PlacementResult = {
  member: GuildMember;
  nicknameChanged: boolean;
  nicknameChangeError?: Error;
  voiceChannelJoined: boolean;
  voiceChannelJoinError?: Error;
};

async function placeCharacter<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
>(
  voiceChannel: GuildChannel,
  primaryRole: Role,
  secondaryRole: Role | undefined,
  game: Game<VariableType, AreaType, SceneType>,
): Promise<PlacementResult[]> {
  if (primaryRole.members.size === 0) {
    logger.verbose(`No player for ${primaryRole.name}`);
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

    logger.verbose(
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

    const result: PrepSceneResults<
      VariableType,
      AreaType,
      SceneType
    >['areaSetupResults'][0]['placementResults'][0] = {
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

async function lockArea(managedGuild: ManagedGuild, area: Area<any>) {
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

async function setupArea<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
>(
  managedGuild: ManagedGuild,
  game: Game<VariableType, AreaType, SceneType>,
  areaSetup: AreaSetup<VariableType, AreaType>,
) {
  const voiceChannel = managedGuild.areaVoiceChannels.get(areaSetup.area.name);
  const textChannel = managedGuild.areaTextChannels.get(areaSetup.area.name);
  if (!voiceChannel || !textChannel) {
    return Promise.reject(
      new Error(`Missing voice or text channel for area ${areaSetup.area.name}`),
    );
  }

  // Refresh roles in case they changed
  await loadRolesForGuild(managedGuild, game);

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

      return [placeCharacter(voiceChannel, primaryRole, secondaryRole, game)];
    } else {
      return [placeCharacter(voiceChannel, primaryRole, undefined, game)];
    }
  });

  const placementResults = await Promise.all(placementPromises);
  return { area: areaSetup.area, placementResults: flatten(placementResults) };
}

export type PrepSceneResults<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
> = {
  scene: SceneType;
  areaSetupResults: {
    area: AreaType;
    placementResults: PlacementResult[];
  }[];
};

export async function sendLongMessage(channel: TextChannel, content: string) {
  const paragraphs = content.split('\n\n').filter((paragraph) => paragraph.trim() !== '');
  return await paragraphs.reduce(
    (promise, paragraph) => promise.then(() => channel.send(paragraph)),
    Promise.resolve(),
  );
}

export async function sendFiles(channel: TextChannel, files: string[]) {
  return await channel.send({ files });
}

export async function prepScene<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
>(
  managedGuild: ManagedGuild,
  game: Game<VariableType, AreaType, SceneType>,
  scene: SceneType,
): Promise<PrepSceneResults<VariableType, AreaType, SceneType>> {
  const areaSetups = scene.areaSetups ?? [];
  const activeAreas = areaSetups.map((areaSetup) => areaSetup.area);
  const areaNames = new Set(activeAreas.map((area) => area.name));
  const unusedAreas = [...game.areas.values()].filter((area) => !areaNames.has(area.name));
  const { prePrepScene, postPrepScene } = game;
  if (prePrepScene) {
    const prePrepResults = await Promise.allSettled(
      activeAreas.map((area) => prePrepScene(managedGuild, scene, area)),
    );
    const prePrepErrors = prePrepResults
      .map((result) => (result.status === 'rejected' ? result.reason.message : undefined))
      .filter(notEmpty);
    if (prePrepErrors.length > 0) {
      throw new Error(`Can't prep ${scene.name}:\n${prePrepErrors.join('\n')}`);
    }
  }

  await setGameScene(managedGuild, scene);
  const areaSetupResults = await Promise.all<any>([
    ...areaSetups.map((areaSetup) => setupArea(managedGuild, game, areaSetup)),
    ...unusedAreas.map((area) => lockArea(managedGuild, area)),
  ]);

  await Promise.all(
    activeAreas.map((area) =>
      managedGuild.areaTextChannels.get(area.name)!.send(`__**${scene.name}**__`),
    ),
  );

  if (postPrepScene) {
    await Promise.all(activeAreas.map((area) => postPrepScene(managedGuild, scene, area)));
  }

  return { scene, areaSetupResults };
}

export function getMemberCharacters(member: GuildMember, game: Game<any, any, any>) {
  return member.roles.cache
    .array()
    .map((role) => game.characters.get(role.name))
    .filter(notEmpty);
}

export function getPrimaryCharacter(member: GuildMember, game: Game<any, any, any>) {
  return getMemberCharacters(member, game).find((character) => character.type.primary);
}
