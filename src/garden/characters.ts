import { keyBy } from 'lodash';
import { Character, CharacterType } from '../engine/game';

export const frameCharacterType: CharacterType = {
  name: 'Frame Character',
  primary: true,
};

export const innerCharacterType: CharacterType = {
  name: 'Inner Character',
  primary: true,
};

const frameCharacterNames = [
  'Devon',
  'Faith',
  'Jessica',
  'Kathy',
  'Larry',
  'Lindsay',
  'Lily',
  'Milo',
  'Noah',
  'Patrick',
  'Paula',
  'Rick',
] as const;
export type FrameCharacterName = typeof frameCharacterNames[number];

export const frameCharacters = keyBy(
  frameCharacterNames.map<Character>((name) => ({
    name,
    type: frameCharacterType,
    defaultPrimaryCharacters: [],
  })),
  (character) => character.name,
) as Record<FrameCharacterName, Character>;

export type InnerCharacterName =
  | 'Barbara'
  | 'Charles'
  | 'William'
  | 'Virginia'
  | 'Stephanie'
  | 'Zach';

const innerCharacterData: {
  name: InnerCharacterName;
  defaultFrameCharacterNames: FrameCharacterName[];
}[] = [
  {
    name: 'Barbara',
    defaultFrameCharacterNames: ['Kathy', 'Lindsay', 'Faith'] as FrameCharacterName[],
  },
  {
    name: 'Virginia',
    defaultFrameCharacterNames: ['Jessica', 'Lily', 'Paula'] as FrameCharacterName[],
  },
  {
    name: 'William',
    defaultFrameCharacterNames: ['Milo', 'Devon', 'Rick'] as FrameCharacterName[],
  },
  {
    name: 'Charles',
    defaultFrameCharacterNames: ['Larry', 'Patrick', 'Noah'] as FrameCharacterName[],
  },
  {
    name: 'Stephanie',
    defaultFrameCharacterNames: [] as FrameCharacterName[],
  },
  {
    name: 'Zach',
    defaultFrameCharacterNames: [] as FrameCharacterName[],
  },
];

export const innerCharacters = keyBy(
  innerCharacterData.map<Character>((characterData) => ({
    name: characterData.name,
    type: innerCharacterType,
    defaultPrimaryCharacters: characterData.defaultFrameCharacterNames.map(
      (value) => frameCharacters[value],
    ),
  })),
  (innerCharacter) => innerCharacter.name as InnerCharacterName,
) as Record<InnerCharacterName, Character>;

Object.values(innerCharacters).forEach((innerCharacter) => {
  innerCharacter.defaultPrimaryCharacters.forEach((frameCharacter) => {
    frameCharacter.defaultSecondaryCharacter = innerCharacter;
  });
});
