import { AreaSetup, CharacterType, Scene } from '../engine/game';
import { areas, GardenArea } from './areas';
import {
  frameCharacters,
  frameCharacterType,
  innerCharacters,
  innerCharacterType,
} from './characters';
import { GardenVariable } from './variables';

export const innerSceneNames = [
  'Act I Scene 1',
  'Act I Scene 2',
  'Act I Scene 3',
  'Act I Scene 4',
  'Act II Scene 1',
  'Act II Scene 2',
  'Act II Scene 3',
  'Act II Scene 4',
] as const;

export const frameSceneNames = ['Prologue', 'Intermission', 'Epilogue'] as const;

export type GardenInnerSceneName = typeof innerSceneNames[number];
export type GardenFrameSceneName = typeof frameSceneNames[number];
export type GardenSceneName = GardenInnerSceneName | GardenFrameSceneName;

export type GardenInnerScene = Scene<GardenVariable, GardenArea> & {
  name: GardenInnerSceneName;
};

export type GardenFrameScene = Scene<GardenVariable, GardenArea> & {
  name: GardenFrameSceneName;
};

export type GardenScene = GardenInnerScene | GardenFrameScene;

export function isInnerScene(scene: GardenScene): scene is GardenInnerScene {
  return (innerSceneNames as readonly string[]).includes(scene.name);
}

export function isFrameScene(scene: GardenScene): scene is GardenFrameScene {
  return (frameSceneNames as readonly string[]).includes(scene.name);
}

function buildScene(
  name: GardenSceneName,
  characterType: CharacterType,
  areaSetups: Omit<AreaSetup<GardenVariable, GardenArea>, 'scene'>[],
): GardenScene {
  const scene: GardenScene = {
    name,
    characterType,
    areaSetups: [],
  };
  scene.areaSetups = areaSetups.map((areaSetup) => ({
    ...areaSetup,
    scene,
    placements: areaSetup.placements.map((placement) => ({
      ...placement,
      secondaryCharacter: characterType.primary
        ? undefined
        : placement.secondaryCharacter ?? placement.primaryCharacter.defaultSecondaryCharacter,
    })),
  }));
  return scene;
}

