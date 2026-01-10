import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { abstract, matchThreshold = 0.0, matchCount = 10 } = await request.json();

    if (!abstract || typeof abstract !== 'string') {
      return NextResponse.json(
        { error: 'Abstract is required and must be a string' },
        { status: 400 }
      );
    }

    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: abstract,
    });

    // Find similar papers
    const { data, error } = await supabase.rpc('match_papers', {
      query_embedding: embeddingResponse.data[0].embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to search papers' },
        { status: 500 }
      );
    }

    return NextResponse.json({ papers: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
