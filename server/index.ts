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

// More detailed error handling middleware with specific error types
const handleErrors = (err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Different error types based on status code
  const errorTypes: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Error',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };

  // Log detailed error for debugging
  console.error('Error:', {
    type: errorTypes[status] || 'Unknown Error',
    status,
    message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: req.user?.id,
    stack: err.stack,
    details: err.details || {}
  });

  // Send sanitized error response
  res.status(status).json({ 
    error: errorTypes[status] || 'Unknown Error',
    message: status === 500 ? "Internal Server Error" : message,
    code: status,
    // Include request ID for tracking in logs
    requestId: req.headers['x-request-id'] || Date.now().toString(36)
  });
};


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

  // Use the enhanced error handler
  app.use(handleErrors);

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