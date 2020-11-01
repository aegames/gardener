import dotenv from 'dotenv';
dotenv.config();

import { setupClient } from './engine/managedGuild';
import { gardenGame } from './garden/gardenGame';

setupClient(gardenGame);
