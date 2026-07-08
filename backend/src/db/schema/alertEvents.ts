import { pgTable, uuid, smallint, real, timestamp } from "drizzle-orm/pg-core";
import { sessions } from "./sessions";

export const alertEvents = pgTable("alert_events", {
  id:        uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull(),
  level:     smallint("level").notNull(),
  score:     real("score").notNull(),
  ear:       real("ear"),
  perclos:   real("perclos"),
  mar:       real("mar"),
});

export type AlertEvent    = typeof alertEvents.$inferSelect;
export type NewAlertEvent = typeof alertEvents.$inferInsert;
