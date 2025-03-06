import { User, InsertUser, Question, Exam, Payment, Settings, PackageType, users, questions, exams, payments, settings, AuditLog, InsertAuditLog, AuditActionType, auditLogs } from "@shared/schema";
import { db } from "./db";
import session from "express-session";
import { eq, and, desc, sql } from "drizzle-orm";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { log } from "./vite";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Question operations
  getQuestions(): Promise<Question[]>;
  getQuestionsByCategory(category: string): Promise<Question[]>;
  createQuestion(question: Omit<Question, "id">): Promise<Question>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;
  getQuestion(id: number): Promise<Question | undefined>;

  // Exam operations
  createExam(exam: Omit<Exam, "id">): Promise<Exam>;
  getExam(id: number): Promise<Exam | undefined>;
  updateExam(id: number, exam: Partial<Exam>): Promise<Exam>;

  // Payment operations
  createPayment(payment: Omit<Payment, "id">): Promise<Payment>;
  getActivePayment(userId: number): Promise<Payment | undefined>;

  // Settings operations
  getSetting(key: string): Promise<Settings | undefined>;
  setSetting(key: string, value: any): Promise<Settings>;

  // Audit log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(options: {
    adminId?: number;
    actionType?: AuditActionType;
    targetType?: string;
    targetId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set");
    }
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    });

    // Create default admin user
    this.createDefaultAdmin();
  }

  private async createDefaultAdmin() {
    try {
      const existingAdmin = await this.getUserByUsername("admin");
      if (!existingAdmin) {
        const adminPassword = await hashPassword("admin");
        const admin: InsertUser = {
          username: "admin",
          password: adminPassword,
          role: "admin",
        };
        await this.createUser(admin);
        log("Default admin user created");
      }
    } catch (error) {
      if (error instanceof Error) {
        log(`Error creating default admin: ${error.message}`);
      }
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const existingUser = await this.getUserByUsername(insertUser.username);
    if (existingUser) {
      throw new Error("Username already exists");
    }

    const [user] = await db.insert(users).values({
      ...insertUser,
      isAdmin: insertUser.role === "admin",
      theme: "system",
      preferences: {
        emailNotifications: true,
        smsNotifications: false,
        language: "en"
      },
    }).returning();

    log(`New user created: ${user.username}`);
    return user;
  }

  async getQuestions(): Promise<Question[]> {
    return db.select().from(questions);
  }

  async getQuestionsByCategory(category: string): Promise<Question[]> {
    return db.select().from(questions).where(eq(questions.category, category));
  }

  async createQuestion(question: Omit<Question, "id">): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async updateQuestion(id: number, questionUpdate: Partial<Question>): Promise<Question> {
    const [updatedQuestion] = await db
      .update(questions)
      .set(questionUpdate)
      .where(eq(questions.id, id))
      .returning();
    if (!updatedQuestion) throw new Error("Question not found");
    return updatedQuestion;
  }

  async deleteQuestion(id: number): Promise<void> {
    await db.delete(questions).where(eq(questions.id, id));
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question;
  }

  async createExam(exam: Omit<Exam, "id">): Promise<Exam> {
    const [newExam] = await db.insert(exams).values(exam).returning();
    return newExam;
  }

  async getExam(id: number): Promise<Exam | undefined> {
    const [exam] = await db.select().from(exams).where(eq(exams.id, id));
    return exam;
  }

  async updateExam(id: number, examUpdate: Partial<Exam>): Promise<Exam> {
    const [updatedExam] = await db
      .update(exams)
      .set(examUpdate)
      .where(eq(exams.id, id))
      .returning();
    if (!updatedExam) throw new Error("Exam not found");
    return updatedExam;
  }

  async createPayment(payment: Omit<Payment, "id">): Promise<Payment> {
    try {
      const [newPayment] = await db
        .insert(payments)
        .values(payment)
        .returning();
      return newPayment;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw new Error('Failed to create payment');
    }
  }

  async getActivePayment(userId: number): Promise<Payment | undefined> {
    try {
      const [activePayment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.userId, userId),
            eq(payments.status, "completed"),
            sql`valid_until > CURRENT_TIMESTAMP`
          )
        )
        .orderBy(desc(payments.createdAt))
        .limit(1);

      return activePayment;
    } catch (error) {
      console.error('Error fetching active payment:', error);
      throw new Error('Failed to fetch active payment');
    }
  }

  async getSetting(key: string): Promise<Settings | undefined> {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    return setting;
  }

  async setSetting(key: string, value: any): Promise<Settings> {
    const [setting] = await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value },
      })
      .returning();
    return setting;
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    try {
      const [newLog] = await db.insert(auditLogs).values([log]).returning();
      return newLog;
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw new Error('Failed to create audit log');
    }
  }

  async getAuditLogs(options: {
    adminId?: number;
    actionType?: AuditActionType;
    targetType?: string;
    targetId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let baseQuery = db.select().from(auditLogs);

    const conditions = [];

    if (options.adminId) {
      conditions.push(eq(auditLogs.adminId, options.adminId));
    }
    if (options.actionType) {
      conditions.push(eq(auditLogs.actionType, options.actionType));
    }
    if (options.targetType) {
      conditions.push(eq(auditLogs.targetType, options.targetType));
    }
    if (options.targetId) {
      conditions.push(eq(auditLogs.targetId, options.targetId));
    }
    if (options.startDate) {
      conditions.push(sql`${auditLogs.createdAt} >= ${options.startDate}`);
    }
    if (options.endDate) {
      conditions.push(sql`${auditLogs.createdAt} <= ${options.endDate}`);
    }

    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions));
    }

    if (options.limit) {
      baseQuery = baseQuery.limit(options.limit);
    }
    if (options.offset) {
      baseQuery = baseQuery.offset(options.offset);
    }

    return baseQuery.orderBy(desc(auditLogs.createdAt));
  }
}

export const storage = new DatabaseStorage();