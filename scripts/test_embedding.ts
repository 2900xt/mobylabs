import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env', override: true });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Your abstract to search for
const myAbstract = `We consider game theory from the perspective of quantum algorithms. Strategies in classical game theory are either pure (deterministic) or mixed (probabilistic). We introduce these basic ideas in the context of a simple example, closely related to the traditional Matching Pennies game. While not every two-person zero-sum finite game has an equilibrium in the set of pure strategies, von Neumann showed that there is always an equilibrium at which each player follows a mixed strategy. A mixed strategy deviating from the equilibrium strategy cannot increase a player's expected payoff. We show, however, that in our example a player who implements a quantum strategy can increase his expected payoff, and explain the relation to efficient quantum algorithms. We prove that in general a quantum strategy is always at least as good as a classical one, and furthermore that when both players use quantum strategies there need not be any equilibrium, but if both are allowed mixed quantum strategies there must be. `;

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