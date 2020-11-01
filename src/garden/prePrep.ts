import logger from '../engine/logger';
import { ManagedGuild } from '../engine/managedGuild';
import { GardenArea } from './areas';
import { getGardenVars } from './gardenGame';
import { GardenScene } from './scenes';
import { GardenVariableId } from './variables';

async function assertVariablesSet(
  managedGuild: ManagedGuild,
  area: GardenArea,
  ...variableIds: GardenVariableId[]
) {
  const variableValues = await getGardenVars(managedGuild, area, ...variableIds);
  const missingVariableIds = variableIds.filter(
    (variableId, index) => variableValues[index] == null,
  );
  if (missingVariableIds.length > 0) {
    throw new Error(`${area.name} has no value for ${missingVariableIds.join(', ')}`);
  }
  return variableValues;
}

export async function prePrepGardenScene(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
) {
  if (scene.name === 'Act I Scene 2') {
    await assertVariablesSet(managedGuild, area, 'barbaraSpouse');
  } else if (scene.name === 'Act I Scene 3') {
    const [barbaraSpouse] = await assertVariablesSet(
      managedGuild,
      area,
      'barbaraSpouse',
      'barbaraCheated',
    );
    if (barbaraSpouse === 'A') {
      await assertVariablesSet(managedGuild, area, 'spouseCheated');
    }
  } else if (scene.name === 'Act I Scene 4') {
    await assertVariablesSet(managedGuild, area, 'barbaraSpouse', 'divorce');
  } else if (scene.name === 'Act II Scene 1') {
    await assertVariablesSet(
      managedGuild,
      area,
      'barbaraSpouse',
      'barbaraCheated',
      'divorce',
      'virginiaNursingHome',
    );
  } else if (scene.name === 'Act II Scene 2') {
    await assertVariablesSet(
      managedGuild,
      area,
      'barbaraSpouse',
      'barbaraCheated',
      'divorce',
      'virginiaNursingHome',
      'brotherLentMoney',
    );
  } else if (scene.name === 'Act II Scene 3') {
    await assertVariablesSet(
      managedGuild,
      area,
      'barbaraSpouse',
      'barbaraCheated',
      'divorce',
      'virginiaNursingHome',
      'brotherLentMoney',
      'drunkDrivingConsequences',
    );
  } else if (scene.name === 'Act II Scene 4') {
    await assertVariablesSet(
      managedGuild,
      area,
      'barbaraSpouse',
      'barbaraCheated',
      'divorce',
      'virginiaNursingHome',
      'brotherLentMoney',
      'drunkDrivingConsequences',
      'acceptZach',
    );
  }
}
