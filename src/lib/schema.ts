import { pgTable, serial, varchar, decimal, integer, boolean, text, timestamp, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceRef: varchar("invoice_ref", { length: 30 }).unique().notNull(),
  projectName: varchar("project_name", { length: 200 }),
  clientName: varchar("client_name", { length: 200 }).notNull(),
  clientEmail: varchar("client_email", { length: 200 }),
  clientCompany: varchar("client_company", { length: 200 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  invoiceType: varchar("invoice_type", { length: 20 }).default("standard"),
  dueDate: date("due_date").notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  billingStatus: varchar("billing_status", { length: 30 }).default("DRAFT"),
  followUpCount: integer("follow_up_count").default(0),
  lastFollowUpAt: timestamp("last_follow_up_at"),
  sentAt: timestamp("sent_at"),
  sinpeNumber: varchar("sinpe_number", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  method: varchar("method", { length: 20 }).default("bank_transfer"),
  reference: varchar("reference", { length: 200 }),
  paidAt: timestamp("paid_at").default(sql`now()`),
  notes: text("notes"),
});

export const billingActivity = pgTable("billing_activity", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  actionType: varchar("action_type", { length: 50 }),
  description: text("description"),
  performedBy: varchar("performed_by", { length: 100 }).default("system"),
  emailSent: boolean("email_sent").default(false),
  emailSubject: varchar("email_subject", { length: 300 }),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type BillingActivity = typeof billingActivity.$inferSelect;
