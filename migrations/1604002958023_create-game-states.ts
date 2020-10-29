/* eslint-disable @typescript-eslint/camelcase */
import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("game_states", {
    id: "id",
    guild_id: { type: "text", notNull: true },
    scene_name: "text",
  });
  pgm.createIndex("game_states", ["guild_id"], { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("game_states");
}
