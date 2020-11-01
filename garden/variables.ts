import { cloneDeep, keyBy } from 'lodash';
import { GameVariableBase } from '../src/game';

export type ChoiceVariable = GameVariableBase & {
  type: 'choice';
  choices: {
    value: string;
    label: string;
  }[];
};

export type GardenVariableId =
  | 'barbaraSpouse'
  | 'barbaraCheated'
  | 'spouseCheated'
  | 'divorce'
  | 'virginiaNursingHome'
  | 'brotherLentMoney'
  | 'drunkDrivingConsequences'
  | 'acceptZach';

export type GardenVariable = ChoiceVariable & {
  id: GardenVariableId;
};

const timelineVariablesData: { id: GardenVariableId; choices: ChoiceVariable['choices'] }[] = [
  {
    id: 'barbaraSpouse',
    choices: [
      { value: 'A', label: 'Barbara married Charles.' },
      { value: 'B', label: 'Barbara married William.' },
    ],
  },
  {
    id: 'barbaraCheated',
    choices: [
      { value: 'C', label: 'She cheated.' },
      { value: 'D', label: 'She did not cheat.' },
    ],
  },
  {
    id: 'spouseCheated',
    choices: [
      { value: 'E', label: 'He cheated.' },
      { value: 'F', label: 'He did not cheat.' },
    ],
  },
  {
    id: 'divorce',
    choices: [
      { value: 'G', label: 'They got a divorce.' },
      { value: 'H', label: 'They stayed married.' },
    ],
  },
  {
    id: 'virginiaNursingHome',
    choices: [
      { value: 'I', label: 'They put Virginia in a nursing home.' },
      { value: 'J', label: 'They took care of Virginia at home.' },
    ],
  },
  {
    id: 'brotherLentMoney',
    choices: [
      { value: 'K', label: 'The brother lent money.' },
      { value: 'L', label: 'The brother did not lend money.' },
    ],
  },
  {
    id: 'drunkDrivingConsequences',
    choices: [
      {
        value: 'M',
        label: 'They went easy on Stephanie after her drunk driving.',
      },
      {
        value: 'N',
        label: 'They came down hard on Stephanie for driving drunk.',
      },
    ],
  },
  {
    id: 'acceptZach',
    choices: [
      { value: 'O', label: 'Zach was accepted into the family.' },
      { value: 'P', label: 'The family rejected Zach.' },
    ],
  },
];

const timelineVariablesTemplate = keyBy(
  timelineVariablesData.map<ChoiceVariable>((variableData) => ({
    type: 'choice',
    id: variableData.id,
    choices: variableData.choices,
    scope: 'area',
  })),
  (choiceVariable) => choiceVariable.id as GardenVariableId,
) as Record<GardenVariableId, GardenVariable>;

export function buildTimelineVariables() {
  return cloneDeep(timelineVariablesTemplate);
}
