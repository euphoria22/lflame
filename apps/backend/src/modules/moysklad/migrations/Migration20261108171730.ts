import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261108171730 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "moysklad_sync_run" ("id" text not null, "kind" text check ("kind" in ('catalog', 'stock')) not null, "mode" text check ("mode" in ('full', 'incremental', 'products')) not null default 'incremental', "trigger" text check ("trigger" in ('schedule', 'manual', 'webhook', 'script')) not null default 'schedule', "status" text check ("status" in ('running', 'success', 'partial', 'failed')) not null default 'running', "started_at" timestamptz not null, "finished_at" timestamptz null, "stats" jsonb null, "problems" jsonb null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "moysklad_sync_run_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_moysklad_sync_run_deleted_at" ON "moysklad_sync_run" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "moysklad_sync_run" cascade;`);
  }

}
