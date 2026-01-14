import { MongoClient, Db } from 'mongodb';
import { Post, Folder, ActivityItem, AppSettings } from './types';

// Connection cache
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export interface MongoConfig {
  url: string;
  username?: string;
  password?: string;
  databaseName: string;
}

/**
 * Validates MongoDB connection string format
 */
export function isValidMongoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // Basic validation for mongodb:// or mongodb+srv:// protocols
  const mongoRegex = /^mongodb(\+srv)?:\/\/.+/i;
  return mongoRegex.test(url.trim());
}

/**
 * Builds connection URL with credentials if provided
 */
export function buildConnectionUrl(config: MongoConfig): string {
  let url = config.url.trim();

  // If username/password provided, inject into URL
  if (config.username && config.password) {
    const encodedUser = encodeURIComponent(config.username);
    const encodedPass = encodeURIComponent(config.password);

    // Check if URL already has credentials
    if (url.includes('@')) {
      // Replace existing credentials
      url = url.replace(
        /mongodb(\+srv)?:\/\/[^@]+@/,
        `mongodb$1://${encodedUser}:${encodedPass}@`
      );
    } else {
      // Insert credentials after protocol
      url = url.replace(
        /mongodb(\+srv)?:\/\//,
        `mongodb$1://${encodedUser}:${encodedPass}@`
      );
    }
  }

  return url;
}

/**
 * Connect to MongoDB with given configuration
 */
export async function connectToMongo(config: MongoConfig): Promise<{ client: MongoClient; db: Db }> {
  // Validate URL
  if (!isValidMongoUrl(config.url)) {
    throw new Error('Invalid MongoDB URL format');
  }

  const connectionUrl = buildConnectionUrl(config);

  // Return cached connection if available
  if (cachedClient && cachedDb) {
    try {
      // Ping to check connection is still alive
      await cachedClient.db().admin().ping();
      return { client: cachedClient, db: cachedDb };
    } catch {
      // Connection lost, reset cache
      cachedClient = null;
      cachedDb = null;
    }
  }

  // Create new connection
  const client = new MongoClient(connectionUrl, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  await client.connect();
  const db = client.db(config.databaseName);

  // Cache the connection
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

/**
 * Get typed collections
 */
export function getCollections(db: Db) {
  return {
    posts: db.collection<Post>('posts'),
    folders: db.collection<Folder>('folders'),
    activity: db.collection<ActivityItem>('activity'),
    settings: db.collection<{ _id: string } & Partial<AppSettings>>('settings'),
  };
}

/**
 * Close MongoDB connection
 */
export async function closeConnection(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}

/**
 * Check if MongoDB is configured based on settings
 */
export function isMongoConfigured(settings: Partial<AppSettings>): boolean {
  return Boolean(settings.mongoUrl && isValidMongoUrl(settings.mongoUrl));
}
