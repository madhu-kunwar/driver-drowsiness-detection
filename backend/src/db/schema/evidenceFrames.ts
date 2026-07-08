import { pgTable, uuid, varchar, integer, real, smallint, timestamp } from "drizzle-orm/pg-core";
import { claims } from "./claims";

export const evidenceFrames = pgTable("evidence_frames", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  claimId:               varchar("claim_id", { length: 30 }).notNull().references(() => claims.id, { onDelete: "cascade" }),
  frameId:               varchar("frame_id", { length: 40 }).notNull(),
  capturedAt:            timestamp("captured_at").notNull(),
  secondsBeforeIncident: integer("seconds_before_incident").notNull(),
  alertLevel:            smallint("alert_level").notNull(),
  compositeScore:        real("composite_score"),
  ear:                   real("ear"),
  perclos:               real("perclos"),
  hash:                  varchar("hash", { length: 64 }).notNull(),
});

export type EvidenceFrame    = typeof evidenceFrames.$inferSelect;
export type NewEvidenceFrame = typeof evidenceFrames.$inferInsert;
