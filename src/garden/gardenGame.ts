import { getVariableValue } from '../engine/gameLogic';
import { ManagedGuild } from '../engine/managedGuild';
import { Game } from '../engine/game';
import { areas, GardenArea } from './areas';
import {
  frameCharacters,
  frameCharacterType,
  innerCharacters,
  innerCharacterType,
} from './characters';
import { scenes } from './scenes';
import { GardenVariable, GardenVariableId } from './variables';
import { postPrepGardenScene } from './postPrep';
import { choose } from './commands';

export const gardenGame: Game<GardenVariable> = {
  areaNames: Object.keys(areas),
  areas: new Map(Object.entries(areas)),
  characterTypes: new Map([
    ['frame', frameCharacterType],
    ['inner', innerCharacterType],
  ]),
  characters: new Map([...Object.entries(frameCharacters), ...Object.entries(innerCharacters)]),
  commandHandlers: {
    choose,
  },
  globalVariables: new Map(),
  postPrepScene: postPrepGardenScene,
  sceneNames: scenes.map((scene) => scene.name),
  scenes,
};

export async function getGardenVar(
  managedGuild: ManagedGuild,
  variableId: GardenVariableId,
  area: GardenArea,
) {
  return await getVariableValue(managedGuild, gardenGame, { variableId, scope: 'area' }, { area });
}
