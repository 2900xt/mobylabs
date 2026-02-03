
import Parser from 'rss-parser';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabaseUrl = process.env.PAPER_SUPABASE_URL!;
const supabaseKey = process.env.PAPER_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const parser = new Parser();

export interface ArxivRSSEntry {
  title: string;
  link: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
  categories?: string[];
  isoDate?: string;
  [key: string]: any;
}

export interface DatabaseRow {
  arxiv_id: string | null;
  title: string | null;
  abstract: string | null;
  authors: string | null;
  publish_date: string | null;
  doi: string | null;
  journal_ref: string | null;
  embedding: number[] | null;
}

// Extract Arxiv ID from link (e.g. http://arxiv.org/abs/2301.12345)
function extractArxivId(link: string): string | null {
  const match = link.match(/arxiv.org\/abs\/([^\/]+)$/);
  return match ? match[1] : null;
}

// Fetch RSS feed
export async function fetchArxivRSS(category: string): Promise<ArxivRSSEntry[]> {
  const feedUrl = `http://rss.arxiv.org/rss/${category}`;
  try {
    const feed = await parser.parseURL(feedUrl);
    return feed.items.map(item => ({
      ...item,
      // RSS parser might put categories in different places depending on XML structure
      // but usually it's in categories array
      categories: item.categories || [],
    })) as ArxivRSSEntry[];
  } catch (error) {
    console.error(`Error fetching RSS feed for ${category}:`, error);
    throw error;
  }
}

// Generate embedding
async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error: any) {
      if (error?.status === 429 && attempt < retries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Rate limit hit, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('Error generating embedding:', error);
        throw error;
      }
    }
  }
  throw new Error('Failed to generate embedding after retries');
}

// Parse RSS entry to DatabaseRow
export async function parseRSSEntry(entry: ArxivRSSEntry): Promise<DatabaseRow | null> {
  const arxivId = extractArxivId(entry.link);
  if (!arxivId) return null;

  const title = entry.title?.replace(/\n/g, ' ').trim() || '';
  // RSS feed usually has abstract in contentSnippet or content
  // Sometimes it has HTML, need to strip it? RSS usually is plain text or CDATA
  // Arxiv RSS 'description' usually contains the abstract but with 'Abstract: ' prefix sometimes
  let abstract = entry.contentSnippet || entry.content || '';

  // Clean up abstract if needed (Arxiv RSS abstracts often start with <p> or contain HTML)
  // For now simple replacement of newlines
  abstract = abstract.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
  if (abstract.startsWith('Abstract:')) {
    abstract = abstract.substring(9).trim();
  }

  // Authors are often in 'creator' field in RSS
  const authors = entry.creator || entry.author || null;

  const textForEmbedding = `${title}\n\n${abstract}`;
  const embedding = await generateEmbedding(textForEmbedding);

  return {
    arxiv_id: arxivId,
    title,
    abstract,
    authors,
    publish_date: entry.isoDate ? new Date(entry.isoDate).toISOString() : new Date().toISOString(),
    doi: null, // RSS might not have DOI
    journal_ref: null,
    embedding,
  };
}

export async function uploadPapersFromRSS(categories: string[] = ['cs.AI', 'cs.LG']) {
  let allPapers: ArxivRSSEntry[] = [];

  for (const cat of categories) {
    console.log(`Fetching RSS for ${cat}...`);
    const papers = await fetchArxivRSS(cat);
    console.log(`Found ${papers.length} papers in ${cat}`);
    allPapers = [...allPapers, ...papers];
  }

  // Deduplicate by link/id
  const uniquePapers = new Map<string, ArxivRSSEntry>();
  for (const p of allPapers) {
    const id = extractArxivId(p.link);
    if (id) uniquePapers.set(id, p);
  }

  console.log(`Unique papers to process: ${uniquePapers.size}`);

  const results = {
    success: 0,
    errors: 0,
    skipped: 0
  };

  for (const paper of uniquePapers.values()) {
    try {
      const arxivId = extractArxivId(paper.link);
      if (!arxivId) continue;

      // Check if already exists
      const { data: existing } = await supabase
        .from('reef_papers')
        .select('id')
        .eq('arxiv_id', arxivId)
        .single();

      if (existing) {
        results.skipped++;
        continue;
      }

      console.log(`Processing ${arxivId}: ${paper.title.substring(0, 30)}...`);
      const row = await parseRSSEntry(paper);

      if (row) {
        const { error } = await supabase.from('reef_papers').insert(row);
        if (error) {
          console.error(`Error inserting ${arxivId}:`, error);
          results.errors++;
        } else {
          results.success++;
        }
      } else {
        results.errors++; // Failed to parse
      }

    } catch (e) {
      console.error(`Error processing paper`, e);
      results.errors++;
    }
  }

  return results;
}
