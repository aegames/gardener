import { Role } from 'discord.js';
import { Dictionary } from 'lodash';
import { CommandHandler } from './commandHandlers';
import { ManagedGuild } from './managedGuild';

export type GameVariableBase = {
  id: string;
  type: string; // each variable type should specify a literal for this
  scope: string;
};

export type Area<VariableType extends GameVariableBase> = {
  name: string;
  textChannelName: string;
  voiceChannelName: string;
  variables: Partial<Record<VariableType['id'], VariableType>>;
};

export type CharacterType = {
  name: string;
  primary: boolean;
};

export type Character = {
  name: string;
  type: CharacterType;
  defaultPrimaryCharacters: Character[];
  defaultSecondaryCharacter?: Character;
};

export type Placement = {
  primaryCharacter: Character;
  secondaryCharacter?: Character;
};

export type AreaSetup<VariableType extends GameVariableBase> = {
  area: Area<VariableType>;
  scene: Scene<VariableType>;
  placements: Placement[];
};

export type Scene<VariableType extends GameVariableBase> = {
  name: string;
  characterType: CharacterType;
  areaSetups: AreaSetup<VariableType>[];
};

export type Game<VariableType extends GameVariableBase> = {
  areas: Map<string, Area<VariableType>>;
  characters: Map<string, Character>;
  characterTypes: Map<string, CharacterType>;
  commandHandlers: Dictionary<CommandHandler<VariableType>>;
  gmChannelName: string;
  gmRoleName: string;
  globalVariables: Map<string, VariableType>;
  prePrepScene?: (
    managedGuild: ManagedGuild,
    scene: Scene<VariableType>,
    area: Area<VariableType>,
  ) => Promise<void>;
  postPrepScene?: (
    managedGuild: ManagedGuild,
    scene: Scene<VariableType>,
    area: Area<VariableType>,
  ) => Promise<void>;
  scenes: Scene<VariableType>[];
  sceneNames: string[];
};

export function findAreaForPrimaryCharacter<VariableType extends GameVariableBase>(
  character: Character,
  scene: Scene<VariableType>,
) {
  return scene.areaSetups.find((areaSetup) =>
    areaSetup.placements.some((placement) => character.name === placement.primaryCharacter.name),
  )?.area;
}
