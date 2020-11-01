import assertNever from 'assert-never';
import { getGameVariableValue } from './database';
import { Area, Game } from './game';
import { ManagedGuild } from './managedGuild';

export type VariableReference = {
  variableId: string;
  scope: 'global' | 'area';
};

export type ResolutionContext = {
  area?: Area<any>;
};

export function resolveVariable(
  game: Game<any>,
  ref: VariableReference,
  context: ResolutionContext,
) {
  if (ref.scope === 'global') {
    return game.globalVariables.get(ref.variableId);
  } else if (ref.scope === 'area') {
    return context.area?.variables[ref.variableId];
  } else {
    assertNever(ref.scope);
  }
}

export function getVariableValue(
  managedGuild: ManagedGuild,
  game: Game<any>,
  ref: VariableReference,
  context: ResolutionContext,
) {
  const variable = resolveVariable(game, ref, context);
  if (variable == null) {
    throw new Error(`Could not resolve variable "${ref.variableId}" with scope "${ref.scope}"`);
  }

  return getGameVariableValue(managedGuild, variable);
}
