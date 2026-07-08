import { pgTable, uuid, varchar, integer, real, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { companies } from "./companies";

export const claims = pgTable("claims", {
  id:                       varchar("id", { length: 30 }).primaryKey(),   // CLM-2026-1001
  driverId:                 uuid("driver_id").notNull().references(() => users.id),
  vehicle:                  varchar("vehicle", { length: 150 }),
  incidentDate:             timestamp("incident_date").notNull(),
  reportedDate:             timestamp("reported_date").notNull(),
  type:                     varchar("type", { length: 30 }).notNull(),    // fatigue-related | collision | other
  status:                   varchar("status", { length: 20 }).notNull().default("open"),
  amountNpr:                integer("amount_npr").notNull(),
  alertLevelAtIncident:     smallint("alert_level_at_incident"),
  compositeScoreAtIncident: real("composite_score_at_incident"),
  notes:                    text("notes"),
  companyId:                uuid("company_id").references(() => companies.id),
  createdAt:                timestamp("created_at").defaultNow().notNull(),
});

export type Claim    = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
