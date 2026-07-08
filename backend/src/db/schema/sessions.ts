import { pgTable, uuid, varchar, real, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const sessions = pgTable("sessions", {
  id:                uuid("id").primaryKey().defaultRandom(),
  driverId:          uuid("driver_id").notNull().references(() => users.id),
  startedAt:         timestamp("started_at").notNull(),
  endedAt:           timestamp("ended_at"),
  durationS:         integer("duration_s"),
  avgScore:          real("avg_score"),
  peakScore:         real("peak_score"),
  riskBand:          varchar("risk_band", { length: 1 }),     // A|B|C|D|F
  premiumAdjustment: real("premium_adjustment"),
  alertCount0:       integer("alert_count_0").default(0),
  alertCount1:       integer("alert_count_1").default(0),
  alertCount2:       integer("alert_count_2").default(0),
  alertCount3:       integer("alert_count_3").default(0),
});

export type Session    = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
