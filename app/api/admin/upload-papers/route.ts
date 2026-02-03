
import { NextRequest, NextResponse } from 'next/server';
import { uploadPapersFromRSS } from '@/lib/arxiv';

export const maxDuration = 300; // 5 minutes timeout for Vercel/Next.js

export async function POST(req: NextRequest) {
  try {
    // Security Check: Verify authorization header
    // Using the service role key as the secret for simplicity as requested, 
    // or we could use a dedicated CRON_SECRET.
    const authHeader = req.headers.get('authorization');
    const expectedKey = process.env.PAPER_SUPABASE_SERVICE_ROLE_KEY;

    if (!expectedKey) {
      console.error('PAPER_SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body for optional categories
    let categories = ['cs.AI', 'cs.LG'];
    try {
      const body = await req.json();
      if (body.categories && Array.isArray(body.categories)) {
        categories = body.categories;
      }
    } catch (e) {
      // Ignore if body is not valid JSON, use defaults
    }

    console.log('Starting RSS upload for categories:', categories);
    const result = await uploadPapersFromRSS(categories);

    return NextResponse.json({
      message: 'Upload process completed',
      stats: result
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
