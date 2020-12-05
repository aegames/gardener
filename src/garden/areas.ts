import { Area } from '../engine/game';
import { buildTimelineVariables, GardenVariable } from './variables';

export const innerAreaNames = ['Area 1', 'Area 2', 'Area 3'] as const;
export const frameAreaNames = ['The Funeral Home'] as const;
export type InnerGardenAreaName = typeof innerAreaNames[number];
export type FrameGardenAreaName = typeof frameAreaNames[number];
export type GardenAreaName = InnerGardenAreaName | FrameGardenAreaName;

export type GardenInnerArea = Area<GardenVariable> & {
  name: InnerGardenAreaName;
  variables: ReturnType<typeof buildTimelineVariables>;
};

export type GardenFrameArea = Area<GardenVariable> & {
  name: FrameGardenAreaName;
  variables: {};
};

export type GardenArea = GardenInnerArea | GardenFrameArea;

export function isInnerArea(area: GardenArea): area is GardenInnerArea {
  return (innerAreaNames as readonly string[]).includes(area.name);
}

export function isFrameArea(area: GardenArea): area is GardenFrameArea {
  return (frameAreaNames as readonly string[]).includes(area.name);
}

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
