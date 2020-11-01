import { GuildMember } from 'discord.js';
import { Character, findAreaForPrimaryCharacter } from '../engine/game';
import { getMemberCharacters } from '../engine/commands';
import { getGameScene } from '../engine/database';
import { ManagedGuild } from '../engine/managedGuild';
import { flatMap } from 'lodash';
import { GardenScene } from './scenes';
import { GardenArea } from './areas';
import { gardenGame, getGardenVar, setGardenVar } from './gardenGame';
import { ChoiceVariable } from './variables';
import { notEmpty } from '../utils';

async function getSceneChoices(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
): Promise<ChoiceVariable[]> {
  if (scene.name === 'Act I Scene 1') {
    return [area.variables.barbaraSpouse].filter(notEmpty);
  } else if (scene.name === 'Act I Scene 2') {
    const barbaraSpouse = await getGardenVar(managedGuild, area, 'barbaraSpouse');
    if (barbaraSpouse === 'A') {
      return [area.variables.barbaraCheated, area.variables.spouseCheated].filter(notEmpty);
    } else {
      return [area.variables.barbaraCheated].filter(notEmpty);
    }
  } else if (scene.name === 'Act I Scene 3') {
    return [area.variables.divorce].filter(notEmpty);
  } else if (scene.name === 'Act I Scene 4') {
    return [area.variables.virginiaNursingHome].filter(notEmpty);
  } else if (scene.name === 'Act II Scene 1') {
    return [area.variables.brotherLentMoney].filter(notEmpty);
  } else if (scene.name === 'Act II Scene 2') {
    return [area.variables.drunkDrivingConsequences].filter(notEmpty);
  } else if (scene.name === 'Act II Scene 3') {
    return [area.variables.acceptZach].filter(notEmpty);
  }

  return [];
}

export async function getStateForMember(managedGuild: ManagedGuild, member: GuildMember) {
  const scene = (await getGameScene(managedGuild, gardenGame)) as GardenScene;
  if (scene == null) {
    throw new Error("Choices can only be made in a scene, and the game currently isn't in one");
  }

  const characters = getMemberCharacters(member, gardenGame);
  const primaryCharacter = characters.find((character) => character.type.primary);
  if (!primaryCharacter) {
    throw new Error(
      "You don't have a primary character assigned, so you can't make choices.  This is probably a mistake, please ask the GM about this.",
    );
  }

  const area = findAreaForPrimaryCharacter(primaryCharacter, scene) as GardenArea;
  return { scene, primaryCharacter, characters, area };
}

export async function getAvailableChoicesForMember(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
  characters: Character[],
) {
  const availableChoiceVariables = await getSceneChoices(managedGuild, scene, area);

  return flatMap(availableChoiceVariables, (variable) =>
    variable.choices.map((choice) => ({
      variable,
      value: choice.value,
      label: choice.label,
    })),
  );
}

export async function makeChoice(managedGuild: ManagedGuild, member: GuildMember, args: string) {
  const { scene, characters, area } = await getStateForMember(managedGuild, member);
  const availableChoices = await getAvailableChoicesForMember(
    managedGuild,
    scene,
    area,
    characters,
  );
  if (availableChoices.length === 0) {
    throw new Error("You don't have any choices available right now.");
  }

  const choiceHelp = `Here are your options:\n${availableChoices
    .map((choice) => `${choice.value}: ${choice.label}`)
    .join('\n')}\n\nTo choose one, say something like "!choose ${availableChoices[0].value}".`;

  const choiceArg = args;
  if (choiceArg === '') {
    throw new Error(`Please specify a choice.  ${choiceHelp}`);
  }

  const choice = availableChoices.find((choiceValue) => choiceValue.value === choiceArg);
  if (choice == null) {
    throw new Error(`${choiceArg} is not a valid choice right now.  ${choiceHelp}`);
  }

  await setGardenVar(managedGuild, area, choice.variable.id, choice.value);
  return choice;
}
