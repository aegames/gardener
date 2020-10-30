import assertNever from 'assert-never';
import { getGameVariableValue } from './database';
import { Area, Game } from './game';
import { BooleanExpression, ValueExpression, VariableReference } from './gameStructure';
import { ManagedGuild } from './managedGuild';

export type ResolutionContext = {
  area?: Area;
};

export function resolveVariable(game: Game, ref: VariableReference, context: ResolutionContext) {
  if (ref.scope === 'global') {
    return game.globalVariables.get(ref.variableId);
  } else if (ref.scope === 'area') {
    return context.area?.variables.get(ref.variableId);
  } else {
    return undefined;
  }
}

export function getVariableValue(
  managedGuild: ManagedGuild,
  game: Game,
  ref: VariableReference,
  context: ResolutionContext,
) {
  const variable = resolveVariable(game, ref, context);
  if (variable == null) {
    throw new Error(`Could not resolve variable "${ref.variableId}" with scope "${ref.scope}"`);
  }

  return getGameVariableValue(managedGuild, variable);
}

export async function evaluateValueExpression(
  managedGuild: ManagedGuild,
  game: Game,
  expression: ValueExpression,
  context: ResolutionContext,
) {
  if (
    typeof expression === 'number' ||
    typeof expression === 'boolean' ||
    typeof expression === 'string'
  ) {
    return expression;
  }

  return await getVariableValue(managedGuild, game, expression, context);
}

export async function evaluateBooleanExpression(
  managedGuild: ManagedGuild,
  game: Game,
  expression: BooleanExpression,
  context: ResolutionContext,
): Promise<boolean> {
  if (typeof expression === 'boolean') {
    return expression;
  }

  if ('eq' in expression) {
    const [left, right] = await Promise.all([
      evaluateValueExpression(managedGuild, game, expression.eq[0], context),
      evaluateValueExpression(managedGuild, game, expression.eq[1], context),
    ]);
    return left === right;
  } else if ('and' in expression) {
    const [left, right] = await Promise.all([
      evaluateBooleanExpression(managedGuild, game, expression.and[0], context),
      evaluateBooleanExpression(managedGuild, game, expression.and[1], context),
    ]);
    return left && right;
  } else if ('or' in expression) {
    const [left, right] = await Promise.all([
      evaluateBooleanExpression(managedGuild, game, expression.or[0], context),
      evaluateBooleanExpression(managedGuild, game, expression.or[1], context),
    ]);
    return left || right;
  } else if ('not' in expression) {
    const value = await evaluateBooleanExpression(managedGuild, game, expression.not, context);
    return !value;
  }

  assertNever(expression);
}
