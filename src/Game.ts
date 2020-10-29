import * as z from "zod";
import fs from "fs";

const GameStructureSchema = z.object({
  areas: z.array(
    z.object({
      name: z.string(),
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

export type Area = {
  name: string;
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

export type Scene = {
  name: string;
  areaSetups: AreaSetup[];
};

export type Game = {
  areas: Map<string, Area>;
  areaNames: string[];
  frameCharacters: Map<string, FrameCharacter>;
  frameCharacterNames: string[];
  innerCharacters: Map<string, InnerCharacter>;
  innerCharacterNames: string[];
  scenes: Scene[];
  sceneNames: string[];
};

export function loadGame(structure: GameStructure): Game {
  const areas = new Map<string, Area>(
    structure.areas.map((area: any) => [area.name, area])
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
