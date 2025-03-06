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
  private originalQuery: typeof pool.query;

  private constructor() {
    this.queryStats = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    this.originalQuery = pool.query;
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
  // Monkey patch the query method to monitor execution time
  pool.query = dbMonitor.monitorQuery();

  res.on('finish', () => {
    // Restore original query method
    dbMonitor.restoreQuery();
  });

  next();
}

// Health check endpoint middleware
export function healthCheck(req: Request, res: Response) {
  const stats = dbMonitor.getStats();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stats,
  });
}