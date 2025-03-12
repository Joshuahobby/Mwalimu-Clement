
import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { getPoolStatus, wakeupDatabase, checkDatabaseHealth } from '../db';
import { pool } from '../db';

// Type definitions
interface QueryStats {
  count: number;
  totalTime: number;
  avgTime: number;
  slowQueries: Array<{
    query: string;
    time: number;
    timestamp: Date;
  }>;
}

class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private queryStats: Map<string, QueryStats>;
  private slowQueryThreshold: number;
  private originalQuery: typeof pool.query;
  private lastCheck: Date = new Date();
  private isHealthy: boolean = false;
  private stats: any = {};

  private constructor() {
    this.queryStats = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    this.originalQuery = pool.query;
    this.startPeriodicCleanup();
    this.updateStats();
    // Update stats periodically
    setInterval(() => this.updateStats(), 30000);
  }

  public static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }

  private startPeriodicCleanup() {
    setInterval(() => {
      this.queryStats.clear();
    }, 3600000); // Clear stats every hour
  }

  async updateStats() {
    try {
      this.lastCheck = new Date();
      this.isHealthy = await checkDatabaseHealth(1);
      this.stats = getPoolStatus();
    } catch (error) {
      console.error('Error updating DB stats:', error);
      this.isHealthy = false;
    }
  }

  public recordQuery(query: string, time: number) {
    const stats = this.queryStats.get(query) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      slowQueries: [],
    };

    stats.count++;
    stats.totalTime += time;
    stats.avgTime = stats.totalTime / stats.count;

    if (time > this.slowQueryThreshold) {
      stats.slowQueries.push({
        query,
        time,
        timestamp: new Date(),
      });
    }

    this.queryStats.set(query, stats);
  }

  public getStats() {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastCheck.toISOString(),
      poolStats: this.stats,
      queryStats: Object.fromEntries(this.queryStats),
      poolStatus: getPoolStatus(),
    };
  }

  public monitorQuery() {
    const originalQuery = this.originalQuery;
    const monitor = this;

    return function(...args: any[]) {
      const queryStart = Date.now();
      const queryText = typeof args[0] === 'string' ? args[0] : args[0]?.text || 'unknown query';

      // Handle both Promise-based and callback-based query calls
      if (typeof args[args.length - 1] === 'function') {
        // Callback style
        const callback = args[args.length - 1];
        args[args.length - 1] = function(err: Error | null, result: any) {
          const queryTime = Date.now() - queryStart;
          monitor.recordQuery(queryText, queryTime);
          callback(err, result);
        };
        return originalQuery.apply(pool, args);
      } else {
        // Promise style
        return originalQuery.apply(pool, args).then((result: any) => {
          const queryTime = Date.now() - queryStart;
          monitor.recordQuery(queryText, queryTime);
          return result;
        }).catch((error: Error) => {
          const queryTime = Date.now() - queryStart;
          monitor.recordQuery(queryText, queryTime);
          throw error;
        });
      }
    };
  }

  public restoreQuery() {
    pool.query = this.originalQuery;
  }
}

export const dbMonitor = DatabaseMonitor.getInstance();

export function monitorDatabase(req: Request, res: Response, next: NextFunction) {
  // Add database status to the request for logging/debugging
  req.dbStatus = dbMonitor.getStats().isHealthy ? 'connected' : 'disconnected';

  // Monkey patch the query method to monitor execution time
  pool.query = dbMonitor.monitorQuery();

  res.on('finish', () => {
    // Restore original query method
    dbMonitor.restoreQuery();
  });

  next();
}

// Health check endpoint middleware with wake-up capability
export async function healthCheck(req: Request, res: Response) {
  const stats = dbMonitor.getStats();
  const forceWakeup = req.query.wakeup === 'true';

  if (forceWakeup || !stats.isHealthy) {
    console.log('Health check requested database wakeup');
    const wakeupSuccessful = await wakeupDatabase();
    if (wakeupSuccessful) {
      await dbMonitor.updateStats();
    }
  }

  res.json({
    status: stats.isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    lastCheck: stats.lastCheck,
    database: {
      status: stats.isHealthy ? 'connected' : 'disconnected',
      pool: stats.poolStats,
      wakeupAttempted: forceWakeup || !stats.isHealthy,
      wakeupSuccessful: stats.isHealthy
    }
  });
}

// Extend Express Request interface to include dbStatus
declare global {
  namespace Express {
    interface Request {
      dbStatus?: string;
    }
  }
}
