import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261115120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "merch_layout" ("id" text not null, "name" text not null, "data" jsonb not null, "is_current" boolean not null default false, "author" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "merch_layout_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_merch_layout_deleted_at" ON "merch_layout" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "merch_layout" cascade;`);
  }

}
