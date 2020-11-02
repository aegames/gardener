import { GardenArea } from './areas';
import { GardenScene } from './scenes';
import path from 'path';
import fs from 'fs';
import { MessageAttachment, MessageEmbed, TextChannel } from 'discord.js';
import { ManagedGuild } from '../engine/managedGuild';
import { gardenGame, getGardenVars } from './gardenGame';
import { ChoiceVariable, GardenVariableId } from './variables';
import { innerCharacterType } from './characters';
import { getSceneChoices } from './choices';
import { flatMap, flatten } from 'lodash';

function getInnerCharacterSheetFilenames(sceneFilenamePortion: string, characterNames: string[]) {
  return characterNames.map((characterName) =>
    path.join(
      __dirname,
      'inner-character-packets',
      characterName,
      `${characterName} - ${sceneFilenamePortion}.pdf`,
    ),
  );
}

async function getEffectiveVariableValues(
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

async function buildVariant(
  managedGuild: ManagedGuild,
  area: GardenArea,
  variableIds: ['barbaraSpouse', ...GardenVariableId[]],
) {
  const effectiveValues = await getEffectiveVariableValues(managedGuild, area, variableIds);
  return `(${effectiveValues.join('')})`;
}

function describeChoiceValue(variable: ChoiceVariable, value: string) {
  const choice = variable.choices.find((choice) => choice.value === value);
  if (!choice) {
    return `${value}: Unrecognized choice value`;
  }

  return `${choice.value}: ${choice.label}`;
}

async function sendInnerSceneMaterials(
  managedGuild: ManagedGuild,
  channel: TextChannel,
  scene: GardenScene,
  area: GardenArea,
  sceneFilenamePortion: string,
  characterNames: string[],
) {
  const sceneIntro = fs.readFileSync(
    path.join(__dirname, 'scene-intros', `${sceneFilenamePortion}.md`),
    'utf-8',
  );
  const sceneIndex = gardenGame.scenes.findIndex((otherScene) => otherScene.name === scene.name);
  const priorScenes = gardenGame.scenes.slice(0, sceneIndex) as GardenScene[];
  const priorChoices = flatten(
    await Promise.all(
      priorScenes.map((priorScene) => getSceneChoices(managedGuild, priorScene, area)),
    ),
  );
  const priorChoiceValues = await getGardenVars(
    managedGuild,
    area,
    ...priorChoices.map((choiceVariable) => choiceVariable.id),
  );
  const priorChoiceText = priorChoices
    .map(
      (choiceVariable, index) =>
        `_${describeChoiceValue(choiceVariable, priorChoiceValues[index])}_`,
    )
    .join('\n');

  const currentChoices = await getSceneChoices(managedGuild, scene, area);
  const currentChoiceText = flatMap(currentChoices, (choiceVariable) =>
    choiceVariable.choices.map((choice) => describeChoiceValue(choiceVariable, choice.value)),
  );

  const embed = new MessageEmbed()
    .setColor(0x0099ff)
    .setDescription(sceneIntro)
    .setTitle(scene.name)
    .addFields(
      { name: 'Choices so far', value: priorChoiceText, inline: true },
      { name: 'Choices for this scene', value: currentChoiceText, inline: true },
    )
    .attachFiles(
      getInnerCharacterSheetFilenames(sceneFilenamePortion, characterNames).map(
        (filename) => new MessageAttachment(filename),
      ),
    );

  await channel.send(embed);
}

async function sendInnerSceneMaterialsWithVariant(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
  variantVariableIds: ['barbaraSpouse', ...GardenVariableId[]],
  characterNames: string[],
) {
  const channel = managedGuild.areaTextChannels.get(area.name)!;
  const variant = await buildVariant(managedGuild, area, variantVariableIds);
  await sendInnerSceneMaterials(
    managedGuild,
    channel,
    scene,
    area,
    `${scene.name} ${variant}`,
    characterNames,
  );
}

const act1Characters = ['Barbara', 'Charles', 'William', 'Virginia'];
const act2Part1Characters = ['Barbara', 'Charles', 'William', 'Stephanie'];
const act2Part2Characters = ['Barbara', 'Charles', 'Zach', 'Stephanie'];

export async function postPrepGardenScene(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
) {
  if (scene.name === 'Act I Scene 1') {
    await sendInnerSceneMaterials(
      managedGuild,
      managedGuild.areaTextChannels.get(area.name)!,
      scene,
      area,
      scene.name,
      act1Characters,
    );
  } else if (scene.name === 'Act I Scene 2') {
    await sendInnerSceneMaterialsWithVariant(
      managedGuild,
      scene,
      area,
      ['barbaraSpouse'],
      act1Characters,
    );
  } else if (scene.name === 'Act I Scene 3') {
    await sendInnerSceneMaterialsWithVariant(
      managedGuild,
      scene,
      area,
      ['barbaraSpouse', 'barbaraCheated', 'spouseCheated'],
      act1Characters,
    );
  } else if (scene.name === 'Act I Scene 4') {
    await sendInnerSceneMaterialsWithVariant(
      managedGuild,
      scene,
      area,
      ['barbaraSpouse', 'divorce'],
      act1Characters,
    );
  } else if (scene.name === 'Act II Scene 1') {
    const [barbaraSpouse, barbaraCheated] = await getEffectiveVariableValues(managedGuild, area, [
      'barbaraSpouse',
      'barbaraCheated',
    ]);
    const variant = barbaraSpouse === 'A' ? (barbaraCheated === 'C' ? 'ACFHI' : 'ADEHJ') : 'BGI';
    await sendInnerSceneMaterials(
      managedGuild,
      managedGuild.areaTextChannels.get(area.name)!,
      scene,
      area,
      `${scene.name} (${variant})`,
      act2Part1Characters,
    );
  } else if (scene.name === 'Act II Scene 2') {
    await sendInnerSceneMaterialsWithVariant(
      managedGuild,
      scene,
      area,
      ['barbaraSpouse', 'divorce', 'brotherLentMoney'],
      act2Part1Characters,
    );
  } else if (scene.name === 'Act II Scene 3') {
    await sendInnerSceneMaterialsWithVariant(
      managedGuild,
      scene,
      area,
      ['barbaraSpouse', 'divorce', 'drunkDrivingConsequences'],
      act2Part2Characters,
    );
  } else if (scene.name === 'Act II Scene 4') {
    await sendInnerSceneMaterialsWithVariant(
      managedGuild,
      scene,
      area,
      ['barbaraSpouse', 'divorce', 'virginiaNursingHome', 'drunkDrivingConsequences', 'acceptZach'],
      act2Part2Characters,
    );
  }

  if (scene.characterType.name === innerCharacterType.name) {
  }
}
