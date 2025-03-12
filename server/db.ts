import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with optimized settings for serverless environment
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Reduced max connections for serverless environment
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Increased timeout for initial connection
  maxUses: 7500, // Close connections after 7500 queries (to prevent memory leaks)
  retryStrategy: (err, attempts) => {
    // Automatic retry strategy for handling connection issues
    console.log(`Database connection retry attempt ${attempts}`);
    return Math.min(attempts * 500, 3000); // Progressive backoff with max 3s delay
  }
});

// Add event listeners for monitoring
pool.on('connect', (client) => {
  console.log('New client connected to the pool');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't crash on connection errors, let retry strategy handle it
});

pool.on('remove', () => {
  console.log('Client removed from pool');
});

// Improved database health check with retry logic
export async function checkDatabaseHealth(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Database health check attempt ${attempt}/${retries}`);
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        console.log('Database health check successful');
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Database health check failed (attempt ${attempt}/${retries}):`, error);
      if (attempt < retries) {
        // Wait with exponential backoff before retrying
        const delay = Math.min(attempt * 1000, 3000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('All database connection attempts failed');
        return false;
      }
    }
  }
  return false;
}

// Create the drizzle DB instance with the configured pool
export const db = drizzle(pool, { schema });

// Export a function to properly close the pool
export async function closePool() {
  await pool.end();
}

// Function to get pool statistics
export function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

// Function to wake up database if it's sleeping
export async function wakeupDatabase() {
  console.log('Attempting to wake up the database...');
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      console.log('Database wakeup successful');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database wakeup failed:', error);
    return false;
  }
}