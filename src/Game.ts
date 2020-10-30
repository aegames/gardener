import { flatMap } from 'lodash';
import { Role } from 'discord.js';
import {
  BooleanExpression,
  GameStructure,
  loadGameStructure,
  VariableDefinition,
  VariableDefinitionOrTemplateReference,
} from './GameStructure';
import { evaluateBooleanExpression, ResolutionContext, resolveVariable } from './gameLogic';
import { ManagedGuild } from './managedGuild';
import { notEmpty } from './utils';

type VariableBase = {
  id: string;
  scope: string;
};

export type ChoiceVariable = VariableBase & {
  type: 'choice';
  choices: {
    value: string;
    label: string;
  }[];
};

export type GameVariable = ChoiceVariable; // reserved for future extensibility

export type Area = {
  name: string;
  variables: Map<string, GameVariable>;
};

export type CharacterType = {
  name: string;
  primary: boolean;
};

export type Character = {
  name: string;
  type: CharacterType;
  defaultPrimaryCharacters: Character[];
  defaultSecondaryCharacter?: Character;
};

export type Placement = {
  primaryCharacter: Character;
  secondaryCharacter?: Character;
};

export type AreaSetup = {
  area: Area;
  scene: Scene;
  placements: Placement[];
};

export type Choice = {
  variableId: string;
  scene: Scene;
  scope: 'area' | 'global';
  if?: BooleanExpression;
};

export type Scene = {
  name: string;
  choices: Choice[];
  characterType: CharacterType;
  areaSetups: AreaSetup[];
};

export type Game = {
  areas: Map<string, Area>;
  areaNames: string[];
  characters: Map<string, Character>;
  characterTypes: Map<string, CharacterType>;
  globalVariables: Map<string, GameVariable>;
  scenes: Scene[];
  sceneNames: string[];
};

type VariableTemplateMap = Map<string, GameVariable[]>;

function parseVariable(definition: VariableDefinition, scope: string): GameVariable {
  if (definition.type === 'choice') {
    return {
      id: definition.id,
      scope,
      type: 'choice',
      choices: [...definition.choices],
    };
  } else {
    throw new Error(`Unknown variable type: "${definition.type}"`);
  }
}

function parseVariableOrTemplateReference(
  definition: VariableDefinitionOrTemplateReference,
  variableTemplates: VariableTemplateMap,
  scope: string,
): GameVariable[] {
  if ('templateId' in definition) {
    const variables = variableTemplates.get(definition.templateId);
    if (variables == null) {
      throw new Error(`No variable template with id "${definition.templateId}"`);
    }
    return variables.map((definition) => ({
      ...definition,
      scope,
    }));
  } else {
    return [parseVariable(definition, scope)];
  }
}

function parseVariableOrTemplateReferenceList(
  definitions: VariableDefinitionOrTemplateReference[],
  variableTemplates: VariableTemplateMap,
  scope: string,
): Map<string, GameVariable> {
  return new Map<string, GameVariable>(
    flatMap(definitions, (varDef) =>
      parseVariableOrTemplateReference(varDef, variableTemplates, scope),
    ).map((variable) => [variable.id, variable]),
  );
}

