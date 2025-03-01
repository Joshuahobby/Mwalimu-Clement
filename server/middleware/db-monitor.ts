import { Request, Response, NextFunction } from 'express';
import { getPoolStatus, pool } from '../db';

// Interface for query statistics
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

  private constructor() {
    this.queryStats = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    this.startPeriodicCleanup();
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
      queryStats: Object.fromEntries(this.queryStats),
      poolStatus: getPoolStatus(),
    };
  }
}

export const dbMonitor = DatabaseMonitor.getInstance();

export function monitorDatabase(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Monkey patch the query method to monitor execution time
  const originalQuery = pool.query;
  pool.query = async function (...args: any[]) {
    const queryStart = Date.now();
    try {
      const result = await originalQuery.apply(this, args);
      const queryTime = Date.now() - queryStart;
      dbMonitor.recordQuery(args[0], queryTime);
      return result;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  };

  res.on('finish', () => {
    // Restore original query method
    pool.query = originalQuery;
  });

  next();
}

// Health check endpoint middleware
export function healthCheck(req: Request, res: Response) {
  const stats = dbMonitor.getStats();
  const poolStatus = getPoolStatus();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    poolStatus,
    ...stats,
  });
}