export const scenes: GardenScene[] = [
  buildScene('Prologue', frameCharacterType, [
    {
      area: areas['The Funeral Home'],
      placements: [
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Jessica },
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Milo },
        { primaryCharacter: frameCharacters.Devon },
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Lily },
        { primaryCharacter: frameCharacters.Patrick },
        { primaryCharacter: frameCharacters.Lindsay },
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Paula },
        { primaryCharacter: frameCharacters.Rick },
      ],
    },
  ]),
  buildScene('Act I Scene 1', innerCharacterType, [
    {
      area: areas['Area 1'],
      placements: [
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Jessica },
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Milo },
      ],
    },
    {
      area: areas['Area 2'],
      placements: [
        { primaryCharacter: frameCharacters.Devon },
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Lily },
        { primaryCharacter: frameCharacters.Patrick },
      ],
    },
    {
      area: areas['Area 3'],
      placements: [
        { primaryCharacter: frameCharacters.Lindsay },
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Paula },
        { primaryCharacter: frameCharacters.Rick },
      ],
    },
  ]),
  buildScene('Act I Scene 2', innerCharacterType, [
    {
      area: areas['Area 1'],
      placements: [
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Jessica },
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Milo },
      ],
    },
    {
      area: areas['Area 2'],
      placements: [
        { primaryCharacter: frameCharacters.Devon },
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Lily },
        { primaryCharacter: frameCharacters.Lindsay },
      ],
    },
    {
      area: areas['Area 3'],
      placements: [
        { primaryCharacter: frameCharacters.Patrick },
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Paula },
        { primaryCharacter: frameCharacters.Rick },
      ],
    },
  ]),
  buildScene('Act I Scene 3', innerCharacterType, [
    {
      area: areas['Area 1'],
      placements: [
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Lily },
        { primaryCharacter: frameCharacters.Rick },
      ],
    },
    {
      area: areas['Area 2'],
      placements: [
        { primaryCharacter: frameCharacters.Milo },
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Paula },
      ],
    },
    {
      area: areas['Area 3'],
      placements: [
        { primaryCharacter: frameCharacters.Devon },
        { primaryCharacter: frameCharacters.Patrick },
        { primaryCharacter: frameCharacters.Jessica },
        { primaryCharacter: frameCharacters.Lindsay },
      ],
    },
  ]),
  buildScene('Act I Scene 4', innerCharacterType, [
    {
      area: areas['Area 1'],
      placements: [
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Jessica },
        { primaryCharacter: frameCharacters.Patrick },
        { primaryCharacter: frameCharacters.Rick },
      ],
    },
    {
      area: areas['Area 2'],
      placements: [
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Lily },
        { primaryCharacter: frameCharacters.Milo },
        { primaryCharacter: frameCharacters.Kathy },
      ],
    },
    {
      area: areas['Area 3'],
      placements: [
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Devon },
        { primaryCharacter: frameCharacters.Lindsay },
        { primaryCharacter: frameCharacters.Paula },
      ],
    },
  ]),
  buildScene('Intermission', frameCharacterType, [
    {
      area: areas['The Funeral Home'],
      placements: [
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Jessica },
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Milo },
        { primaryCharacter: frameCharacters.Devon },
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Lily },
        { primaryCharacter: frameCharacters.Patrick },
        { primaryCharacter: frameCharacters.Lindsay },
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Paula },
        { primaryCharacter: frameCharacters.Rick },
      ],
    },
  ]),
  buildScene('Act II Scene 1', innerCharacterType, [
    {
      area: areas['Area 1'],
      placements: [
        { primaryCharacter: frameCharacters.Devon },
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Patrick },
        { primaryCharacter: frameCharacters.Lily, secondaryCharacter: innerCharacters.Stephanie },
      ],
    },
    {
      area: areas['Area 2'],
      placements: [
        { primaryCharacter: frameCharacters.Lindsay },
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Rick },
        { primaryCharacter: frameCharacters.Paula, secondaryCharacter: innerCharacters.Stephanie },
      ],
    },
    {
      area: areas['Area 3'],
      placements: [
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Milo },
        {
          primaryCharacter: frameCharacters.Jessica,
          secondaryCharacter: innerCharacters.Stephanie,
        },
      ],
    },
  ]),
  buildScene('Act II Scene 2', innerCharacterType, [
    {
      area: areas['Area 1'],
      placements: [
        { primaryCharacter: frameCharacters.Devon },
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Lindsay },
        { primaryCharacter: frameCharacters.Lily, secondaryCharacter: innerCharacters.Stephanie },
      ],
    },
    {
      area: areas['Area 2'],
      placements: [
        { primaryCharacter: frameCharacters.Patrick },
        { primaryCharacter: frameCharacters.Rick },
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Paula, secondaryCharacter: innerCharacters.Stephanie },
      ],
    },
    {
      area: areas['Area 3'],
      placements: [
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Milo },
        {
          primaryCharacter: frameCharacters.Jessica,
          secondaryCharacter: innerCharacters.Stephanie,
        },
      ],
    },
  ]),
  buildScene('Act II Scene 3', innerCharacterType, [
    {
      area: areas['Area 1'],
      placements: [
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Milo, secondaryCharacter: innerCharacters.Zach },
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Paula, secondaryCharacter: innerCharacters.Stephanie },
      ],
    },
    {
      area: areas['Area 2'],
      placements: [
        { primaryCharacter: frameCharacters.Devon, secondaryCharacter: innerCharacters.Zach },
        {
          primaryCharacter: frameCharacters.Jessica,
          secondaryCharacter: innerCharacters.Stephanie,
        },
        { primaryCharacter: frameCharacters.Lindsay },
        { primaryCharacter: frameCharacters.Patrick },
      ],
    },
    {
      area: areas['Area 3'],
      placements: [
        { primaryCharacter: frameCharacters.Rick, secondaryCharacter: innerCharacters.Zach },
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Lily, secondaryCharacter: innerCharacters.Stephanie },
      ],
    },
  ]),
  buildScene('Act II Scene 4', innerCharacterType, [
    {
      area: areas['Area 1'],
      placements: [
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Milo, secondaryCharacter: innerCharacters.Zach },
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Lily, secondaryCharacter: innerCharacters.Stephanie },
      ],
    },
    {
      area: areas['Area 2'],
      placements: [
        { primaryCharacter: frameCharacters.Devon, secondaryCharacter: innerCharacters.Zach },
        { primaryCharacter: frameCharacters.Larry },
        {
          primaryCharacter: frameCharacters.Paula,
          secondaryCharacter: innerCharacters.Stephanie,
        },
        { primaryCharacter: frameCharacters.Lindsay },
      ],
    },
    {
      area: areas['Area 3'],
      placements: [
        { primaryCharacter: frameCharacters.Rick, secondaryCharacter: innerCharacters.Zach },
        {
          primaryCharacter: frameCharacters.Jessica,
          secondaryCharacter: innerCharacters.Stephanie,
        },
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Patrick },
      ],
    },
  ]),
  buildScene('Epilogue', frameCharacterType, [
    {
      area: areas['The Funeral Home'],
      placements: [
        { primaryCharacter: frameCharacters.Faith },
        { primaryCharacter: frameCharacters.Jessica },
        { primaryCharacter: frameCharacters.Larry },
        { primaryCharacter: frameCharacters.Milo },
        { primaryCharacter: frameCharacters.Devon },
        { primaryCharacter: frameCharacters.Kathy },
        { primaryCharacter: frameCharacters.Lily },
        { primaryCharacter: frameCharacters.Patrick },
        { primaryCharacter: frameCharacters.Lindsay },
        { primaryCharacter: frameCharacters.Noah },
        { primaryCharacter: frameCharacters.Paula },
        { primaryCharacter: frameCharacters.Rick },
      ],
    },
  ]),
];
