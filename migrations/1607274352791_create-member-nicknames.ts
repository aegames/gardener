/* eslint-disable @typescript-eslint/camelcase */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('member_nicknames', {
    id: 'id',
    guild_id: { type: 'text', notNull: true },
    member_id: { type: 'text', notNull: true },
    original_nickname: 'text',
  });
  pgm.createIndex('member_nicknames', ['guild_id', 'member_id'], { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('member_nicknames');
}
