import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { userId } = body;
    const { id: searchId } = await params;

    // Rate limiting - use userId if available, otherwise IP
    const identifier = getClientIdentifier(request, userId);
    const rateLimit = checkRateLimit(identifier, 'search/read', RATE_LIMITS.SEARCH_READ);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!searchId) {
      return NextResponse.json(
        { error: 'Search ID is required' },
        { status: 400 }
      );
    }

    // Check if user is whitelisted
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whitelisted')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (!profile.whitelisted) {
      return NextResponse.json(
        { error: 'Forbidden: User is not whitelisted' },
        { status: 403 }
      );
    }

    // Fetch the search record and verify ownership
    const { data: search, error: searchError } = await supabase
      .from('reef_searches')
      .select('*')
      .eq('id', searchId)
      .eq('user_id', userId)
      .single();

    if (searchError || !search) {
      console.error('Search fetch error:', searchError);
      return NextResponse.json(
        { error: 'Search record not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch similar papers using the embedding
    const { data: papers, error: papersError } = await supabase.rpc('match_papers', {
      query_embedding: search.embedding,
      match_threshold: 0.0,
      match_count: 10,
    });

    if (papersError) {
      console.error('Papers fetch error:', papersError);
      return NextResponse.json(
        { error: 'Failed to fetch similar papers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      search: {
        id: search.id,
        title: search.title,
        abstract: search.abstract || "NO ABSTRACT :(",
        created_at: search.created_at,
      },
      papers: papers || [],
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
