import dotenv from 'dotenv';
dotenv.config();

import DiscordJS from 'discord.js';
import { bringGuildUnderManagement, setupClient } from './engine/managedGuild';
import { gardenGame } from './garden/gardenGame';
import logger from './engine/logger';

const client = new DiscordJS.Client();

setupClient(client);

client.on('ready', async () => {
  logger.info(`Logged in as ${client.user?.tag}!`);
  client.guilds.cache.forEach(async (guild) => {
    bringGuildUnderManagement(guild, gardenGame);
  });
});

client.login(process.env.DISCORD_TOKEN);
