import { Area } from '../src/game';
import { buildTimelineVariables, GardenVariable } from './variables';

export type GardenAreaName = 'The Funeral Home' | 'Area 1' | 'Area 2' | 'Area 3';

export type GardenArea = Area<GardenVariable> & {
  name: GardenAreaName;
};

export const areas: Record<GardenAreaName, GardenArea> = {
  'The Funeral Home': {
    name: 'The Funeral Home',
    variables: {},
  },
  'Area 1': {
    name: 'Area 1',
    variables: buildTimelineVariables(),
  },
  'Area 2': {
    name: 'Area 2',
    variables: buildTimelineVariables(),
  },
  'Area 3': {
    name: 'Area 3',
    variables: buildTimelineVariables(),
  },
};
