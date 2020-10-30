import dotenv from 'dotenv';
dotenv.config();

import DiscordJS from 'discord.js';
import { parseGame } from './Game';
import { bringGuildUnderManagement, setupClient } from './ManagedGuild';

const client = new DiscordJS.Client();

const game = parseGame('./garden/structure.json');

setupClient(client);

client.on('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  client.guilds.cache.forEach(async (guild) => {
    bringGuildUnderManagement(guild, game);
  });
});

client.login(process.env.DISCORD_TOKEN);
