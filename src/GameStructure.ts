import * as z from "zod";
import fs from "fs";

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
export type VariableDefinition = z.infer<typeof VariableDefinitionSchema>;

const VariableDefinitionOrTemplateReferenceSchema = z.union([
  VariableDefinitionSchema,
  z.object({
    templateId: z.string(),
  }),
]);
export type VariableDefinitionOrTemplateReference = z.infer<
  typeof VariableDefinitionOrTemplateReferenceSchema
>;

const VariableScopeSchema = z.union([z.literal("area"), z.literal("global")]);
export type VariableScope = z.infer<typeof VariableScopeSchema>;

const VariableReferenceSchema = z.object({
  variableId: z.string(),
  scope: VariableScopeSchema,
});
export type VariableReference = z.infer<typeof VariableReferenceSchema>;

const ValueExpressionSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  VariableReferenceSchema,
]);
export type ValueExpression = z.infer<typeof ValueExpressionSchema>;

export type BooleanExpression =
  | boolean
  | {
      eq: [ValueExpression, ValueExpression];
    }
  | {
      and: [BooleanExpression, BooleanExpression];
    }
  | {
      or: [BooleanExpression, BooleanExpression];
    }
  | {
      not: BooleanExpression;
    };
const BooleanExpressionSchema: z.ZodType<BooleanExpression> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.object({
      eq: z.tuple([ValueExpressionSchema, ValueExpressionSchema]),
    }),
    z.object({
      and: z.tuple([BooleanExpressionSchema, BooleanExpressionSchema]),
    }),
    z.object({
      or: z.tuple([BooleanExpressionSchema, BooleanExpressionSchema]),
    }),
    z.object({ not: BooleanExpressionSchema }),
  ])
);

const ChoiceSchema = z.object({
  variableId: z.string(),
  scope: VariableScopeSchema,
  if: z.optional(BooleanExpressionSchema),
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

export type GameStructure = z.infer<typeof GameStructureSchema>;

export function loadGameStructure(filename: string) {
  return GameStructureSchema.parse(
    JSON.parse(fs.readFileSync(filename).toString("utf-8"))
  );
}
