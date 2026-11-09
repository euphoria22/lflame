import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261109163033 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "restock_request" ("id" text not null, "email" text not null, "variant_id" text not null, "product_handle" text not null, "product_title" text not null, "size" text not null, "notified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "restock_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_restock_request_email" ON "restock_request" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_restock_request_variant_id" ON "restock_request" ("variant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_restock_request_deleted_at" ON "restock_request" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "restock_request" cascade;`);
  }

}
