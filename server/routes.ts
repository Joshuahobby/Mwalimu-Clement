import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertQuestionSchema, packagePrices, payments } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import { initiatePayment, verifyPayment, verifyWebhookSignature } from "./services/flutterwave";
import { updateProfileSchema } from "@shared/schema"; 
import { users } from "@shared/schema"; 

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Profile Update Route
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const validation = updateProfileSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const [updatedUser] = await db
        .update(users)
        .set({
          ...validation.data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user.id))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      Object.assign(req.user, updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({
        message: "Failed to update profile",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Avatar Upload Route
  app.post("/api/user/avatar", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user.username}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user.id))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      Object.assign(req.user, updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({
        message: "Failed to upload avatar",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

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

    const isCorrect = req.body.answer === question.correctAnswer;
    await db.insert(examSimulationLogs).values({
      simulationId,
      userId: req.user.id,
      questionId: req.body.questionId,
      timeSpent: req.body.timeSpent || 0,
      isCorrect,
      answer: req.body.answer,
    });

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

  // Admin Package Management Routes
  app.get("/api/admin/packages", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);

    const packages = await db
      .select()
      .from(customPackages)
      .orderBy(desc(customPackages.createdAt));

    res.json(packages);
  });

  app.post("/api/admin/packages", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);

    const validation = insertCustomPackageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.errors });
    }

    const [newPackage] = await db
      .insert(customPackages)
      .values(validation.data)
      .returning();

    res.status(201).json(newPackage);
  });

  app.patch("/api/admin/packages/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);

    const packageId = parseInt(req.params.id);
    const [updatedPackage] = await db
      .update(customPackages)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(customPackages.id, packageId))
      .returning();

    if (!updatedPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.json(updatedPackage);
  });

  // Payment Routes
  app.post("/api/payments", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      let amount: number;
      let validUntil = new Date();
      let packageType = req.body.packageType;
      let paymentMethod = req.body.paymentMethod || 'mobilemoney';

      amount = packagePrices[packageType as keyof typeof packagePrices];
      if (!amount) {
        return res.status(400).json({ message: "Invalid package type" });
      }

      switch (packageType) {
        case "single": validUntil.setHours(validUntil.getHours() + 1); break;
        case "daily": validUntil.setDate(validUntil.getDate() + 1); break;
        case "weekly": validUntil.setDate(validUntil.getDate() + 7); break;
        case "monthly": validUntil.setMonth(validUntil.getMonth() + 1); break;
        default: return res.status(400).json({ message: "Invalid package type" });
      }

      if (!req.user.email) {
        return res.status(400).json({ 
          message: "Email is required for payment. Please update your profile with a valid email address.",
          code: "EMAIL_REQUIRED"
        });
      }

      const tx_ref = `DRV_${Date.now()}_${req.user.id}`;

      const [payment] = await db
        .insert(payments)
        .values({
          userId: req.user.id,
          amount,
          packageType,
          validUntil,
          createdAt: new Date(),
          status: "pending",
          username: req.user.username,
          metadata: {
            tx_ref,
            payment_method: paymentMethod,
            created_at: new Date().toISOString()
          }
        })
        .returning();

      if (!payment) {
        throw new Error("Failed to create payment record");
      }

      console.log('Created payment record:', payment);

      const paymentResponse = await initiatePayment(
        amount,
        req.user,
        packageType,
        `${req.protocol}://${req.get('host')}/api/payments/verify_by_reference`,
        paymentMethod
      );

      res.json(paymentResponse);
    } catch (error) {
      console.error('Payment creation error:', error);
      res.status(500).json({
        message: "Failed to process payment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Payment verification webhook (for Flutterwave callbacks)
  app.post("/api/payments/verify_by_reference", async (req, res) => {
    try {
      console.log('Payment verification webhook received:', req.body);

      const signature = req.headers['verif-hash'] || '';

      if (process.env.NODE_ENV === 'production' && !verifyWebhookSignature(signature as string, req.body)) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ message: "Invalid signature" });
      }

      const tx_ref = req.body.tx_ref || req.body.txRef;
      if (!tx_ref) {
        return res.status(400).json({ message: "Missing transaction reference" });
      }

      const transaction = await verifyPayment(tx_ref);

      if (transaction.status === "successful") {
        const [payment] = await db
          .update(payments)
          .set({
            status: "completed",
            metadata: {
              ...req.body,
              flutterwave_tx_ref: tx_ref,
              verified_at: new Date().toISOString(),
              verification_method: 'webhook'
            }
          })
          .where(
            and(
              eq(payments.status, "pending"),
              sql`payments.metadata->>'tx_ref' = ${tx_ref}`
            )
          )
          .returning();

        if (!payment) {
          console.error('Payment not found for tx_ref:', tx_ref);
          return res.status(404).json({ message: "Payment not found" });
        }

        console.log('Payment completed successfully:', payment);

        res.json({ status: "success", payment });
      } else {
        console.error('Payment verification failed. Status:', transaction.status);

        await db
          .update(payments)
          .set({
            status: "failed",
            metadata: {
              ...req.body,
              flutterwave_tx_ref: tx_ref,
              failed_at: new Date().toISOString(),
              failure_reason: transaction.status
            }
          })
          .where(
            and(
              eq(payments.status, "pending"),
              sql`payments.metadata->>'tx_ref' = ${tx_ref}`
            )
          );

        res.status(400).json({ message: "Payment verification failed", status: transaction.status });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({
        message: "Failed to verify payment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update the redirect verification handler
  app.get("/api/payments/verify_by_reference", async (req, res) => {
    try {
      console.log('Payment verification redirect received:', {
        query: req.query,
        user: req.user?.id
      });

      const { tx_ref, transaction_id, status } = req.query;

      if (!tx_ref) {
        console.error('Missing transaction reference in redirect');
        return res.redirect('/?error=missing_reference');
      }

      try {
        const transaction = await verifyPayment(tx_ref as string);
        console.log('Verification response:', JSON.stringify(transaction, null, 2));

        if (transaction.status === "successful") {
          console.log('Transaction verified successfully:', {
            tx_ref,
            transaction_id,
            status: transaction.status
          });

          // First find the payment, regardless of status
          const [pendingPayment] = await db
            .select()
            .from(payments)
            .where(
              sql`payments.metadata->>'tx_ref' = ${tx_ref}`
            );

          if (!pendingPayment) {
            console.error('No payment found for tx_ref:', tx_ref);
            
            // Create a payment record for this transaction if it doesn't exist
            if (req.isAuthenticated() && req.user.id) {
              console.log('Creating payment record for transaction:', tx_ref);
              
              // Default package type and validity
              const packageType = "single";
              let validUntil = new Date();
              validUntil.setHours(validUntil.getHours() + 1);
              
              try {
                const [newPayment] = await db
                  .insert(payments)
                  .values({
                    userId: req.user.id,
                    amount: transaction.amountPaid || 200,
                    packageType,
                    validUntil,
                    createdAt: new Date(), // Add explicit createdAt
                    status: "completed",
                    username: req.user.username,
                    metadata: {
                      tx_ref,
                      transaction_id,
                      payment_method: transaction.paymentMethod || 'mobilemoney',
                      created_at: new Date().toISOString(),
                      verified_at: new Date().toISOString(),
                      verification_method: 'redirect_recovery'
                    }
                  })
                  .returning();
                  
                console.log('Created payment record for missing transaction:', newPayment);
                return res.redirect(`/?payment=success&tx_ref=${tx_ref}&recovered=true`);
              } catch (createError) {
                console.error('Error creating payment record:', createError);
              }
            }
            
            return res.redirect('/?error=payment_not_found&tx_ref=' + encodeURIComponent(tx_ref as string));
          }

          console.log('Found pending payment:', pendingPayment);

          const metadata = {
            ...pendingPayment.metadata,
            tx_ref,
            transaction_id,
            status: transaction.status,
            verified_at: new Date().toISOString(),
            verification_method: 'redirect',
            journey: {
              status: "initial",
              last_activity_at: new Date().toISOString()
            }
          };

          const [payment] = await db
            .update(payments)
            .set({
              status: "completed",
              metadata
            })
            .where(eq(payments.id, pendingPayment.id))
            .returning();

          if (!payment) {
            console.error('Failed to update payment record:', pendingPayment.id);
            return res.redirect('/?error=update_failed');
          }

          console.log('Payment completed successfully:', {
            id: payment.id,
            status: payment.status,
            metadata: payment.metadata
          });

          // Check if payment has expired
          const validUntil = new Date(payment.validUntil);
          if (validUntil < new Date()) {
            console.warn('Payment verified but already expired:', payment.id);
            let newValidUntil = new Date();
            switch (payment.packageType) {
              case "single": newValidUntil.setHours(newValidUntil.getHours() + 1); break;
              case "daily": newValidUntil.setDate(newValidUntil.getDate() + 1); break;
              case "weekly": newValidUntil.setDate(newValidUntil.getDate() + 7); break;
              case "monthly": newValidUntil.setMonth(newValidUntil.getMonth() + 1); break;
            }

            await db
              .update(payments)
              .set({
                validUntil: newValidUntil,
                metadata: {
                  ...payment.metadata,
                  originally_expired: true,
                  original_valid_until: payment.validUntil,
                  extended_at: new Date().toISOString()
                }
              })
              .where(eq(payments.id, payment.id));

            console.log(`Extended expired payment ${payment.id} validity to ${newValidUntil}`);
          }

          console.log('Redirecting to dashboard with successful payment notification');
          return res.redirect(`/?payment=success&tx_ref=${tx_ref}`);
        } else {
          console.error('Payment verification failed. Status:', transaction.status);
          return res.redirect('/?payment=failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.redirect('/?error=verification_failed&details=' + encodeURIComponent(errorMessage));
      }
    } catch (error) {
      console.error('Payment verification route error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect('/?error=verification_failed&details=' + encodeURIComponent(errorMessage));
    }
  });

  // Add journey tracking endpoint
  app.post("/api/payments/journey", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { status, questionCount, correctAnswers, timeSpent } = req.body;

      // Get active payment
      const [payment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.userId, req.user.id),
            eq(payments.status, "completed"),
            sql`valid_until > NOW()`
          )
        )
        .orderBy(desc(payments.createdAt))
        .limit(1);

      if (!payment) {
        return res.status(404).json({ message: "No active payment found" });
      }

      // Update journey tracking data
      const currentJourney = payment.metadata?.journey || {
        status: "initial",
        total_questions_attempted: 0,
        correct_answers: 0,
        time_spent_minutes: 0
      };

      const updatedJourney = {
        ...currentJourney,
        status,
        last_activity_at: new Date().toISOString(),
        total_questions_attempted: (currentJourney.total_questions_attempted || 0) + (questionCount || 0),
        correct_answers: (currentJourney.correct_answers || 0) + (correctAnswers || 0),
        time_spent_minutes: (currentJourney.time_spent_minutes || 0) + (timeSpent || 0)
      };

      // Add timestamps based on status
      if (status === 'exam_started' && !currentJourney.exam_started_at) {
        updatedJourney.exam_started_at = new Date().toISOString();
      } else if (status === 'practice_completed' && !currentJourney.practice_completed_at) {
        updatedJourney.practice_completed_at = new Date().toISOString();
      } else if (status === 'exam_completed' && !currentJourney.exam_completed_at) {
        updatedJourney.exam_completed_at = new Date().toISOString();
      }

      const [updatedPayment] = await db
        .update(payments)
        .set({
          metadata: {
            ...payment.metadata,
            journey: updatedJourney
          }
        })
        .where(eq(payments.id, payment.id))
        .returning();

      res.json(updatedPayment);
    } catch (error) {
      console.error('Journey update error:', error);
      res.status(500).json({
        message: "Failed to update journey",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Add more detailed logging to the active payment endpoint
  app.get("/api/payments/active", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      console.log('Fetching active payment for user:', req.user.id);

      const [payment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.userId, req.user.id),
            eq(payments.status, "completed"),
            sql`valid_until > NOW()`
          )
        )
        .orderBy(desc(payments.createdAt))
        .limit(1);

      if (!payment) {
        console.log('No active payment found for user:', req.user.id);
        return res.status(404).json({ message: "No active payment found" });
      }

      console.log('Found active payment:', {
        id: payment.id,
        status: payment.status,
        validUntil: payment.validUntil,
        journey: payment.metadata?.journey
      });

      res.json(payment);
    } catch (error) {
      console.error('Error fetching active payment:', error);
      res.status(500).json({ message: "Failed to fetch active payment" });
    }
  });

  app.get("/api/payments/history", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const userPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.userId, req.user.id))
        .orderBy(desc(payments.createdAt));

      res.json(userPayments);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });
  
  // User Progress API endpoint
  app.get("/api/user/progress", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Get the active payment to access journey data
      const [activePayment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.userId, req.user.id),
            eq(payments.status, "completed"),
            sql`valid_until > NOW()`
          )
        )
        .orderBy(desc(payments.createdAt))
        .limit(1);

      // Get completed exams
      const userExams = await db
        .select()
        .from(exams)
        .where(
          and(
            eq(exams.userId, req.user.id),
            sql`score IS NOT NULL`
          )
        )
        .orderBy(desc(exams.startTime));

      // Get simulation logs for category performance
      const simulationLogs = await db
        .select({
          simulationLog: examSimulationLogs,
          question: questions
        })
        .from(examSimulationLogs)
        .leftJoin(questions, eq(examSimulationLogs.questionId, questions.id))
        .where(eq(examSimulationLogs.userId, req.user.id));

      // Process exam results
      const recentExams = userExams.slice(0, 5).map(exam => ({
        id: exam.id,
        score: exam.score || 0,
        startTime: exam.startTime.toISOString(),
        endTime: exam.endTime?.toISOString() || new Date().toISOString(),
        questionCount: exam.questions.length,
      }));

      const totalExams = userExams.length;
      const avgScore = userExams.length > 0 
        ? userExams.reduce((sum, exam) => sum + (exam.score || 0), 0) / userExams.length
        : 0;
      const passCount = userExams.filter(exam => (exam.score || 0) >= 70).length;
      const passRate = totalExams > 0 ? (passCount / totalExams) * 100 : 0;

      // Process category performance
      const categoryStats: Record<string, { correct: number, total: number }> = {};
      simulationLogs.forEach(log => {
        if (log.question && log.simulationLog) {
          const category = log.question.category;
          if (!categoryStats[category]) {
            categoryStats[category] = { correct: 0, total: 0 };
          }
          categoryStats[category].total += 1;
          if (log.simulationLog.isCorrect) {
            categoryStats[category].correct += 1;
          }
        }
      });

      const categoryPerformance = Object.entries(categoryStats).map(([category, stats]) => ({
        category,
        correctCount: stats.correct,
        totalCount: stats.total,
        percentage: Math.round((stats.correct / stats.total) * 100)
      }));

      // Generate weekly activity data
      const today = new Date();
      const weeklyActivity = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        // Count questions attempted on this day
        const dayQuestions = simulationLogs.filter(log => {
          const logDate = new Date(log.simulationLog.timestamp);
          return logDate.toDateString() === date.toDateString();
        }).length;
        
        weeklyActivity.push({
          date: dateString,
          questions: dayQuestions
        });
      }

      // Calculate total questions from payment journey or logs
      const totalQuestions = activePayment?.metadata?.journey?.total_questions_attempted || 
        simulationLogs.length;

      const progressData = {
        totalExams,
        avgScore,
        passRate,
        totalQuestions,
        journey: activePayment?.metadata?.journey,
        recentExams,
        categoryPerformance,
        weeklyActivity
      };

      res.json(progressData);
    } catch (error) {
      console.error('Error fetching user progress:', error);
      res.status(500).json({ 
        message: "Failed to fetch progress data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/payments/status", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { tx_ref } = req.query;

      if (!tx_ref) {
        return res.status(400).json({ message: "Transaction reference is required" });
      }

      const [paymentRecord] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.userId, req.user.id),
            sql`payments.metadata->>'tx_ref' = ${tx_ref}`
          )
        );

      if (paymentRecord && paymentRecord.status === 'completed') {
        return res.json({
          payment: paymentRecord,
          transaction: {
            status: 'successful',
            transactionId: paymentRecord.metadata?.transaction_id || 'N/A',
            amountPaid: paymentRecord.amount,
            currency: 'RWF',
            paymentMethod: paymentRecord.metadata?.payment_method || 'unknown',
            createdAt: paymentRecord.createdAt,
          }
        });
      }

      try {
        const transaction = await verifyPayment(tx_ref as string);

        if (transaction.status === 'successful' && paymentRecord && paymentRecord.status !== 'completed') {
          await db
            .update(payments)
            .set({
              status: 'completed',
              metadata: {
                ...paymentRecord.metadata,
                transaction_id: transaction.transactionId,
                verified_at: new Date().toISOString(),
                verification_method: 'manual_check'
              }
            })
            .where(eq(payments.id, paymentRecord.id));
        }

        res.json({
          payment: paymentRecord || null,
          transaction
        });
      } catch (verifyError) {
        console.error('Verification error for tx_ref:', tx_ref, verifyError);
        
        // Return a more graceful response instead of letting the error propagate
        res.json({
          payment: paymentRecord || null,
          transaction: {
            status: 'unknown',
            message: 'Could not verify transaction status',
            error: verifyError instanceof Error ? verifyError.message : 'Unknown error'
          }
        });
      }
    } catch (error) {
      console.error('Error checking transaction status:', error);
      res.status(500).json({
        message: "Failed to check transaction status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/payments/retry", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { paymentId } = req.body;
      if (!paymentId) {
        return res.status(400).json({ message: "Payment ID is required" });
      }

      const [existingPayment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, parseInt(paymentId)),
            eq(payments.userId, req.user.id)
          )
        );

      if (!existingPayment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      if (existingPayment.status === "completed") {
        return res.status(400).json({ message: "Payment is already completed" });
      }

      const tx_ref = `DRV_RETRY_${Date.now()}_${req.user.id}`;
      const paymentMethod = req.body.paymentMethod || existingPayment.metadata?.payment_method || 'mobilemoney';

      await db
        .update(payments)
        .set({
          status: "pending",
          metadata: {
            ...existingPayment.metadata,
            tx_ref,
            payment_method: paymentMethod,
            retry_count: ((existingPayment.metadata?.retry_count || 0) + 1),
            last_retry: new Date().toISOString()
          }
        })
        .where(eq(payments.id, existingPayment.id));

      const paymentResponse = await initiatePayment(
        existingPayment.amount,
        req.user,
        existingPayment.packageType as any,
        `${req.protocol}://${req.get('host')}/api/payments/verify_by_reference`,
        paymentMethod
      );

      res.json(paymentResponse);
    } catch (error) {
      console.error('Payment retry error:', error);
      res.status(500).json({
        message: "Failed to retry payment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/admin/analytics/payments", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);

    const timeframe = req.query.timeframe || 'month';
    let startDate = new Date();

    switch(timeframe) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const [result] = await db
      .select({
        totalRevenue: sql`sum(amount)::integer`,
        totalPayments: sql`count(*)::integer`,
        completedPayments: sql`count(*) filter (where status = 'completed')::integer`,
        refundedPayments: sql`count(*) filter (where status = 'refunded')::integer`,
      })
      .from(payments)
      .where(sql`created_at >= ${startDate}`);

    const packageStats = await db
      .select({
        packageType: payments.packageType,
        count: sql`count(*)::integer`,
        revenue: sql`sum(amount)::integer`,
      })
      .from(payments)
      .where(sql`created_at >= ${startDate}`)
      .groupBy(payments.packageType);

    res.json({
      summary: result,
      packageStats,
    });
  });

  app.post("/api/admin/payments/:id/refund", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);

      const paymentId = parseInt(req.params.id);
      const { reason } = req.body;

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId));

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      if (payment.status !== "completed") {
        return res.status(400).json({ message: "Only completed payments can be refunded" });
      }

      const [refundedPayment] = await db
        .update(payments)
        .set({
          status: "refunded",
          metadata: {
            ...payment.metadata,
            refunded_at: new Date().toISOString(),
            refund_reason: reason,
            refunded_by: req.user.username,
          }
        })
        .where(eq(payments.id, paymentId))
        .returning();


      console.log('Payment refunded:', refundedPayment);

      res.json({
        message: "Payment refunded successfully",
        payment: refundedPayment
      });
    } catch (error) {
      console.error('Payment refund error:', error);
      res.status(500).json({
        message: "Failed to process refund",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}