import { GardenArea, GardenInnerArea, isFrameArea, isInnerArea } from './areas';
import { GardenInnerScene, GardenScene, isFrameScene, isInnerScene } from './scenes';
import path from 'path';
import fs from 'fs';
import { MessageAttachment, MessageEmbed, TextChannel } from 'discord.js';
import { ManagedGuild } from '../engine/managedGuild';
import { gardenGame, getGardenVars } from './gardenGame';
import { ChoiceVariable, GardenVariableId } from './variables';
import { getSceneChoices } from './choices';
import { flatMap, flatten } from 'lodash';
import { buildVariantForScene, getEffectiveVariableValues } from './timelineVariants';
import assertNever from 'assert-never';

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

function describeChoiceValue(variable: ChoiceVariable, value: string, barbaraSpouseValue: string) {
  const choice = variable.choices.find((choice) => choice.value === value);
  if (!choice) {
    return `${value}: Unrecognized choice value`;
  }

  if (variable.id === 'brotherLentMoney') {
    return `${choice.value}: ${choice.label.replace(
      'The brother',
      barbaraSpouseValue === 'A' ? 'William' : 'Charles',
    )}`;
  }

  return `${choice.value}: ${choice.label}`;
}

async function sendInnerSceneMaterials(
  managedGuild: ManagedGuild,
  channel: TextChannel,
  scene: GardenInnerScene,
  area: GardenInnerArea,
  sceneFilenamePortion: string,
  characterNames: string[],
) {
  const sceneIntro = fs.readFileSync(
    path.join(__dirname, 'scene-intros', `${sceneFilenamePortion}.md`),
    'utf-8',
  );
  const sceneIndex = gardenGame.scenes.findIndex((otherScene) => otherScene.name === scene.name);
  const priorScenes = gardenGame.scenes.slice(0, sceneIndex).filter(isInnerScene);
  const priorChoices = flatten(
    await Promise.all(
      priorScenes.map((priorScene) => getSceneChoices(managedGuild, priorScene, area)),
    ),
  );
  const priorChoiceValues =
    priorChoices.length > 0
      ? await getEffectiveVariableValues(
          managedGuild,
          area,
          priorChoices.map((choiceVariable) => choiceVariable.id) as [
            'barbaraSpouse',
            ...GardenVariableId[]
          ],
        )
      : [];
  const priorChoiceText = priorChoices.map(
    (choiceVariable, index) =>
      `_${describeChoiceValue(choiceVariable, priorChoiceValues[index], priorChoiceValues[0])}_`,
  );

  const currentChoices = await getSceneChoices(managedGuild, scene, area);
  const currentChoiceText = flatMap(currentChoices, (choiceVariable) =>
    choiceVariable.choices.map((choice) =>
      describeChoiceValue(choiceVariable, choice.value, priorChoiceValues[0]),
    ),
  );

  const embed = new MessageEmbed()
    .setColor(0x0099ff)
    .setDescription(sceneIntro)
    .setTitle(scene.name);

  if (priorChoiceText.length > 0) {
    embed.addField('Choices so far', priorChoiceText.join('\n'), true);
  }

  if (currentChoiceText.length > 0) {
    embed.addField('Choices for this scene', currentChoiceText.join('\n'), true);
  }

  embed.attachFiles(
    getInnerCharacterSheetFilenames(sceneFilenamePortion, characterNames).map(
      (filename) => new MessageAttachment(filename),
    ),
  );

  await channel.send(embed);
}

function getCharacterNamesForInnerScene(scene: GardenInnerScene): string[] {
  switch (scene.name) {
    case 'Act I Scene 1':
    case 'Act I Scene 2':
    case 'Act I Scene 3':
    case 'Act I Scene 4':
      return ['Barbara', 'Charles', 'William', 'Virginia'];
    case 'Act II Scene 1':
    case 'Act II Scene 2':
      return ['Barbara', 'Charles', 'William', 'Stephanie'];
    case 'Act II Scene 3':
    case 'Act II Scene 4':
      return ['Barbara', 'Charles', 'Zach', 'Stephanie'];
    default:
      assertNever(scene.name);
  }
}

async function sendInnerSceneMaterialsWithVariant(
  managedGuild: ManagedGuild,
  scene: GardenInnerScene,
  area: GardenInnerArea,
) {
  const channel = managedGuild.areaTextChannels.get(area.name)!;
  const variant = await buildVariantForScene(managedGuild, scene, area);
  await sendInnerSceneMaterials(
    managedGuild,
    channel,
    scene,
    area,
    variant ? `${scene.name} (${variant})` : scene.name,
    getCharacterNamesForInnerScene(scene),
  );
}

export async function postPrepGardenScene(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
) {
  if (isInnerScene(scene) && isInnerArea(area)) {
    await sendInnerSceneMaterialsWithVariant(managedGuild, scene, area);
  } else if (isFrameScene(scene) && isFrameArea(area)) {
    // TODO
  }
}
