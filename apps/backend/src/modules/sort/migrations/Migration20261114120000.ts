import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261114120000 extends Migration {

  override async up(): Promise<void> {
    const base = `"created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null`;

    this.addSql(`create table if not exists "sort_product_score" ("id" text not null, "product_id" text not null, "zone" text check ("zone" in ('central', 'cold', 'south')) not null, "n" real not null, "s" real not null, "i" real not null, "r" real not null, "z" real not null, "m" real not null, "multipliers" jsonb not null, "k" real not null, "score" real not null, "profile" text not null, "calculated_at" timestamptz not null, ${base}, constraint "sort_product_score_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_product_score_product_id" ON "sort_product_score" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_product_score_deleted_at" ON "sort_product_score" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "sort_listing_event" ("id" text not null, "day" text not null, "product_id" text not null, "listing" text not null, "impressions" integer not null default 0, "clicks" integer not null default 0, "carts" integer not null default 0, "impressions_top" integer not null default 0, "clicks_top" integer not null default 0, ${base}, constraint "sort_listing_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sort_listing_event_key" ON "sort_listing_event" ("day", "product_id", "listing");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_listing_event_day" ON "sort_listing_event" ("day") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_listing_event_product_id" ON "sort_listing_event" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_listing_event_deleted_at" ON "sort_listing_event" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "sort_config_version" ("id" text not null, "version" integer not null, "config" jsonb not null, "author" text null, "note" text null, ${base}, constraint "sort_config_version_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_config_version_version" ON "sort_config_version" ("version") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_config_version_deleted_at" ON "sort_config_version" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "sort_manual_rule" ("id" text not null, "kind" text check ("kind" in ('pin', 'boost', 'demote', 'drop', 'sale')) not null, "target_type" text check ("target_type" in ('product', 'brand', 'collection', 'none')) not null, "target" text null, "value" real null, "listing" text null, "position" integer null, "starts_at" timestamptz not null, "ends_at" timestamptz not null, "author" text null, "note" text null, ${base}, constraint "sort_manual_rule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_manual_rule_deleted_at" ON "sort_manual_rule" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "sort_card_data" ("id" text not null, "product_id" text not null, "cost_price" real null, "collection" text null, ${base}, constraint "sort_card_data_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_card_data_product_id" ON "sort_card_data" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sort_card_data_deleted_at" ON "sort_card_data" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "sort_product_score" cascade;`);
    this.addSql(`drop table if exists "sort_listing_event" cascade;`);
    this.addSql(`drop table if exists "sort_config_version" cascade;`);
    this.addSql(`drop table if exists "sort_manual_rule" cascade;`);
    this.addSql(`drop table if exists "sort_card_data" cascade;`);
  }

}
