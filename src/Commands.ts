import { GuildChannel, GuildMember, OverwriteResolvable, Role, TextChannel } from 'discord.js';
import { flatMap, flatten } from 'lodash';
import { getGameScene, setGameScene } from './database';
import { Area, AreaSetup, Game, GameVariableBase, Scene } from './game';
import { loadRolesForGuild, ManagedGuild } from './managedGuild';
import { notEmpty } from './utils';

export type PlacementResult = {
  member: GuildMember;
  nicknameChanged: boolean;
  nicknameChangeError?: Error;
  voiceChannelJoined: boolean;
  voiceChannelJoinError?: Error;
};

async function placeCharacter<VariableType extends GameVariableBase>(
  voiceChannel: GuildChannel,
  primaryRole: Role,
  secondaryRole: Role | undefined,
  game: Game<VariableType>,
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

    const result: PrepSceneResults<VariableType>['areaSetupResults'][0]['placementResults'][0] = {
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

async function setupArea(managedGuild: ManagedGuild, areaSetup: AreaSetup<any>) {
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

export type PrepSceneResults<VariableType extends GameVariableBase> = {
  scene: Scene<VariableType>;
  areaSetupResults: {
    area: Area<VariableType>;
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

export async function prepScene<VariableType extends GameVariableBase>(
  managedGuild: ManagedGuild,
  scene: Scene<VariableType>,
): Promise<PrepSceneResults<VariableType>> {
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
      managedGuild.areaTextChannels
        .get(area.name)!
        .send(`__**${scene.name}**__`)
        .then(() => {
          if (managedGuild.game.postPrepScene) {
            return managedGuild.game.postPrepScene(managedGuild, scene, area);
          }
        }),
    ),
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

export function getPrimaryCharacterRole(member: GuildMember, game: Game<any>) {
  return member.roles.cache.array().find((role) => game.characters.get(role.name)?.type.primary);
}
