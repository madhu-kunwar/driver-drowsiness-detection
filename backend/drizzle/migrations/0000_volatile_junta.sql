CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) NOT NULL,
	"license_no" varchar(50),
	"company_id" uuid,
	"vehicle" varchar(150),
	"avatar_initials" varchar(3),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration_s" integer,
	"avg_score" real,
	"peak_score" real,
	"risk_band" varchar(1),
	"premium_adjustment" real,
	"alert_count_0" integer DEFAULT 0,
	"alert_count_1" integer DEFAULT 0,
	"alert_count_2" integer DEFAULT 0,
	"alert_count_3" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"timestamp" timestamp NOT NULL,
	"level" smallint NOT NULL,
	"score" real NOT NULL,
	"ear" real,
	"perclos" real,
	"mar" real
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle" varchar(150),
	"incident_date" timestamp NOT NULL,
	"reported_date" timestamp NOT NULL,
	"type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"amount_npr" integer NOT NULL,
	"alert_level_at_incident" smallint,
	"composite_score_at_incident" real,
	"notes" text,
	"company_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" varchar(30) NOT NULL,
	"frame_id" varchar(40) NOT NULL,
	"captured_at" timestamp NOT NULL,
	"seconds_before_incident" integer NOT NULL,
	"alert_level" smallint NOT NULL,
	"composite_score" real,
	"ear" real,
	"perclos" real,
	"hash" varchar(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_frames" ADD CONSTRAINT "evidence_frames_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;