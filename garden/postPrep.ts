import { sendLongMessage } from '../src/commands';
import { GardenArea } from './areas';
import { GardenScene } from './scenes';
import path from 'path';
import fs from 'fs';
import { TextChannel } from 'discord.js';
import { ManagedGuild } from '../src/managedGuild';
import { getGardenVar } from './gardenGame';

async function sendSceneIntro(channel: TextChannel, filename: string) {
  const content = fs.readFileSync(path.join(__dirname, 'scene-intros', filename), 'utf-8');
  return await sendLongMessage(channel, content);
}

export async function postPrepGardenScene(
  managedGuild: ManagedGuild,
  scene: GardenScene,
  area: GardenArea,
) {
  const textChannel = managedGuild.areaTextChannels.get(area.name)!;

  if (scene.name === 'Act I Scene 1') {
    await sendSceneIntro(textChannel, 'Scene 1, Version 1.md');
  } else if (scene.name === 'Act I Scene 2') {
    const barbaraSpouse = await getGardenVar(managedGuild, 'barbaraSpouse', area);
    if (barbaraSpouse === 'A') {
      await sendSceneIntro(textChannel, 'Scene 2, Version 1 (A).md');
    } else if (barbaraSpouse === 'B') {
      await sendSceneIntro(textChannel, 'Scene 2, Version 2 (B).md');
    }
  }
}
