import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Your abstract to search for
const myAbstract = ``;

// Generate embedding
const embeddingResponse = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: myAbstract,
});

// Find similar papers
const { data, error } = await supabase.rpc('match_papers', {
  query_embedding: embeddingResponse.data[0].embedding,
  match_threshold: 0.0,  // 50% similarity minimum
  match_count: 10,       // Return top 10
});

if (error) console.error('Error:', error);
else console.log('Similar papers:', data);