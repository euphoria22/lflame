import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261113120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "gift_card" ("id" text not null, "code" text not null, "amount" integer not null, "balance" integer not null default 0, "status" text check ("status" in ('pending', 'active', 'disabled')) not null default 'pending', "expires_at" timestamptz null, "buyer_name" text null, "buyer_email" text null, "buyer_phone" text null, "recipient_name" text null, "recipient_email" text null, "message" text null, "send_at" timestamptz null, "sent_at" timestamptz null, "source" text check ("source" in ('site', 'admin')) not null default 'site', "payment_id" text null, "paid_at" timestamptz null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "gift_card_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_code_unique" ON "gift_card" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_deleted_at" ON "gift_card" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "gift_card_transaction" ("id" text not null, "gift_card_id" text not null, "amount" integer not null, "kind" text check ("kind" in ('issue', 'redeem_online', 'redeem_store', 'refund', 'adjust')) not null, "reference" text null, "note" text null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "gift_card_transaction_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_transaction_gift_card_id" ON "gift_card_transaction" ("gift_card_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_transaction_deleted_at" ON "gift_card_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "gift_card_transaction" cascade;`);

    this.addSql(`drop table if exists "gift_card" cascade;`);
  }

}
