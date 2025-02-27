import { pgTable, text, serial, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  question: text("question").notNull(),
  options: json("options").$type<string[]>().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
});

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  score: integer("score"),
  questions: json("questions").$type<number[]>().notNull(),
  answers: json("answers").$type<number[]>(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  packageType: text("package_type").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: json("value").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertQuestionSchema = createInsertSchema(questions);
export const insertExamSchema = createInsertSchema(exams);
export const insertPaymentSchema = createInsertSchema(payments);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Question = typeof questions.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Settings = typeof settings.$inferSelect;

export const packagePrices = {
  single: 200,
  daily: 800,
  weekly: 4000,
  monthly: 10000,
} as const;

export type PackageType = keyof typeof packagePrices;
