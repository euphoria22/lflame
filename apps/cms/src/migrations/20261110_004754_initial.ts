import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_size_charts_categories" AS ENUM('kurtki', 'hudi-i-svitshoty', 'svitery-i-kardigany', 'futbolki-i-longslivy', 'rubashki-i-polo', 'bryuki', 'dzhinsy', 'shorty', 'obuv', 'golovnye-ubory', 'sumki-i-ryukzaki', 'aksessuary', 'nizhnee-bele-i-noski');
  CREATE TYPE "public"."enum_size_charts_gender" AS ENUM('men', 'women', 'all');
  CREATE TYPE "public"."enum_home_hero_focus" AS ENUM('top', 'center', 'bottom');
  CREATE TYPE "public"."enum_home_hero_text_color" AS ENUM('light', 'dark');
  CREATE TYPE "public"."enum_menu_men_category" AS ENUM('kurtki', 'hudi-i-svitshoty', 'svitery-i-kardigany', 'futbolki-i-longslivy', 'rubashki-i-polo', 'bryuki', 'dzhinsy', 'shorty', 'obuv', 'golovnye-ubory', 'sumki-i-ryukzaki', 'aksessuary', 'nizhnee-bele-i-noski');
  CREATE TYPE "public"."enum_menu_women_category" AS ENUM('kurtki', 'hudi-i-svitshoty', 'svitery-i-kardigany', 'futbolki-i-longslivy', 'rubashki-i-polo', 'bryuki', 'dzhinsy', 'shorty', 'obuv', 'golovnye-ubory', 'sumki-i-ryukzaki', 'aksessuary', 'nizhnee-bele-i-noski');
  CREATE TYPE "public"."enum_announcement_theme" AS ENUM('dark', 'sale', 'light');
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"order" numeric DEFAULT 100,
  	"seed_version" numeric,
  	"intro" varchar,
  	"content" jsonb NOT NULL,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"published_at" timestamp(3) with time zone,
  	"category_id" integer,
  	"cover_id" integer,
  	"excerpt" varchar,
  	"content" jsonb,
  	"products" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_category_id" integer,
  	"version_cover_id" integer,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"version_products" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "blog_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "size_charts_categories" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_size_charts_categories",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "size_charts_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"table" varchar NOT NULL
  );
  
  CREATE TABLE "size_charts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"gender" "enum_size_charts_gender" DEFAULT 'men' NOT NULL,
  	"brands" varchar,
  	"image_id" integer,
  	"note" varchar,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_large_url" varchar,
  	"sizes_large_width" numeric,
  	"sizes_large_height" numeric,
  	"sizes_large_mime_type" varchar,
  	"sizes_large_filesize" numeric,
  	"sizes_large_filename" varchar
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer,
  	"blog_categories_id" integer,
  	"size_charts_id" integer,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "home_hero_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"link" varchar NOT NULL
  );
  
  CREATE TABLE "home" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_enabled" boolean DEFAULT true,
  	"hero_image_id" integer,
  	"hero_video_id" integer,
  	"hero_image_mobile_id" integer,
  	"hero_focus" "enum_home_hero_focus" DEFAULT 'center',
  	"hero_eyebrow" varchar,
  	"hero_title" varchar,
  	"hero_text_color" "enum_home_hero_text_color" DEFAULT 'light',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "menu_men" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" "enum_menu_men_category" NOT NULL,
  	"label" varchar,
  	"image_id" integer
  );
  
  CREATE TABLE "menu_women" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" "enum_menu_women_category" NOT NULL,
  	"label" varchar,
  	"image_id" integer
  );
  
  CREATE TABLE "menu" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "announcement_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"link" varchar,
  	"link_label" varchar DEFAULT 'Подробнее'
  );
  
  CREATE TABLE "announcement" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"theme" "enum_announcement_theme" DEFAULT 'dark',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_category_id_blog_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."blog_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "size_charts_categories" ADD CONSTRAINT "size_charts_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."size_charts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "size_charts_sections" ADD CONSTRAINT "size_charts_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."size_charts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "size_charts" ADD CONSTRAINT "size_charts_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_categories_fk" FOREIGN KEY ("blog_categories_id") REFERENCES "public"."blog_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_size_charts_fk" FOREIGN KEY ("size_charts_id") REFERENCES "public"."size_charts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_hero_buttons" ADD CONSTRAINT "home_hero_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_hero_video_id_media_id_fk" FOREIGN KEY ("hero_video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_hero_image_mobile_id_media_id_fk" FOREIGN KEY ("hero_image_mobile_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "menu_men" ADD CONSTRAINT "menu_men_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "menu_men" ADD CONSTRAINT "menu_men_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."menu"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "menu_women" ADD CONSTRAINT "menu_women_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "menu_women" ADD CONSTRAINT "menu_women_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."menu"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "announcement_items" ADD CONSTRAINT "announcement_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  CREATE INDEX "posts_category_idx" ON "posts" USING btree ("category_id");
  CREATE INDEX "posts_cover_idx" ON "posts" USING btree ("cover_id");
  CREATE INDEX "posts_updated_at_idx" ON "posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "posts" USING btree ("_status");
  CREATE INDEX "_posts_v_parent_idx" ON "_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_category_idx" ON "_posts_v" USING btree ("version_category_id");
  CREATE INDEX "_posts_v_version_version_cover_idx" ON "_posts_v" USING btree ("version_cover_id");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "_posts_v" USING btree ("latest");
  CREATE UNIQUE INDEX "blog_categories_slug_idx" ON "blog_categories" USING btree ("slug");
  CREATE INDEX "blog_categories_updated_at_idx" ON "blog_categories" USING btree ("updated_at");
  CREATE INDEX "blog_categories_created_at_idx" ON "blog_categories" USING btree ("created_at");
  CREATE INDEX "size_charts_categories_order_idx" ON "size_charts_categories" USING btree ("order");
  CREATE INDEX "size_charts_categories_parent_idx" ON "size_charts_categories" USING btree ("parent_id");
  CREATE INDEX "size_charts_sections_order_idx" ON "size_charts_sections" USING btree ("_order");
  CREATE INDEX "size_charts_sections_parent_id_idx" ON "size_charts_sections" USING btree ("_parent_id");
  CREATE INDEX "size_charts_image_idx" ON "size_charts" USING btree ("image_id");
  CREATE INDEX "size_charts_updated_at_idx" ON "size_charts" USING btree ("updated_at");
  CREATE INDEX "size_charts_created_at_idx" ON "size_charts" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_large_sizes_large_filename_idx" ON "media" USING btree ("sizes_large_filename");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_blog_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_categories_id");
  CREATE INDEX "payload_locked_documents_rels_size_charts_id_idx" ON "payload_locked_documents_rels" USING btree ("size_charts_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "home_hero_buttons_order_idx" ON "home_hero_buttons" USING btree ("_order");
  CREATE INDEX "home_hero_buttons_parent_id_idx" ON "home_hero_buttons" USING btree ("_parent_id");
  CREATE INDEX "home_hero_hero_image_idx" ON "home" USING btree ("hero_image_id");
  CREATE INDEX "home_hero_hero_video_idx" ON "home" USING btree ("hero_video_id");
  CREATE INDEX "home_hero_hero_image_mobile_idx" ON "home" USING btree ("hero_image_mobile_id");
  CREATE INDEX "menu_men_order_idx" ON "menu_men" USING btree ("_order");
  CREATE INDEX "menu_men_parent_id_idx" ON "menu_men" USING btree ("_parent_id");
  CREATE INDEX "menu_men_image_idx" ON "menu_men" USING btree ("image_id");
  CREATE INDEX "menu_women_order_idx" ON "menu_women" USING btree ("_order");
  CREATE INDEX "menu_women_parent_id_idx" ON "menu_women" USING btree ("_parent_id");
  CREATE INDEX "menu_women_image_idx" ON "menu_women" USING btree ("image_id");
  CREATE INDEX "announcement_items_order_idx" ON "announcement_items" USING btree ("_order");
  CREATE INDEX "announcement_items_parent_id_idx" ON "announcement_items" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages" CASCADE;
  DROP TABLE "posts" CASCADE;
  DROP TABLE "_posts_v" CASCADE;
  DROP TABLE "blog_categories" CASCADE;
  DROP TABLE "size_charts_categories" CASCADE;
  DROP TABLE "size_charts_sections" CASCADE;
  DROP TABLE "size_charts" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "home_hero_buttons" CASCADE;
  DROP TABLE "home" CASCADE;
  DROP TABLE "menu_men" CASCADE;
  DROP TABLE "menu_women" CASCADE;
  DROP TABLE "menu" CASCADE;
  DROP TABLE "announcement_items" CASCADE;
  DROP TABLE "announcement" CASCADE;
  DROP TYPE "public"."enum_posts_status";
  DROP TYPE "public"."enum__posts_v_version_status";
  DROP TYPE "public"."enum_size_charts_categories";
  DROP TYPE "public"."enum_size_charts_gender";
  DROP TYPE "public"."enum_home_hero_focus";
  DROP TYPE "public"."enum_home_hero_text_color";
  DROP TYPE "public"."enum_menu_men_category";
  DROP TYPE "public"."enum_menu_women_category";
  DROP TYPE "public"."enum_announcement_theme";`)
}
