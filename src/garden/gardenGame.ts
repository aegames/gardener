import { getVariableValue, getVariableValues, setVariableValue } from '../engine/gameLogic';
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
import { prePrepGardenScene } from './prePrep';
import { commonCommandHandlers } from '../engine/commandHandlers';

export const gardenGame: Game<GardenVariable> = {
  areas: new Map(Object.entries(areas)),
  characterTypes: new Map([
    ['frame', frameCharacterType],
    ['inner', innerCharacterType],
  ]),
  characters: new Map([...Object.entries(frameCharacters), ...Object.entries(innerCharacters)]),
  commandHandlers: {
    ...commonCommandHandlers,
    choose,
  },
  globalVariables: new Map(),
  gmChannelName: 'gmcentral',
  gmRoleName: 'GM',
  prePrepScene: prePrepGardenScene,
  postPrepScene: postPrepGardenScene,
  sceneNames: scenes.map((scene) => scene.name),
  scenes,
};

export async function getGardenVar(
  managedGuild: ManagedGuild,
  area: GardenArea,
  variableId: GardenVariableId,
) {
  return await getVariableValue(managedGuild, gardenGame, { area }, { variableId, scope: 'area' });
}

export async function getGardenVars(
  managedGuild: ManagedGuild,
  area: GardenArea,
  ...variableIds: GardenVariableId[]
) {
  return await getVariableValues(
    managedGuild,
    gardenGame,
    { area },
    ...variableIds.map((variableId) => ({ variableId, scope: 'area' as const })),
  );
}

export async function setGardenVar(
  managedGuild: ManagedGuild,
  area: GardenArea,
  variableId: GardenVariableId,
  value: any,
) {
  return await setVariableValue(
    managedGuild,
    gardenGame,
    { area },
    { variableId, scope: 'area' as const },
    value,
  );
}
