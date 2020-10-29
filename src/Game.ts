import * as z from "zod";
import fs from "fs";
import { flatMap } from "lodash";

const ChoiceVariableDefinitionSchema = z.object({
  id: z.string(),
  type: z.literal("choice"),
  choices: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    })
  ),
});

const VariableDefinitionSchema = ChoiceVariableDefinitionSchema; // reserved for future extensibility
type VariableDefinition = z.infer<typeof VariableDefinitionSchema>;

const VariableDefinitionOrTemplateReferenceSchema = z.union([
  VariableDefinitionSchema,
  z.object({
    templateId: z.string(),
  }),
]);
type VariableDefinitionOrTemplateReference = z.infer<
  typeof VariableDefinitionOrTemplateReferenceSchema
>;

const ChoiceSchema = z.object({
  variableId: z.string(),
  scope: z.union([z.literal("area"), z.literal("global")]),
});

const GameStructureSchema = z.object({
  variableTemplates: z.optional(
    z.array(
      z.object({
        id: z.string(),
        variables: z.array(VariableDefinitionSchema),
      })
    )
  ),
  globalVariables: z.optional(
    z.array(VariableDefinitionOrTemplateReferenceSchema)
  ),
  areas: z.array(
    z.object({
      name: z.string(),
      variables: z.optional(
        z.array(VariableDefinitionOrTemplateReferenceSchema)
      ),
    })
  ),
  frameCharacters: z.array(
    z.object({
      name: z.string(),
    })
  ),
  innerCharacters: z.array(
    z.object({
      name: z.string(),
      defaultFrameCharacterNames: z.optional(z.array(z.string())),
    })
  ),
  scenes: z.array(
    z.object({
      name: z.string(),
      choices: z.optional(z.array(ChoiceSchema)),
      areaSetups: z.array(
        z.object({
          areaName: z.string(),
          placements: z.array(
            z.object({
              frameCharacterName: z.string(),
              innerCharacterName: z.ostring(),
            })
          ),
        })
      ),
    })
  ),
});

type GameStructure = z.infer<typeof GameStructureSchema>;

type VariableBase = {
  id: string;
  scope: string;
};

