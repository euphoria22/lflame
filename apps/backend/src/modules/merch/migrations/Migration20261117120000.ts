import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "merch_sale" ("id" text not null, "day" text not null, "ms_product_id" text not null, "size" text null, "qty" integer not null, "revenue" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "merch_sale_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_merch_sale_day" ON "merch_sale" ("day") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_merch_sale_ms_product_id" ON "merch_sale" ("ms_product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_merch_sale_deleted_at" ON "merch_sale" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "merch_sale" cascade;`);
  }

}
