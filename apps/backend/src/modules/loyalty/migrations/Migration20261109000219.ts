import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261109000219 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "loyalty_member" drop constraint if exists "loyalty_member_phone_unique";`);
    this.addSql(`alter table if exists "loyalty_entry" drop constraint if exists "loyalty_entry_doc_id_unique";`);
    this.addSql(`create table if not exists "loyalty_entry" ("id" text not null, "phone" text not null, "source" text check ("source" in ('online', 'offline', 'manual')) not null, "doc_type" text not null, "doc_id" text not null, "doc_name" text null, "amount" integer not null, "purchased_at" timestamptz not null, "credit_at" timestamptz not null, "status" text check ("status" in ('pending', 'credited', 'cancelled')) not null default 'pending', "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_entry_phone" ON "loyalty_entry" ("phone") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_loyalty_entry_doc_id_unique" ON "loyalty_entry" ("doc_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_entry_deleted_at" ON "loyalty_entry" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "loyalty_member" ("id" text not null, "phone" text not null, "name" text null, "email" text null, "ms_counterparty_id" text null, "total" integer not null default 0, "level" text not null default 'BASE', "level_override" text null, "override_reason" text null, "warned_at" timestamptz null, "warned_level" text null, "recalculated_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_member_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_loyalty_member_phone_unique" ON "loyalty_member" ("phone") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_member_deleted_at" ON "loyalty_member" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "loyalty_entry" cascade;`);

    this.addSql(`drop table if exists "loyalty_member" cascade;`);
  }

}
