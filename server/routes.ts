import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertQuestionSchema, packagePrices, examSimulations, examSimulationLogs } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Questions Management
  app.get("/api/questions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const questions = await storage.getQuestions();
    res.json(questions);
  });

  app.post("/api/questions", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);
    const question = await storage.createQuestion(req.body);
    res.json(question);
  });

  app.patch("/api/questions/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);
    const question = await storage.updateQuestion(parseInt(req.params.id), req.body);
    res.json(question);
  });

  app.delete("/api/questions/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);
    await storage.deleteQuestion(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Exam Simulation Routes
  app.post("/api/simulations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const [activeSimulation] = await db
      .select()
      .from(examSimulations)
      .where(
        and(
          eq(examSimulations.userId, req.user.id),
          eq(examSimulations.isCompleted, false)
        )
      );

    if (activeSimulation) {
      return res.status(400).json({ message: "You already have an active simulation" });
    }

    const [simulation] = await db
      .insert(examSimulations)
      .values({
        userId: req.user.id,
        startTime: new Date(),
        questions: req.body.questions,
        timePerQuestion: req.body.timePerQuestion,
        showFeedback: req.body.showFeedback,
        showTimer: req.body.showTimer,
        allowSkip: req.body.allowSkip,
        allowReview: req.body.allowReview,
      })
      .returning();

    res.json(simulation);
  });

  app.get("/api/simulations/active", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const [simulation] = await db
      .select()
      .from(examSimulations)
      .where(
        and(
          eq(examSimulations.userId, req.user.id),
          eq(examSimulations.isCompleted, false)
        )
      )
      .orderBy(desc(examSimulations.startTime))
      .limit(1);

    if (!simulation) {
      return res.status(404).json({ message: "No active simulation found" });
    }

    res.json(simulation);
  });

  app.post("/api/simulations/:id/answer", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const simulationId = parseInt(req.params.id);
    const [simulation] = await db
      .select()
      .from(examSimulations)
      .where(eq(examSimulations.id, simulationId));

    if (!simulation || simulation.userId !== req.user.id) {
      return res.status(403).json({ message: "Simulation not found or unauthorized" });
    }

    const question = await storage.getQuestion(req.body.questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Record the answer
    const isCorrect = req.body.answer === question.correctAnswer;
    await db.insert(examSimulationLogs).values({
      simulationId,
      userId: req.user.id,
      questionId: req.body.questionId,
      timeSpent: req.body.timeSpent || 0,
      isCorrect,
      answer: req.body.answer,
    });

    // Update simulation answers
    const answers = simulation.answers || [];
    answers[simulation.currentQuestionIndex] = req.body.answer;

    await db
      .update(examSimulations)
      .set({ answers })
      .where(eq(examSimulations.id, simulationId));

    res.json({ isCorrect });
  });

  app.post("/api/simulations/:id/complete", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const simulationId = parseInt(req.params.id);
    const [simulation] = await db
      .update(examSimulations)
      .set({
        isCompleted: true,
        endTime: new Date(),
      })
      .where(
        and(
          eq(examSimulations.id, simulationId),
          eq(examSimulations.userId, req.user.id)
        )
      )
      .returning();

    if (!simulation) {
      return res.status(404).json({ message: "Simulation not found" });
    }

    res.json(simulation);
  });

  app.patch("/api/simulations/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const simulationId = parseInt(req.params.id);
    const [simulation] = await db
      .update(examSimulations)
      .set(req.body)
      .where(
        and(
          eq(examSimulations.id, simulationId),
          eq(examSimulations.userId, req.user.id)
        )
      )
      .returning();

    if (!simulation) {
      return res.status(404).json({ message: "Simulation not found" });
    }

    res.json(simulation);
  });

  // Exams
  app.post("/api/exams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const activePayment = await storage.getActivePayment(req.user.id);
    if (!activePayment) return res.status(402).send("No active payment found");

    const questions = await storage.getQuestions();
    const randomQuestions = questions
      .sort(() => Math.random() - 0.5)
      .slice(0, 20)
      .map(q => q.id);

    const exam = await storage.createExam({
      userId: req.user.id,
      startTime: new Date(),
      endTime: null,
      score: null,
      questions: randomQuestions,
      answers: [],
    });

    res.json(exam);
  });

  app.patch("/api/exams/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const exam = await storage.getExam(parseInt(req.params.id));
    if (!exam || exam.userId !== req.user.id) return res.sendStatus(403);

    const updatedExam = await storage.updateExam(exam.id, req.body);
    res.json(updatedExam);
  });

  // Payments
  app.post("/api/payments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { packageType } = req.body;
    const amount = packagePrices[packageType as keyof typeof packagePrices];
    if (!amount) return res.status(400).send("Invalid package type");

    const validUntil = new Date();
    switch (packageType) {
      case "single": validUntil.setHours(validUntil.getHours() + 1); break;
      case "daily": validUntil.setDate(validUntil.getDate() + 1); break;
      case "weekly": validUntil.setDate(validUntil.getDate() + 7); break;
      case "monthly": validUntil.setMonth(validUntil.getMonth() + 1); break;
    }

    const payment = await storage.createPayment({
      userId: req.user.id,
      amount,
      packageType,
      validUntil,
      createdAt: new Date(),
      status: "completed",
      username: req.user.username,
    });

    res.json(payment);
  });

  const httpServer = createServer(app);
  return httpServer;
}