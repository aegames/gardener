import { Dictionary } from 'lodash';
import { findScene } from '../engine/sceneHelpers';
import { assertHasGMRole, CommandHandler } from '../engine/commandHandlers';
import { areas, GardenArea } from './areas';
import { makeChoice, setAreaChoice } from './choices';
import { setGardenVar } from './gardenGame';
import { GardenVariable } from './variables';
import { GardenScene, isInnerScene } from './scenes';
import {
  buildVariantForScene,
  existingVariants,
  findClosestExistingVariant,
} from './timelineVariants';
import { notEmpty } from '../utils';

export const choose: CommandHandler<any, any, any> = async (managedGuild, game, msg, args) => {
  const { member } = msg;
  if (member == null) {
    return;
  }

  const choice = await makeChoice(managedGuild, member, args);
  msg.reply(`Thank you.  Choice recorded: ${choice.label}`);
};

const areasByNumber: Dictionary<GardenArea> = {
  '1': areas['Area 1'],
  '2': areas['Area 2'],
  '3': areas['Area 3'],
};

export const setChoice: CommandHandler<any, any, any> = async (managedGuild, game, msg, args) => {
  assertHasGMRole(managedGuild, msg.member);

  const [areaNumber, choiceValue] = args.split(/\s+/);
  const area = areasByNumber[areaNumber];

  if (!area) {
    throw new Error(
      `${areaNumber} is not a valid area number.  Please use one of: ${Object.keys(areasByNumber)
        .sort()
        .join(', ')}.`,
    );
  }

  const choice = await setAreaChoice(managedGuild, area, choiceValue);
  msg.reply(`Thank you.  Choice recorded: ${choice.label}`);
};

export const collapse: CommandHandler<GardenVariable, GardenArea, GardenScene> = async (
  managedGuild,
  game,
  msg,
  args,
) => {
  assertHasGMRole(managedGuild, msg.member);

  const nextScene = (await findScene(managedGuild, game, 'next')) as GardenScene;
  if (!isInnerScene(nextScene)) {
    throw new Error(
      "Collapsing the timeline is not applicable right now, since we aren't about to enter an inner scene",
    );
  }

  const currentVariants = await Promise.all(
    nextScene.areaSetups.map((areaSetup) =>
      buildVariantForScene(managedGuild, nextScene, areaSetup.area),
    ),
  );
  const existingVariantsForNextScene = existingVariants[nextScene.name];

  const collapseTargets = await Promise.all(
    nextScene.areaSetups.map(async (areaSetup, index) => {
      const variant = currentVariants[index];
      if (variant == null) {
        throw new Error(
          `Couldn't determine next variant for ${areaSetup.area.name}; maybe not all the choices have been made there yet`,
        );
      }

      if (!existingVariantsForNextScene.includes(variant)) {
        return findClosestExistingVariant(nextScene, variant);
      } else {
        return undefined;
      }
    }),
  );

  if (collapseTargets.some(notEmpty)) {
    const collapsePlan = nextScene.areaSetups
      .map((areaSetup, index) =>
        collapseTargets[index]
          ? `${areaSetup.area.name}: ${currentVariants[index]} -> ${collapseTargets[index]}`
          : `${areaSetup.area.name}: ${currentVariants[index]} (no change)`,
      )
      .join('\n');

    if (args === 'confirm') {
      await Promise.all(
        nextScene.areaSetups.map(async (areaSetup, index) => {
          const currentVariant = currentVariants[index];
          const collapseTarget = collapseTargets[index];
          if (!collapseTarget) {
            return;
          }

          await Promise.all(
            collapseTarget.split('').map(async (choiceValue, choiceIndex) => {
              if (currentVariant && choiceValue === currentVariant[choiceIndex]) {
                return;
              }
              await setAreaChoice(managedGuild, areaSetup.area, choiceValue);
            }),
          );
        }),
      );

      await msg.reply("Timelines collapsed!  Here's what I did:\n\n" + collapsePlan);
    } else {
      msg.reply(
        "OK, here's the plan:\n\n" +
          collapsePlan +
          '\n\nSay `!collapse confirm` to confirm this, or use `!setchoice` to manually override choices.',
      );
    }
  } else {
    msg.reply(`${nextScene.name} is good to go, no collapse needed.`);
  }
};
