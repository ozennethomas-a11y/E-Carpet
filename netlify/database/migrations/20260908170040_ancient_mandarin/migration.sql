CREATE TABLE IF NOT EXISTS "cron_runs" (
	"id" serial PRIMARY KEY,
	"task" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"duration_ms" integer,
	"started_at" timestamp DEFAULT now() NOT NULL
);
