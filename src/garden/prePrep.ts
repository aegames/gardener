import { ManagedGuild } from '../engine/managedGuild';
import { GardenArea } from './areas';
import { GardenInnerScene, GardenScene, isInnerScene } from './scenes';
import {
  buildVariant,
  existingVariants,
  getEffectiveVariableValues,
  getVariantVariableIdsForScene,
} from './timelineVariants';
import { GardenVariableId } from './variables';

async function assertVariablesSet(
  managedGuild: ManagedGuild,
  area: GardenArea,
  ...variableIds: ['barbaraSpouse', ...GardenVariableId[]]
) {
  const variableValues = await getEffectiveVariableValues(managedGuild, area, variableIds);
  const missingVariableIds = variableIds.filter(
    (variableId, index) => variableValues[index] == null,
  );
  if (missingVariableIds.length > 0) {
    const missingVariableDescriptions = missingVariableIds.map((variableId) => {
      const variable = area.variables[variableId];
      if (variable?.type === 'choice') {
        return `${variableId} [${variable.choices
          .map((choice) => `${choice.value}: ${choice.label}`)
          .join(', ')}]`;
      } else {
        return variableId;
      }
    });
    throw new Error(`${area.name} has no value for ${missingVariableDescriptions.join(', ')}`);
  }
  return variableValues;
}

function assertVariantExists(scene: GardenInnerScene, variant: string) {
  const existingVariantsForScene = existingVariants[scene.name];
  if (!existingVariantsForScene.includes(variant)) {
    throw new Error(`${scene.name} has no variant for ${variant}.  Try using \`!collapse\`.`);
  }
}

export async function prePrepGardenScene(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
) {
  if (isInnerScene(scene)) {
    const variantVariableIds = await getVariantVariableIdsForScene(managedGuild, scene, area);
    if (variantVariableIds) {
      await assertVariablesSet(managedGuild, area, ...variantVariableIds);
      const variant = await buildVariant(managedGuild, area, variantVariableIds);
      assertVariantExists(scene, variant);
    }
  }
}
