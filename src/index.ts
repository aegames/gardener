import DiscordJS, {
  Channel,
  Guild,
  GuildChannel,
  GuildMember,
  Role,
} from "discord.js";
import dotenv from "dotenv";
import { flatMap } from "lodash";
import { AreaSetup, parseGame, Scene } from "./Game";
import { bringGuildUnderManagement, setupClient } from "./ManagedGuild";

dotenv.config();
const client = new DiscordJS.Client();

const game = parseGame("./garden/structure.json");

setupClient(client);

client.on("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  client.guilds.cache.forEach(async (guild) => {
    bringGuildUnderManagement(guild, game);
  });
});

client.login(process.env.DISCORD_TOKEN);
