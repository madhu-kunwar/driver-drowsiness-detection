import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const users = pgTable("users", {
  id:             uuid("id").primaryKey().defaultRandom(),
  name:           varchar("name", { length: 120 }).notNull(),
  email:          varchar("email", { length: 255 }).notNull().unique(),
  passwordHash:   text("password_hash").notNull(),
  role:           varchar("role", { length: 20 }).notNull(),         // driver | insurer | admin
  licenseNo:      varchar("license_no", { length: 50 }),             // driver only
  companyId:      uuid("company_id").references(() => companies.id), // insurer only
  vehicle:        varchar("vehicle", { length: 150 }),               // driver only
  avatarInitials: varchar("avatar_initials", { length: 3 }),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;

// Explicit insert type — drizzle $inferInsert omits nullable cols under strictNullChecks:false
export interface NewUser {
  name:           string;
  email:          string;
  passwordHash:   string;
  role:           string;
  id?:            string;
  licenseNo?:     string | null;
  companyId?:     string | null;
  vehicle?:       string | null;
  avatarInitials?: string | null;
  createdAt?:     Date;
}
