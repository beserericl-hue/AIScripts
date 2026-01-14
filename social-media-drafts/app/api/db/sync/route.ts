import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo, getCollections, isValidMongoUrl } from '@/lib/mongodb';
import { Post, Folder, ActivityItem, AppSettings, MongoSyncResponse, MongoLoadResponse } from '@/lib/types';

interface SyncRequestBody {
  mongoUrl: string;
  mongoUsername?: string;
  mongoPassword?: string;
  mongoDatabaseName?: string;
  data: {
    posts: Post[];
    folders: Folder[];
    activity: ActivityItem[];
    settings: Partial<AppSettings>;
  };
}

/**
 * POST /api/db/sync - Save all data to MongoDB
 */
export async function POST(request: NextRequest): Promise<NextResponse<MongoSyncResponse>> {
  try {
    const body: SyncRequestBody = await request.json();
    const { mongoUrl, mongoUsername, mongoPassword, mongoDatabaseName, data } = body;

    // Validate MongoDB URL - if missing, return error
    if (!mongoUrl) {
      return NextResponse.json({
        success: false,
        message: 'MongoDB URL not configured',
        timestamp: Date.now(),
      }, { status: 400 });
    }

    if (!isValidMongoUrl(mongoUrl)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid MongoDB URL format',
        timestamp: Date.now(),
      }, { status: 400 });
    }

    const databaseName = mongoDatabaseName || 'social_media_drafts';

    // Connect to MongoDB
    const { db } = await connectToMongo({
      url: mongoUrl,
      username: mongoUsername,
      password: mongoPassword,
      databaseName,
    });

    const collections = getCollections(db);

    // Sync posts - replace all
    await collections.posts.deleteMany({});
    if (data.posts.length > 0) {
      await collections.posts.insertMany(data.posts);
    }

    // Sync folders - replace all
    await collections.folders.deleteMany({});
    if (data.folders.length > 0) {
      await collections.folders.insertMany(data.folders);
    }

    // Sync activity - replace all, cap at 50
    await collections.activity.deleteMany({});
    const activityToSave = data.activity.slice(0, 50);
    if (activityToSave.length > 0) {
      await collections.activity.insertMany(activityToSave);
    }

    // Sync settings - upsert single document (exclude mongo credentials)
    const settingsToSave = { ...data.settings };
    delete settingsToSave.mongoUrl;
    delete settingsToSave.mongoUsername;
    delete settingsToSave.mongoPassword;
    delete settingsToSave.mongoDatabaseName;

    await collections.settings.updateOne(
      { _id: 'app_settings' },
      { $set: { ...settingsToSave, _id: 'app_settings' } },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Data synced successfully',
      timestamp: Date.now(),
      counts: {
        posts: data.posts.length,
        folders: data.folders.length,
        activity: activityToSave.length,
      },
    });
  } catch (error) {
    console.error('MongoDB sync error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to sync data to MongoDB',
      timestamp: Date.now(),
    }, { status: 500 });
  }
}

/**
 * GET /api/db/sync - Load all data from MongoDB
 */
export async function GET(request: NextRequest): Promise<NextResponse<MongoLoadResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mongoUrl = searchParams.get('mongoUrl');
    const mongoUsername = searchParams.get('mongoUsername') || undefined;
    const mongoPassword = searchParams.get('mongoPassword') || undefined;
    const mongoDatabaseName = searchParams.get('mongoDatabaseName') || 'social_media_drafts';

    // Validate MongoDB URL - if missing, return error
    if (!mongoUrl) {
      return NextResponse.json({
        success: false,
        message: 'MongoDB URL not configured',
        timestamp: Date.now(),
      }, { status: 400 });
    }

    if (!isValidMongoUrl(mongoUrl)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid MongoDB URL format',
        timestamp: Date.now(),
      }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToMongo({
      url: mongoUrl,
      username: mongoUsername,
      password: mongoPassword,
      databaseName: mongoDatabaseName,
    });

    const collections = getCollections(db);

    // Load all data
    const [posts, folders, activity, settingsDoc] = await Promise.all([
      collections.posts.find({}).toArray(),
      collections.folders.find({}).toArray(),
      collections.activity.find({}).sort({ timestamp: -1 }).limit(50).toArray(),
      collections.settings.findOne({ _id: 'app_settings' }),
    ]);

    // Clean up settings document (remove _id and mongo credentials)
    const settings: Partial<AppSettings> = settingsDoc
      ? {
          defaultPlatforms: settingsDoc.defaultPlatforms,
          webhookUrl: settingsDoc.webhookUrl,
          webhookUsername: settingsDoc.webhookUsername,
          webhookPassword: settingsDoc.webhookPassword,
        }
      : {};

    return NextResponse.json({
      success: true,
      data: {
        posts: posts as Post[],
        folders: folders as Folder[],
        activity: activity as ActivityItem[],
        settings,
      },
      message: 'Data loaded successfully',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('MongoDB load error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to load data from MongoDB',
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
