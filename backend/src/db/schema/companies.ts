import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      varchar("name", { length: 200 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Company    = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
