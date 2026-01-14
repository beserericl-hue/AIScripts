import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo, isValidMongoUrl } from '@/lib/mongodb';
import { MongoHealthResponse } from '@/lib/types';

/**
 * GET /api/db/health - Check MongoDB connection health
 */
export async function GET(request: NextRequest): Promise<NextResponse<MongoHealthResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mongoUrl = searchParams.get('mongoUrl');
    const mongoUsername = searchParams.get('mongoUsername') || undefined;
    const mongoPassword = searchParams.get('mongoPassword') || undefined;
    const mongoDatabaseName = searchParams.get('mongoDatabaseName') || 'social_media_drafts';

    // Check if URL is provided
    if (!mongoUrl) {
      return NextResponse.json({
        connected: false,
        database: null,
        collections: [],
        message: 'MongoDB URL not configured',
      });
    }

    // Validate URL format
    if (!isValidMongoUrl(mongoUrl)) {
      return NextResponse.json({
        connected: false,
        database: null,
        collections: [],
        message: 'Invalid MongoDB URL format',
      }, { status: 400 });
    }

    // Try to connect
    const { db } = await connectToMongo({
      url: mongoUrl,
      username: mongoUsername,
      password: mongoPassword,
      databaseName: mongoDatabaseName,
    });

    // List collections
    const collectionsCursor = await db.listCollections().toArray();
    const collectionNames = collectionsCursor.map(c => c.name);

    return NextResponse.json({
      connected: true,
      database: mongoDatabaseName,
      collections: collectionNames,
      message: 'Successfully connected to MongoDB',
    });
  } catch (error) {
    console.error('MongoDB health check error:', error);
    return NextResponse.json({
      connected: false,
      database: null,
      collections: [],
      message: error instanceof Error ? error.message : 'Failed to connect to MongoDB',
    }, { status: 500 });
  }
}
