import { User, InsertUser, Question, Exam, Payment, Settings, PackageType } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { log } from "./vite";

const MemoryStore = createMemoryStore(session);
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

  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private questions: Map<number, Question>;
  private exams: Map<number, Exam>;
  private payments: Map<number, Payment>;
  private settings: Map<string, Settings>;
  sessionStore: session.Store;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.questions = new Map();
    this.exams = new Map();
    this.payments = new Map();
    this.settings = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Clear expired entries every 24h
    });

    // Create default admin user
    this.createDefaultAdmin();
  }

  private async createDefaultAdmin() {
    try {
      const adminPassword = await hashPassword("admin");
      const admin: User = {
        id: this.currentId++,
        username: "admin",
        password: adminPassword,
        isAdmin: true,
        role: "admin",
        isActive: true,
        theme: "system",
        preferences: {
          emailNotifications: true,
          smsNotifications: false,
          language: "en"
        }
      };
      this.users.set(admin.id, admin);
      log("Default admin user created");
    } catch (error) {
      log(`Error creating default admin: ${error.message}`);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const existingUser = await this.getUserByUsername(insertUser.username);
    if (existingUser) {
      throw new Error("Username already exists");
    }

    const id = this.currentId++;
    const hashedPassword = await hashPassword(insertUser.password);

    const user: User = {
      id,
      username: insertUser.username,
      password: hashedPassword,
      isAdmin: insertUser.role === "admin",
      role: insertUser.role,
      isActive: true,
      theme: "system",
      preferences: {
        emailNotifications: true,
        smsNotifications: false,
        language: "en"
      }
    };

    this.users.set(id, user);
    log(`New user created: ${user.username}`);
    return user;
  }

  async getQuestions(): Promise<Question[]> {
    return Array.from(this.questions.values());
  }

  async getQuestionsByCategory(category: string): Promise<Question[]> {
    return Array.from(this.questions.values()).filter(q => q.category === category);
  }

  async createQuestion(question: Omit<Question, "id">): Promise<Question> {
    const id = this.currentId++;
    const newQuestion = { ...question, id };
    this.questions.set(id, newQuestion);
    return newQuestion;
  }

  async updateQuestion(id: number, questionUpdate: Partial<Question>): Promise<Question> {
    const question = this.questions.get(id);
    if (!question) throw new Error("Question not found");
    const updatedQuestion = { ...question, ...questionUpdate };
    this.questions.set(id, updatedQuestion);
    return updatedQuestion;
  }

  async deleteQuestion(id: number): Promise<void> {
    this.questions.delete(id);
  }

  async createExam(exam: Omit<Exam, "id">): Promise<Exam> {
    const id = this.currentId++;
    const newExam = { ...exam, id };
    this.exams.set(id, newExam);
    return newExam;
  }

  async getExam(id: number): Promise<Exam | undefined> {
    return this.exams.get(id);
  }

  async updateExam(id: number, examUpdate: Partial<Exam>): Promise<Exam> {
    const exam = this.exams.get(id);
    if (!exam) throw new Error("Exam not found");
    const updatedExam = { ...exam, ...examUpdate };
    this.exams.set(id, updatedExam);
    return updatedExam;
  }

  async createPayment(payment: Omit<Payment, "id">): Promise<Payment> {
    const id = this.currentId++;
    const newPayment = { ...payment, id };
    this.payments.set(id, newPayment);
    return newPayment;
  }

  async getActivePayment(userId: number): Promise<Payment | undefined> {
    const now = new Date();
    return Array.from(this.payments.values()).find(
      p => p.userId === userId && p.validUntil > now
    );
  }

  async getSetting(key: string): Promise<Settings | undefined> {
    return this.settings.get(key);
  }

  async setSetting(key: string, value: any): Promise<Settings> {
    const setting = { id: this.currentId++, key, value };
    this.settings.set(key, setting);
    return setting;
  }
}

export const storage = new MemStorage();