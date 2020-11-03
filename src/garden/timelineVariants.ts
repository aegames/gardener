import levenshtein from 'fast-levenshtein';
import { sortBy } from 'lodash';
import { ManagedGuild } from '../engine/managedGuild';
import { GardenArea } from './areas';
import { getGardenVars } from './gardenGame';
import { GardenInnerScene, GardenInnerSceneName, GardenScene } from './scenes';
import { GardenVariableId } from './variables';

export async function getEffectiveVariableValues(
  managedGuild: ManagedGuild,
  area: GardenArea,
  variableIds: ['barbaraSpouse', ...GardenVariableId[]],
) {
  const variableValues = await getGardenVars(managedGuild, area, ...variableIds);
  const barbaraSpouseValue = variableValues[0];
  const effectiveValues = variableIds.map((variableId, index) => {
    const value = variableValues[index];
    if (variableId === 'spouseCheated') {
      // William never cheats; if Barbara married William the spouseCheated value is always F
      return barbaraSpouseValue === 'B' ? 'F' : value;
    }

    return value;
  });
  return effectiveValues;
}

export async function buildVariant(
  managedGuild: ManagedGuild,
  area: GardenArea,
  variableIds: ['barbaraSpouse', ...GardenVariableId[]],
) {
  const effectiveValues = await getEffectiveVariableValues(managedGuild, area, variableIds);
  return effectiveValues.join('');
}

export async function getVariantVariableIdsForScene(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
): Promise<['barbaraSpouse', ...GardenVariableId[]] | undefined> {
  if (scene.name === 'Act I Scene 2') {
    return ['barbaraSpouse'];
  } else if (scene.name === 'Act I Scene 3') {
    return ['barbaraSpouse', 'barbaraCheated', 'spouseCheated'];
  } else if (scene.name === 'Act I Scene 4') {
    return ['barbaraSpouse', 'divorce'];
  } else if (scene.name === 'Act II Scene 1') {
    const [barbaraSpouse] = await getEffectiveVariableValues(managedGuild, area, ['barbaraSpouse']);
    if (barbaraSpouse === 'B') {
      // Timeline collapse makes the cheating variables irrelevant in the William timeline
      return ['barbaraSpouse', 'divorce', 'virginiaNursingHome'];
    } else {
      return ['barbaraSpouse', 'barbaraCheated', 'spouseCheated', 'divorce', 'virginiaNursingHome'];
    }
  } else if (scene.name === 'Act II Scene 2') {
    return ['barbaraSpouse', 'divorce', 'brotherLentMoney'];
  } else if (scene.name === 'Act II Scene 3') {
    return ['barbaraSpouse', 'divorce', 'drunkDrivingConsequences'];
  } else if (scene.name === 'Act II Scene 4') {
    return [
      'barbaraSpouse',
      'divorce',
      'virginiaNursingHome',
      'drunkDrivingConsequences',
      'acceptZach',
    ];
  }

  return undefined;
}

export async function buildVariantForScene(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
) {
  const variableIds = await getVariantVariableIdsForScene(managedGuild, scene, area);
  if (!variableIds) {
    return undefined;
  }

  return await buildVariant(managedGuild, area, variableIds);
}

export const existingVariants: Record<GardenInnerSceneName, string[]> = {
  'Act I Scene 1': [],
  'Act I Scene 2': ['A', 'B'],
  'Act I Scene 3': ['ACE', 'ACF', 'ADE', 'ADF', 'BCF', 'BDF'],
  'Act I Scene 4': ['AG', 'AH', 'BG', 'BH'],
  'Act II Scene 1': ['ACFHI', 'ADEHJ', 'BGI'],
  'Act II Scene 2': ['AHK', 'AHL', 'BGK', 'BGL'],
  'Act II Scene 3': ['AHM', 'AHN', 'BGM', 'BGN'],
  'Act II Scene 4': ['AHINO', 'AHINP', 'AHJMO', 'AHJMP', 'BGIMO', 'BGINP'],
};

export function findClosestExistingVariant(scene: GardenInnerScene, variant: string) {
  const existingVariantsForScene = existingVariants[scene.name];
  const editDistances = existingVariantsForScene.map(
    (existingVariant) => [existingVariant, levenshtein.get(variant, existingVariant)] as const,
  );
  const [closestVariant] = sortBy(editDistances, ([existingVariant, distance]) => distance)[0];
  return closestVariant;
}
