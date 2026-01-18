import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import OpenAI from 'openai';

dotenv.config({ path: '.env', override: true });

// Type definitions
interface ArxivPaper {
  id: string;
  submitter: string;
  authors: string;
  title: string;
  comments: string | null;
  'journal-ref': string | null;
  doi: string | null;
  'report-no': string | null;
  categories: string;
  license: string | null;
  abstract: string;
  versions: Array<{
    version: string;
    created: string;
  }>;
  update_date: string;
  authors_parsed: Array<[string, string, string]>;
}

interface DatabaseRow {
  arxiv_id: string | null;
  title: string | null;
  abstract: string | null;
  authors: string | null;
  publish_date: string | null;
  doi: string | null;
  journal_ref: string | null;
  embedding: number[] | null;
}

// Initialize Supabase client
const supabase = createClient(process.env.PAPER_SUPABASE_URL!, process.env.PAPER_SUPABASE_SERVICE_ROLE_KEY!);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});


// From the arXiv dataset, the number of papers to upload up to from the tail
let numberOfPapersToUpload = 10;

// From Supabase, the number of papers already uploaded
let numberOfPapersAlreadyUploaded = 0;

// Call the python script to filter the papers
execSync(`python3 scripts/extract_arxiv.py ${numberOfPapersToUpload} data/arxiv-output-filtered.json data/arxiv-output.json`, { stdio: 'inherit' });

// Read your JSON file
const arxivData: ArxivPaper[] = JSON.parse(
  fs.readFileSync('data/arxiv-output-filtered.json', 'utf8')
);

// Generate embeddings using OpenAI with retry logic
async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error: any) {
      // Handle rate limit errors
      if (error?.status === 429 && attempt < retries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
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

// Transform data to match your schema
async function transformData(paper: ArxivPaper): Promise<DatabaseRow> {
  const title = paper.title?.replace(/\n/g, ' ').trim() || '';
  const abstract = paper.abstract?.replace(/\n/g, ' ').trim() || '';

  // Combine title and abstract for embedding
  const textForEmbedding = `${title}\n\n${abstract}`;

  // Generate embedding
  const embedding = await generateEmbedding(textForEmbedding);

  return {
    arxiv_id: paper.id || null,
    title: title || null,
    abstract: abstract || null,
    authors: paper.authors || null,
    publish_date: paper.update_date || null,
    doi: paper.doi || null,
    journal_ref: paper['journal-ref'] || null,
    embedding: embedding,
  };
}

// Upload in batches
async function uploadToSupabase(
  data: ArxivPaper[], 
  batchSize: number = 100
): Promise<void> {
  const batches: ArxivPaper[][] = [];

  // Don't split into batches initially, first parse the papers to make sure we only upload ones with non-null entries for everything

  // Filter out the first numberOfPapersToUpload papers first
  data = data.slice(0, numberOfPapersToUpload);

  // Then filter out papers with any null required fields
  const filteredData = data.filter(paper => paper.title && paper.abstract && paper.authors && paper.update_date && paper.doi && paper['journal-ref']);
  
  numberOfPapersToUpload = filteredData.length;

  // Split into batches
  for (let i = numberOfPapersAlreadyUploaded; i < numberOfPapersToUpload; i += batchSize) {
    batches.push(filteredData.slice(i, i + batchSize));
  }

  console.log(`Uploading ${numberOfPapersToUpload} papers in ${batches.length} batches...`);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1}/${batches.length}...`);

    // Transform papers with embeddings sequentially to respect rate limits
    const batch: DatabaseRow[] = [];
    for (let j = 0; j < batches[i].length; j++) {
      const transformed = await transformData(batches[i][j]);
      batch.push(transformed);

      // Progress indicator within batch
      if ((j + 1) % 10 === 0) {
        console.log(`  Processed ${j + 1}/${batches[i].length} papers in batch ${i + 1}`);
      }
    }

    const { data: result, error } = await supabase
      .from('reef_papers')
      .insert(batch);

    if (error) {
      console.error(`Batch ${i + 1} error:`, error);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
      console.log(`Batch ${i + 1}/${batches.length} uploaded successfully`);
    }
  }

  console.log(`\nUpload complete!`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the upload
uploadToSupabase(arxivData)
  .then(() => console.log('Done!'))
  .catch((err: Error) => console.error('Fatal error:', err));