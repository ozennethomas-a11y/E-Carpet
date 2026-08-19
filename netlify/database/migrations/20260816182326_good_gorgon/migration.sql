CREATE TABLE "mailing_campaigns" (
	"id" serial PRIMARY KEY,
	"subject" text NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mailing_sends" (
	"id" serial PRIMARY KEY,
	"campaign_id" integer NOT NULL,
	"email" text NOT NULL,
	"opened_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "mailing_sends" ADD CONSTRAINT "mailing_sends_campaign_id_mailing_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "mailing_campaigns"("id");