import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111125204 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "moysklad_product_sales" drop constraint if exists "moysklad_product_sales_moysklad_product_id_unique";`);
    this.addSql(`create table if not exists "moysklad_product_sales" ("id" text not null, "moysklad_product_id" text not null, "store_qty" integer not null default 0, "site_qty" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "moysklad_product_sales_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_moysklad_product_sales_moysklad_product_id_unique" ON "moysklad_product_sales" ("moysklad_product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_moysklad_product_sales_deleted_at" ON "moysklad_product_sales" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "moysklad_product_sales" cascade;`);
  }

}
