import * as z from 'zod';
import fs from 'fs';

const ChoiceVariableDefinitionSchema = z.object({
  id: z.string(),
  type: z.literal('choice'),
  choices: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    }),
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

const VariableScopeSchema = z.union([z.literal('area'), z.literal('global')]);
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
  ]),
);

const ChoiceSchema = z.object({
  variableId: z.string(),
  scope: VariableScopeSchema,
  if: z.optional(BooleanExpressionSchema),
});

const MessageContentSchema = z.object({
  fromFile: z.string(),
});

const ActionBaseSchema = z.object({
  scope: VariableScopeSchema,
  if: z.optional(BooleanExpressionSchema),
});

const SendMessageActionSchema = z.intersection(
  ActionBaseSchema,
  z.object({
    action: z.literal('sendMessage'),
    content: MessageContentSchema,
  }),
);

const SendFilesActionSchema = z.intersection(
  ActionBaseSchema,
  z.object({
    action: z.literal('sendFiles'),
    files: z.array(z.string()),
  }),
);

const ActionSchema = z.union([SendMessageActionSchema, SendFilesActionSchema]);
export type ActionDefinition = z.infer<typeof ActionSchema>;

const GameStructureSchema = z.object({
  variableTemplates: z.optional(
    z.array(
      z.object({
        id: z.string(),
        variables: z.array(VariableDefinitionSchema),
      }),
    ),
  ),
  globalVariables: z.optional(z.array(VariableDefinitionOrTemplateReferenceSchema)),
  areas: z.array(
    z.object({
      name: z.string(),
      variables: z.optional(z.array(VariableDefinitionOrTemplateReferenceSchema)),
    }),
  ),
  characterTypes: z.array(
    z.object({
      name: z.string(),
      primary: z.optional(z.boolean()),
    }),
  ),
  characters: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      defaultPrimaryCharacterNames: z.optional(z.array(z.string())),
    }),
  ),
  scenes: z.array(
    z.object({
      name: z.string(),
      characterType: z.string(),
      choices: z.optional(z.array(ChoiceSchema)),
      actions: z.optional(z.array(ActionSchema)),
      areaSetups: z.array(
        z.object({
          areaName: z.string(),
          placements: z.array(
            z.object({
              characterName: z.string(),
              secondaryCharacterName: z.ostring(),
            }),
          ),
        }),
      ),
    }),
  ),
});

export type GameStructure = z.infer<typeof GameStructureSchema>;

export function loadGameStructure(filename: string) {
  return GameStructureSchema.parse(JSON.parse(fs.readFileSync(filename).toString('utf-8')));
}