export function loadGame(structure: GameStructure): Game {
  const variableTemplates: VariableTemplateMap = new Map(
    (structure.variableTemplates ?? []).map((template) => [
      template.id,
      template.variables.map((definition) => parseVariable(definition, `template.${template.id}`)),
    ]),
  );
  const globalVariables = parseVariableOrTemplateReferenceList(
    structure.globalVariables ?? [],
    variableTemplates,
    'global',
  );

  const areas = new Map<string, Area>(
    structure.areas.map((area) => [
      area.name,
      {
        name: area.name,
        variables: parseVariableOrTemplateReferenceList(
          area.variables ?? [],
          variableTemplates,
          `area.${area.name.toLowerCase().replace(/\W/g, '_')}`,
        ),
      },
    ]),
  );
  const characterTypes = new Map<string, CharacterType>(
    structure.characterTypes.map((characterType) => [
      characterType.name,
      { ...characterType, primary: characterType.primary ?? false },
    ]),
  );
  const characters = new Map<string, Character>(
    structure.characters.map((characterData) => {
      const characterType = characterTypes.get(characterData.type);
      if (!characterType) {
        throw new Error(
          `Character ${characterData.name} references non-existent character type "${characterData.type}"`,
        );
      }
      const character: Character = {
        name: characterData.name,
        type: characterType,
        defaultPrimaryCharacters: [],
      };
      return [character.name, character];
    }),
  );
  structure.characters.forEach((characterData) => {
    (characterData.defaultPrimaryCharacterNames ?? []).forEach((pcName) => {
      const primaryCharacter = characters.get(pcName);
      const secondaryCharacter = characters.get(characterData.name)!;
      if (!primaryCharacter) {
        throw new Error(
          `Secondary character ${secondaryCharacter.name} references non-existent primary character "${pcName}"`,
        );
      }
      if (primaryCharacter.defaultSecondaryCharacter) {
        throw new Error(
          `Secondary character ${secondaryCharacter.name} specifies ${primaryCharacter.name} as default primary character, but they already have ${primaryCharacter.defaultSecondaryCharacter.name} as a default secondary character`,
        );
      }
      secondaryCharacter.defaultPrimaryCharacters.push(primaryCharacter);
      primaryCharacter.defaultSecondaryCharacter = secondaryCharacter;
    });
  });
  const scenes: Scene[] = structure.scenes.map((sceneData) => {
    const characterType = characterTypes.get(sceneData.characterType);
    if (!characterType) {
      throw new Error(
        `Scene ${sceneData.name} references non-existent character type "${characterType}"`,
      );
    }
    const scene: Scene = {
      name: sceneData.name,
      characterType,
      choices: [],
      areaSetups: [],
    };

    scene.areaSetups = sceneData.areaSetups.map((areaSetup) => {
      const errorHeader = `Scene ${sceneData.name} area setup for ${areaSetup.areaName}`;
      const area = areas.get(areaSetup.areaName);
      if (!area) {
        throw new Error(`${errorHeader} references non-existent area: "${areaSetup.areaName}"`);
      }

      return {
        area,
        scene,
        placements: areaSetup.placements.map((placement) => {
          const primaryCharacter = characters.get(placement.characterName);
          if (!primaryCharacter) {
            throw new Error(
              `${errorHeader} references non-existent character "${placement.characterName}"`,
            );
          }

          if (scene.characterType.primary) {
            if (!primaryCharacter.type.primary) {
              throw new Error(
                `${errorHeader} references secondary character ${primaryCharacter.name}, but ${scene.name} is a primary-character scene`,
              );
            }

            return { primaryCharacter };
          } else {
            const scName =
              placement.secondaryCharacterName ?? primaryCharacter.defaultSecondaryCharacter?.name;
            if (!scName) {
              throw new Error(
                `${errorHeader} places ${primaryCharacter.name} without specifying a secondaryCharacterName, but ${primaryCharacter.name} has no default secondary character`,
              );
            }
            const secondaryCharacter = characters.get(scName);
            if (!secondaryCharacter) {
              throw new Error(
                `${errorHeader} references non-existent secondary character "${scName}"`,
              );
            }
            if (secondaryCharacter.type.primary) {
              throw new Error(
                `${errorHeader} specifies ${secondaryCharacter.name} as a secondary character, but they are a primary character`,
              );
            }
            return { primaryCharacter, secondaryCharacter };
          }
        }),
      };
    });

    scene.choices = (sceneData.choices ?? []).map((choiceData) => ({
      ...choiceData,
      scene,
    }));

    return scene;
  });

  return {
    areas,
    areaNames: [...areas.keys()],
    characterTypes,
    characters,
    globalVariables,
    scenes,
    sceneNames: scenes.map((scene) => scene.name),
  };
}

export function parseGame(filename: string) {
  return loadGame(loadGameStructure(filename));
}

export function findAreaForPrimaryCharacterRole(role: Role, scene: Scene) {
  return scene.areaSetups.find((areaSetup) =>
    areaSetup.placements.some((placement) => role.name === placement.primaryCharacter.name),
  )?.area;
}

async function resolveSceneChoice(
  managedGuild: ManagedGuild,
  game: Game,
  context: ResolutionContext,
  choice: Choice,
) {
  if (choice.if != null) {
    const passed = await evaluateBooleanExpression(managedGuild, game, choice.if, context);
    if (!passed) {
      return undefined;
    }
  }

  const variable = resolveVariable(game, choice, context);
  if (variable == null) {
    return undefined;
  }

  return variable;
}

export async function getSceneChoices(
  managedGuild: ManagedGuild,
  game: Game,
  scene: Scene,
  context: ResolutionContext,
): Promise<ChoiceVariable[]> {
  const resolvedVariables = await Promise.all(
    scene.choices.map((choice) => resolveSceneChoice(managedGuild, game, context, choice)),
  );

  return resolvedVariables.filter(notEmpty);
}
