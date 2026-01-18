import { NextResponse } from 'next/server';

/**
 * GET /api/config
 * Returns server-side configuration that should be used by the client
 * This allows environment variables to override client-side settings
 */
export async function GET() {
  const config: {
    mongoUrl?: string;
    mongoDatabaseName?: string;
    hasAnthropicKey: boolean;
    hasOpenAIKey: boolean;
  } = {
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  };

  // Only include MongoDB URL if set via environment variable
  if (process.env.MONGODB_URL) {
    config.mongoUrl = process.env.MONGODB_URL;
  }

  if (process.env.MONGODB_DATABASE) {
    config.mongoDatabaseName = process.env.MONGODB_DATABASE;
  }

  return NextResponse.json(config);
}
