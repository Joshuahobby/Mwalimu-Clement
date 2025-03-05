import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { monitorDatabase, healthCheck } from "./middleware/db-monitor";
import { checkDatabaseHealth, closePool } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add database monitoring middleware
app.use(monitorDatabase);

// Add health check endpoint before Vite middleware to avoid HTML response
app.get('/api/health', healthCheck);

// Add request logging with sensitive data masking
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    // Mask sensitive data
    if (bodyJson && typeof bodyJson === 'object') {
      const maskedBody = { ...bodyJson };
      ['password', 'token', 'secret'].forEach(key => {
        if (key in maskedBody) {
          maskedBody[key] = '***';
        }
      });
      capturedJsonResponse = maskedBody;
    } else {
      capturedJsonResponse = bodyJson;
    }
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Check database health before starting the server
  const isDatabaseHealthy = await checkDatabaseHealth();
  if (!isDatabaseHealthy) {
    log('Database health check failed. Exiting...');
    process.exit(1);
  }

  const server = await registerRoutes(app);

  // Global error handler with proper error response formatting
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details but send limited info to client
    console.error('Error:', {
      status,
      message,
      stack: err.stack,
      details: err.details || {}
    });

    // Send sanitized error response
    res.status(status).json({ 
      message: status === 500 ? "Internal Server Error" : message,
      code: status
    });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5000; // Changed from 3000 to 5000
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown with proper cleanup
  process.on('SIGTERM', async () => {
    log('SIGTERM received. Starting graceful shutdown...');
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      closePool() // Close database connections
    ]);
    log('Server and database connections closed');
    process.exit(0);
  });
})();