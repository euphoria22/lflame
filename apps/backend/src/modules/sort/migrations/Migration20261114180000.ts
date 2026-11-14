import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261114180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "sort_card_data" add column if not exists "warmth" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "sort_card_data" drop column if exists "warmth";`);
  }

}
