import { NextResponse } from 'next/server';

interface WebhookTestRequest {
  url: string;
  username?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body: WebhookTestRequest = await request.json();
    const { url, username, password } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, message: 'Webhook URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add Basic Auth if credentials provided
    if (username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Test the webhook with a HEAD request first, fall back to POST with empty body
    // Using AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      // Try a simple POST request with a test payload
      // Some webhooks don't support HEAD/OPTIONS, so we send a minimal test
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ test: true, timestamp: Date.now() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Accept any 2xx or 3xx response as success
      // Also accept 400-499 responses (except 401/403) as "reachable but may need different payload"
      if (response.ok || (response.status >= 200 && response.status < 400)) {
        return NextResponse.json({
          success: true,
          message: `Connected (${response.status})`,
          status: response.status,
        });
      }

      // 401/403 means auth failed
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          success: false,
          message: `Authentication failed (${response.status})`,
          status: response.status,
        });
      }

      // For other 4xx/5xx, we know the URL is reachable
      // Return success if we got any response (server is reachable)
      return NextResponse.json({
        success: true,
        message: `Server reachable (${response.status})`,
        status: response.status,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          return NextResponse.json({
            success: false,
            message: 'Connection timed out',
          });
        }

        // Network errors
        if (fetchError.message.includes('ECONNREFUSED')) {
          return NextResponse.json({
            success: false,
            message: 'Connection refused - server may be down',
          });
        }

        if (fetchError.message.includes('ENOTFOUND')) {
          return NextResponse.json({
            success: false,
            message: 'Host not found - check the URL',
          });
        }

        return NextResponse.json({
          success: false,
          message: fetchError.message,
        });
      }

      return NextResponse.json({
        success: false,
        message: 'Unknown error occurred',
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process request',
      },
      { status: 500 }
    );
  }
}
