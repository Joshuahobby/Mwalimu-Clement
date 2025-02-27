import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertQuestionSchema, packagePrices } from "@shared/schema";

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
    const amount = packagePrices[packageType];
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
    });

    res.json(payment);
  });

  const httpServer = createServer(app);
  return httpServer;
}
