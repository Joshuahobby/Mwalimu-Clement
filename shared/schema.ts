import { pgTable, text, serial, integer, boolean, json, timestamp, index, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define role type
export const userRoles = ["admin", "instructor", "student"] as const;
export type UserRole = typeof userRoles[number];

// Define theme type
export const themeTypes = ["light", "dark", "system"] as const;
export type ThemeType = typeof themeTypes[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  role: text("role", { enum: userRoles }).default("student").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayName: text("display_name"),
  bio: text("bio"),
  email: text("email"),
  phoneNumber: text("phone_number"),
  avatarUrl: text("avatar_url"),
  theme: text("theme", { enum: themeTypes }).default("system").notNull(),
  preferences: json("preferences").$type<{
    emailNotifications: boolean;
    smsNotifications: boolean;
    language: string;
  }>().default({
    emailNotifications: true,
    smsNotifications: false,
    language: "en"
  }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    usernameIdx: index("username_idx").on(table.username),
    emailIdx: index("email_idx").on(table.email),
    roleIdx: index("role_idx").on(table.role),
  };
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  question: text("question").notNull(),
  options: json("options").$type<string[]>().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
}, (table) => {
  return {
    categoryIdx: index("category_idx").on(table.category),
  };
});

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  score: integer("score"),
  questions: json("questions").$type<number[]>().notNull(),
  answers: json("answers").$type<number[]>(),
}, (table) => {
  return {
    userIdIdx: index("user_id_idx").on(table.userId),
    startTimeIdx: index("start_time_idx").on(table.startTime),
  };
});

export const paymentStatuses = ["pending", "completed", "failed", "refunded"] as const;
export type PaymentStatus = typeof paymentStatuses[number];

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  packageType: text("package_type").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  createdAt: timestamp("created_at").notNull(),
  status: text("status", { enum: paymentStatuses }).default("pending").notNull(),
  username: text("username"),
}, (table) => {
  return {
    userIdIdx: index("payment_user_id_idx").on(table.userId),
    statusIdx: index("payment_status_idx").on(table.status),
    createdAtIdx: index("payment_created_at_idx").on(table.createdAt),
  };
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: json("value").notNull(),
}, (table) => {
  return {
    keyIdx: index("settings_key_idx").on(table.key),
  };
});

export const examSimulations = pgTable("exam_simulations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  isCompleted: boolean("is_completed").default(false),
  currentQuestionIndex: integer("current_question_index").default(0),
  questions: json("questions").$type<number[]>().notNull(),
  answers: json("answers").$type<number[]>(),
  timePerQuestion: integer("time_per_question").default(60),
  showFeedback: boolean("show_feedback").default(true),
  showTimer: boolean("show_timer").default(true),
  allowSkip: boolean("allow_skip").default(true),
  allowReview: boolean("allow_review").default(true),
}, (table) => {
  return {
    userIdIdx: index("simulation_user_id_idx").on(table.userId),
    startTimeIdx: index("simulation_start_time_idx").on(table.startTime),
    completedIdx: index("simulation_completed_idx").on(table.isCompleted),
  };
});

export const examSimulationLogs = pgTable("exam_simulation_logs", {
  id: serial("id").primaryKey(),
  simulationId: integer("simulation_id").notNull().references(() => examSimulations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  timeSpent: integer("time_spent").notNull(),
  isCorrect: boolean("is_correct"),
  answer: integer("answer"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => {
  return {
    simulationIdIdx: index("simulation_log_sim_id_idx").on(table.simulationId),
    userIdIdx: index("simulation_log_user_id_idx").on(table.userId),
    questionIdIdx: index("simulation_log_question_id_idx").on(table.questionId),
    timestampIdx: index("simulation_log_timestamp_idx").on(table.timestamp),
  };
});

// Update the insertUserSchema to include role
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
}).extend({
  role: z.enum(userRoles).default("student"),
});

export const updateProfileSchema = createInsertSchema(users).pick({
  displayName: true,
  bio: true,
  email: true,
  phoneNumber: true,
  theme: true,
  preferences: true,
});

export const insertQuestionSchema = createInsertSchema(questions);
export const insertExamSchema = createInsertSchema(exams);
export const insertPaymentSchema = createInsertSchema(payments);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
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


// Create insert schemas
export const insertExamSimulationSchema = createInsertSchema(examSimulations).omit({
  id: true,
  isCompleted: true,
  currentQuestionIndex: true,
  answers: true,
});

export const insertExamSimulationLogSchema = createInsertSchema(examSimulationLogs).omit({
  id: true,
  timestamp: true,
});

// Export types
export type ExamSimulation = typeof examSimulations.$inferSelect;
export type InsertExamSimulation = z.infer<typeof insertExamSimulationSchema>;
export type ExamSimulationLog = typeof examSimulationLogs.$inferSelect;
export type InsertExamSimulationLog = z.infer<typeof insertExamSimulationLogSchema>;