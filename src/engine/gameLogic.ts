import assertNever from 'assert-never';
import { getGameVariableValue, getGameVariableValues, setGameVariableValue } from './database';
import { Area, Game, GameVariableBase } from './game';
import { ManagedGuild } from './managedGuild';

export type VariableReference<VariableType extends GameVariableBase> = {
  variableId: VariableType['id'];
  scope: 'global' | 'area';
};

export type ResolutionContext<VariableType extends GameVariableBase> = {
  area?: Area<VariableType>;
};

export type ResolvedVariable<VariableType extends GameVariableBase> = {
  qualifier: string;
  variable: VariableType;
};

export function resolveVariable<VariableType extends GameVariableBase>(
  game: Game<VariableType>,
  ref: VariableReference<VariableType>,
  context: ResolutionContext<VariableType>,
): ResolvedVariable<VariableType> | undefined {
  if (ref.scope === 'global') {
    const variable = game.globalVariables.get(ref.variableId);
    if (!variable) {
      return undefined;
    }

    return { qualifier: 'global', variable };
  } else if (ref.scope === 'area') {
    const { area } = context;
    if (!area) {
      throw new Error(
        `Can't resolve area-scoped variable ${ref.variableId} when there is no area in context`,
      );
    }

    const variable: VariableType | undefined = area.variables[ref.variableId];
    if (!variable) {
      return undefined;
    }

    return { qualifier: `area.${area.name.replace(/\W/g, '_').toLowerCase()}`, variable };
  } else {
    assertNever(ref.scope);
  }
}

export async function getVariableValues<VariableType extends GameVariableBase>(
  managedGuild: ManagedGuild,
  game: Game<VariableType>,
  context: ResolutionContext<VariableType>,
  ...refs: VariableReference<VariableType>[]
) {
  const variables = refs.map((ref) => {
    const variable = resolveVariable(game, ref, context);
    if (variable == null) {
      throw new Error(`Could not resolve variable "${ref.variableId}" with scope "${ref.scope}"`);
    }
    return variable;
  });

  return await getGameVariableValues(managedGuild, ...variables);
}

export async function getVariableValue<VariableType extends GameVariableBase>(
  managedGuild: ManagedGuild,
  game: Game<VariableType>,
  context: ResolutionContext<VariableType>,
  ref: VariableReference<VariableType>,
) {
  return (await getVariableValues(managedGuild, game, context, ref))[0];
}

export async function setVariableValue<VariableType extends GameVariableBase>(
  managedGuild: ManagedGuild,
  game: Game<VariableType>,
  context: ResolutionContext<VariableType>,
  ref: VariableReference<VariableType>,
  value: any,
) {
  const variable = resolveVariable(game, ref, context);
  if (!variable) {
    throw new Error(`Could not resolve variable "${ref.variableId}" with scope "${ref.scope}"`);
  }

  return await setGameVariableValue(managedGuild, variable, value);
}