export type ChoiceVariable = VariableBase & {
  type: "choice";
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

export type FrameCharacter = {
  name: string;
  defaultInnerCharacter?: InnerCharacter;
};

export type InnerCharacter = {
  name: string;
  defaultFrameCharacters: FrameCharacter[];
};

export type Placement = {
  frameCharacter: FrameCharacter;
  innerCharacter: InnerCharacter;
};

export type AreaSetup = {
  area: Area;
  placements: Placement[];
};

export type Choice = {
  variableId: string;
  scope: "area" | "global";
};

export type Scene = {
  name: string;
  choices: Choice[];
  areaSetups: AreaSetup[];
};

export type Game = {
  areas: Map<string, Area>;
  areaNames: string[];
  frameCharacters: Map<string, FrameCharacter>;
  frameCharacterNames: string[];
  globalVariables: Map<string, GameVariable>;
  innerCharacters: Map<string, InnerCharacter>;
  innerCharacterNames: string[];
  scenes: Scene[];
  sceneNames: string[];
};

type VariableTemplateMap = Map<string, GameVariable[]>;

function parseVariable(
  definition: VariableDefinition,
  scope: string
): GameVariable {
  if (definition.type === "choice") {
    return {
      id: definition.id,
      scope,
      type: "choice",
      choices: [...definition.choices],
    };
  } else {
    throw new Error(`Unknown variable type: "${definition.type}"`);
  }
}

function parseVariableOrTemplateReference(
  definition: VariableDefinitionOrTemplateReference,
  variableTemplates: VariableTemplateMap,
  scope: string
): GameVariable[] {
  if ("templateId" in definition) {
    const variables = variableTemplates.get(definition.templateId);
    if (variables == null) {
      throw new Error(
        `No variable template with id "${definition.templateId}"`
      );
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
  scope: string
): Map<string, GameVariable> {
  return new Map<string, GameVariable>(
    flatMap(definitions, (varDef) =>
      parseVariableOrTemplateReference(varDef, variableTemplates, scope)
    ).map((variable) => [variable.id, variable])
  );
}

export function loadGame(structure: GameStructure): Game {
  const variableTemplates: VariableTemplateMap = new Map(
    (structure.variableTemplates ?? []).map((template) => [
      template.id,
      template.variables.map((definition) =>
        parseVariable(definition, `template.${template.id}`)
      ),
    ])
  );
  const globalVariables = parseVariableOrTemplateReferenceList(
    structure.globalVariables ?? [],
    variableTemplates,
    "global"
  );

  const areas = new Map<string, Area>(
    structure.areas.map((area) => [
      area.name,
      {
        name: area.name,
        variables: parseVariableOrTemplateReferenceList(
          area.variables ?? [],
          variableTemplates,
          `area.${area.name.toLowerCase().replace(/\W/g, "_")}`
        ),
      },
    ])
  );
  const frameCharacters = new Map<string, FrameCharacter>(
    structure.frameCharacters.map((character) => [character.name, character])
  );
  const innerCharacters = new Map<string, InnerCharacter>(
    structure.innerCharacters.map((character) => {
      const innerCharacter: InnerCharacter = {
        name: character.name,
        defaultFrameCharacters: [],
      };
      (character.defaultFrameCharacterNames ?? []).forEach((fcName) => {
        const frameCharacter = frameCharacters.get(fcName);
        if (!frameCharacter) {
          throw new Error(
            `Inner character ${character.name} references non-existent frame character "${fcName}"`
          );
        }
        if (frameCharacter.defaultInnerCharacter) {
          throw new Error(
            `Inner character ${character.name} has a default frame character ${frameCharacter.name}, but that frame character already has ${frameCharacter.defaultInnerCharacter.name} as a default`
          );
        }
        frameCharacter.defaultInnerCharacter = innerCharacter;
        innerCharacter.defaultFrameCharacters.push(frameCharacter);
      });

      return [character.name, innerCharacter];
    })
  );
  const scenes: Scene[] = structure.scenes.map((scene) => ({
    name: scene.name,
    choices: scene.choices ?? [],
    areaSetups: scene.areaSetups.map((areaSetup) => {
      const area = areas.get(areaSetup.areaName);
      if (!area) {
        throw new Error(
          `Scene ${scene.name} area setup for ${areaSetup.areaName} references non-existent area: "${areaSetup.areaName}"`
        );
      }

      return {
        area,
        placements: areaSetup.placements.map((placement) => {
          const frameCharacter = frameCharacters.get(
            placement.frameCharacterName
          );
          if (!frameCharacter) {
            throw new Error(
              `Scene ${scene.name} area setup for ${areaSetup.areaName} references non-existent frame character "${placement.frameCharacterName}"`
            );
          }
          const icName =
            placement.innerCharacterName ??
            frameCharacter.defaultInnerCharacter?.name;
          if (!icName) {
            throw new Error(
              `Scene ${scene.name} area setup for ${areaSetup.areaName} places ${frameCharacter.name} without specifying an innerCharacterName, but ${frameCharacter.name} has no default inner character`
            );
          }
          const innerCharacter = innerCharacters.get(icName);
          if (!innerCharacter) {
            throw new Error(
              `Scene ${scene.name} area setup for ${areaSetup.areaName} references non-existent inner character "${icName}"`
            );
          }
          return { frameCharacter, innerCharacter };
        }),
      };
    }),
  }));

  return {
    areas,
    areaNames: [...areas.keys()],
    frameCharacters,
    frameCharacterNames: [...frameCharacters.keys()],
    globalVariables,
    innerCharacters,
    innerCharacterNames: [...innerCharacters.keys()],
    scenes,
    sceneNames: scenes.map((scene) => scene.name),
  };
}

export function parseGame(filename: string) {
  return loadGame(
    GameStructureSchema.parse(
      JSON.parse(fs.readFileSync(filename).toString("utf-8"))
    )
  );
}
