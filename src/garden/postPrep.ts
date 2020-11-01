import { sendFiles, sendLongMessage } from '../engine/commands';
import { GardenArea } from './areas';
import { GardenScene } from './scenes';
import path from 'path';
import fs from 'fs';
import { TextChannel } from 'discord.js';
import { ManagedGuild } from '../engine/managedGuild';
import { getGardenVars } from './gardenGame';
import { GardenVariableId } from './variables';
import logger from '../engine/logger';

async function sendSceneIntro(channel: TextChannel, filename: string) {
  const content = fs.readFileSync(path.join(__dirname, 'scene-intros', filename), 'utf-8');
  return await sendLongMessage(channel, content);
}

async function sendInnerCharacterSheets(
  channel: TextChannel,
  sceneFilenamePortion: string,
  characterNames: string[],
) {
  await sendFiles(
    channel,
    characterNames.map((characterName) =>
      path.join(
        __dirname,
        'inner-character-sheets',
        characterName,
        `${characterName} - ${sceneFilenamePortion}.pdf`,
      ),
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

async function sendInnerSceneMaterials(
  channel: TextChannel,
  sceneFilenamePortion: string,
  characterNames: string[],
) {
  await sendSceneIntro(channel, `${sceneFilenamePortion}.md`);
  await sendInnerCharacterSheets(channel, sceneFilenamePortion, characterNames);
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
  await sendInnerSceneMaterials(channel, `${scene.name} ${variant}`, characterNames);
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
      managedGuild.areaTextChannels.get(area.name)!,
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
      managedGuild.areaTextChannels.get(area.name)!,
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
}
