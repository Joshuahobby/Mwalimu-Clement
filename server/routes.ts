import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertQuestionSchema, packagePrices, payments } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import { initiatePayment, verifyPayment } from "./services/flutterwave";

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

      // Get package price
      amount = packagePrices[packageType as keyof typeof packagePrices];
      if (!amount) {
        return res.status(400).json({ message: "Invalid package type" });
      }

      // Calculate validity period
      switch (packageType) {
        case "single": validUntil.setHours(validUntil.getHours() + 1); break;
        case "daily": validUntil.setDate(validUntil.getDate() + 1); break;
        case "weekly": validUntil.setDate(validUntil.getDate() + 7); break;
        case "monthly": validUntil.setMonth(validUntil.getMonth() + 1); break;
        default: return res.status(400).json({ message: "Invalid package type" });
      }

      // Generate transaction reference
      const tx_ref = `DRV_${Date.now()}_${req.user.id}`;

      // Create pending payment record with tx_ref in metadata
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
            payment_method: paymentMethod
          }
        })
        .returning();

      if (!payment) {
        throw new Error("Failed to create payment record");
      }

      console.log('Created payment record:', payment);

      // Initiate Flutterwave payment
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

      // Get Flutterwave signature from headers
      const signature = req.headers['verif-hash'] || '';

      // Verify signature if in production mode
      if (process.env.NODE_ENV === 'production' && !verifyWebhookSignature(signature as string, req.body)) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ message: "Invalid signature" });
      }

      const tx_ref = req.body.tx_ref || req.body.txRef;
      if (!tx_ref) {
        return res.status(400).json({ message: "Missing transaction reference" });
      }

      // Verify transaction with Flutterwave API
      const transaction = await verifyPayment(tx_ref);

      if (transaction.status === "successful") {
        // Update payment status
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
        
        // Webhook notification could be sent here to inform client about payment success
        
        res.json({ status: "success", payment });
      } else {
        console.error('Payment verification failed. Status:', transaction.status);
        
        // Update payment record with failed status
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

  // Payment verification redirect handler (for browser redirects)
  app.get("/api/payments/verify_by_reference", async (req, res) => {
    try {
      console.log('Payment verification redirect received:', req.query);

      const { tx_ref, transaction_id, status } = req.query;

      if (!tx_ref) {
        console.error('Missing transaction reference in redirect');
        return res.redirect('/?error=missing_reference');
      }

      try {
        const transaction = await verifyPayment(tx_ref as string);
        console.log('Verification response:', JSON.stringify(transaction, null, 2));

        if (transaction.status === "successful") {
          // Update payment status
          const [payment] = await db
            .update(payments)
            .set({
              status: "completed",
              metadata: {
                tx_ref,
                transaction_id,
                status: transaction.status,
                verified_at: new Date().toISOString(),
                verification_method: 'redirect'
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
            return res.redirect('/?error=payment_not_found&tx_ref=' + encodeURIComponent(tx_ref as string));
          }

          console.log('Payment completed successfully:', payment);
          
          // Check if the payment has already expired
          const validUntil = new Date(payment.validUntil);
          if (validUntil < new Date()) {
            console.warn('Payment verified but already expired:', payment.id);
            // Extend validity by the original duration
            let newValidUntil = new Date();
            switch (payment.packageType) {
              case "single": newValidUntil.setHours(newValidUntil.getHours() + 1); break;
              case "daily": newValidUntil.setDate(newValidUntil.getDate() + 1); break;
              case "weekly": newValidUntil.setDate(newValidUntil.getDate() + 7); break;
              case "monthly": newValidUntil.setMonth(newValidUntil.getMonth() + 1); break;
            }
            
            // Update the payment validity
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
          
          // Redirect to payment status page with tx_ref
          return res.redirect(`/payment/status?tx_ref=${tx_ref}&status=success`);
        } else {
          console.error('Payment verification failed. Status:', transaction.status);
          // Redirect to payment status page with failure information
          return res.redirect(`/payment/status?tx_ref=${tx_ref}&status=${transaction.status}`);
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

  app.get("/api/payments/active", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const payment = await storage.getActivePayment(req.user.id);

      if (!payment) {
        return res.status(404).json({ message: "No active payment found" });
      }

      res.json(payment);
    } catch (error) {
      console.error('Error fetching active payment:', error);
      res.status(500).json({ message: "Failed to fetch active payment" });
    }
  });

  // Get user's payment history
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
  
  // Get status of a specific transaction
  app.get("/api/payments/status", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { tx_ref } = req.query;
      
      if (!tx_ref) {
        return res.status(400).json({ message: "Transaction reference is required" });
      }
      
      // First check if we have this payment in our database
      const [paymentRecord] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.userId, req.user.id),
            sql`payments.metadata->>'tx_ref' = ${tx_ref}`
          )
        );
        
      // If we have a completed payment, return its status
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
      
      // If not completed or not found, verify with Flutterwave
      const transaction = await verifyPayment(tx_ref as string);
      
      // If payment is successful but our record doesn't show it, update our record
      if (transaction.status === 'successful' && paymentRecord && paymentRecord.status !== 'completed') {
        // Update payment record
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
    } catch (error) {
      console.error('Error checking transaction status:', error);
      res.status(500).json({ 
        message: "Failed to check transaction status", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Payment retry endpoint
  app.post("/api/payments/retry", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { paymentId } = req.body;
      if (!paymentId) {
        return res.status(400).json({ message: "Payment ID is required" });
      }

      // Get the failed payment
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

      // Generate new transaction reference
      const tx_ref = `DRV_RETRY_${Date.now()}_${req.user.id}`;
      const paymentMethod = req.body.paymentMethod || existingPayment.metadata?.payment_method || 'mobilemoney';

      // Update the existing payment record with new tx_ref
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

      // Initiate Flutterwave payment
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

  // Payment Analytics for Admin
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

  // Admin refund endpoint
  app.post("/api/admin/payments/:id/refund", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);

      const paymentId = parseInt(req.params.id);
      const { reason } = req.body;

      // Get the payment
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

      // Update payment status to refunded
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

      // Here you would typically call Flutterwave's refund API
      // This would depend on your specific Flutterwave integration
      
      // For now, we just mark as refunded in our database
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

  // Add payment retry endpoint
  app.post("/api/payments/retry", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const { paymentId } = req.body;
      if (!paymentId) {
        return res.status(400).json({ message: "Payment ID is required" });
      }

      // Get the failed payment
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

      // Generate new transaction reference
      const tx_ref = `DRV_RETRY_${Date.now()}_${req.user.id}`;
      const paymentMethod = req.body.paymentMethod || existingPayment.metadata?.payment_method || 'mobilemoney';

      // Update the existing payment record with new tx_ref
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

      // Initiate Flutterwave payment
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


  // Admin refund endpoint
  app.post("/api/admin/payments/:id/refund", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(403);

      const paymentId = parseInt(req.params.id);
      const { reason } = req.body;

      // Get the payment
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

      // Update payment status to refunded
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

      // Here you would typically call Flutterwave's refund API
      // This would depend on your specific Flutterwave integration
      
      // For now, we just mark as refunded in our database
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
