import { GuildChannel, Role } from "discord.js";
import { flatMap } from "lodash";
import { AreaSetup, Game, Scene } from "./Game";
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
  return Promise.all(
    (scene.areaSetups ?? []).map((areaSetup) =>
      setupArea(managedGuild, areaSetup)
    )
  );
}
