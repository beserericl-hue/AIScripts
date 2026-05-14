import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer | undefined;

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-xxxx';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
