import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  kind: text("kind").notNull(),
  data: text("data").notNull(),
  version: integer("version").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
