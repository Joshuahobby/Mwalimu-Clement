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

// Configure connection pool with optimal settings for scalability
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  maxUses: 7500, // Close connections after 7500 queries (to prevent memory leaks)
});

// Add event listeners for monitoring
pool.on('connect', (client) => {
  console.log('New client connected to the pool');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('remove', () => {
  console.log('Client removed from pool');
});

// Function to check database health
export async function checkDatabaseHealth() {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
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