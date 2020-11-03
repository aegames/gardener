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

export type AreaSetup<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>
> = {
  area: AreaType;
  scene: Scene<VariableType, AreaType>;
  placements: Placement[];
};

export type Scene<VariableType extends GameVariableBase, AreaType extends Area<VariableType>> = {
  name: string;
  characterType: CharacterType;
  areaSetups: AreaSetup<VariableType, AreaType>[];
};

export type Game<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
> = {
  areas: Map<string, AreaType>;
  characters: Map<string, Character>;
  characterTypes: Map<string, CharacterType>;
  commandHandlers: Dictionary<CommandHandler<VariableType, AreaType, SceneType>>;
  gmChannelName: string;
  gmRoleName: string;
  globalVariables: Map<string, VariableType>;
  prePrepScene?: (managedGuild: ManagedGuild, scene: SceneType, area: AreaType) => Promise<void>;
  postPrepScene?: (managedGuild: ManagedGuild, scene: SceneType, area: AreaType) => Promise<void>;
  scenes: SceneType[];
  sceneNames: string[];
  title: string;
};

export function findAreaForPrimaryCharacter<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
>(character: Character, scene: SceneType) {
  return scene.areaSetups.find((areaSetup) =>
    areaSetup.placements.some((placement) => character.name === placement.primaryCharacter.name),
  )?.area;
}
