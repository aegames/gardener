import {
  getGameVariableValue,
  getGameVariableValues,
  getQualifiedVariableId,
  getQualifiedVariableValue,
  getQualifiedVariableValues,
} from '../engine/database';
import { CommandHandler } from '../engine/commandHandlers';
import { makeChoice } from './choices';
import { gardenGame } from './gardenGame';
import { flatMap } from 'lodash';
import { getVariableValues, resolveVariable } from '../engine/gameLogic';
import { notEmpty } from '../utils';

export const choose: CommandHandler = async (managedGuild, msg, args) => {
  const { member } = msg;
  if (member == null) {
    return;
  }

  const choice = await makeChoice(managedGuild, member, args);
  msg.reply(`Thank you.  Choice recorded: ${choice.label}`);
};

export const get: CommandHandler = async (managedGuild, msg, args) => {
  if (args !== '') {
    const value = await getQualifiedVariableValue(managedGuild, args);
    msg.reply(`${args} = ${JSON.stringify(value)}`);
  } else {
    const variables = [
      ...[...gardenGame.globalVariables.values()].map((variable) =>
        resolveVariable(gardenGame, { variableId: variable.id, scope: 'global' as const }, {}),
      ),
      ...flatMap([...gardenGame.areas.values()], (area) =>
        Object.values(area.variables).map((variable) =>
          resolveVariable(
            gardenGame,
            { variableId: variable!.id, scope: 'area' as const },
            { area },
          ),
        ),
      ),
    ].filter(notEmpty);
    const values = await getGameVariableValues(managedGuild, ...variables);
    msg.reply(
      variables.map(
        (variable, index) =>
          `${getQualifiedVariableId(variable)} = ${JSON.stringify(values[index])}`,
      ),
    );
  }
};
