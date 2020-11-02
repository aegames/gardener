import { Area } from '../engine/game';
import { buildTimelineVariables, GardenVariable } from './variables';

export type GardenAreaName = 'The Funeral Home' | 'Area 1' | 'Area 2' | 'Area 3';

export type GardenArea = Area<GardenVariable> & {
  name: GardenAreaName;
};

export const areas: Record<GardenAreaName, GardenArea> = {
  'The Funeral Home': {
    name: 'The Funeral Home',
    textChannelName: 'the-funeral-home',
    voiceChannelName: 'The Funeral Home',
    variables: {},
  },
  'Area 1': {
    name: 'Area 1',
    textChannelName: 'area-1',
    voiceChannelName: 'Area 1',
    variables: buildTimelineVariables(),
  },
  'Area 2': {
    name: 'Area 2',
    textChannelName: 'area-2',
    voiceChannelName: 'Area 2',
    variables: buildTimelineVariables(),
  },
  'Area 3': {
    name: 'Area 3',
    textChannelName: 'area-3',
    voiceChannelName: 'Area 3',
    variables: buildTimelineVariables(),
  },
};
