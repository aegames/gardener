/* eslint-disable @typescript-eslint/camelcase */
import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("game_variables", {
    id: "id",
    guild_id: { type: "text", notNull: true },
    variable_id: { type: "text", notNull: true },
    value: { type: "jsonb" },
  });
  pgm.createIndex("game_variables", ["guild_id", "variable_id"], {
    unique: true,
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("game_variables");
}
