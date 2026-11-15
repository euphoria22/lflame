import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261116120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "merch_task" ("id" text not null, "layout_id" text not null, "name" text not null, "token" text not null, "steps" jsonb not null, "status" text check ("status" in ('open', 'done', 'closed')) not null default 'open', "author" text null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "merch_task_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_merch_task_token_unique" ON "merch_task" ("token") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_merch_task_layout_id" ON "merch_task" ("layout_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_merch_task_deleted_at" ON "merch_task" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "merch_task" cascade;`);
  }

}
