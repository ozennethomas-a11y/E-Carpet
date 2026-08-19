CREATE TABLE "scheduled_posts" (
	"id" serial PRIMARY KEY,
	"networks" jsonb NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"image_url" text,
	"video_url" text,
	"scheduled_for" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
