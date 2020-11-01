import { CommandHandler } from '../engine/commandHandlers';
import { makeChoice } from './choices';

export const choose: CommandHandler<any> = async (managedGuild, game, msg, args) => {
  const { member } = msg;
  if (member == null) {
    return;
  }

  const choice = await makeChoice(managedGuild, member, args);
  msg.reply(`Thank you.  Choice recorded: ${choice.label}`);
};
