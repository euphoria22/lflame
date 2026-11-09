import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261109165609 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "newsletter_subscriber" ("id" text not null, "email" text not null, "promo_code" text null, "source" text not null default 'footer', "unsubscribed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "newsletter_subscriber_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_email" ON "newsletter_subscriber" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_deleted_at" ON "newsletter_subscriber" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "newsletter_subscriber" cascade;`);
  }

}
