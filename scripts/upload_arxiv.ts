import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

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
  title: string | null;
  abstract: string | null;
  authors: string | null;
  'publish-date': string | null;
  doi: string | null;
  'journal-ref': string | null;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);


let numberOfPapersToUpload = 10000;

// Call the python script to filter the papers

execSync(`python3 scripts/extract_arxiv.py ${numberOfPapersToUpload} data/arxiv-output-filtered.json data/arxiv-output.json`, { stdio: 'inherit' });

// Read your JSON file
const arxivData: ArxivPaper[] = JSON.parse(
  fs.readFileSync('data/arxiv-output-filtered.json', 'utf8')
);

// Transform data to match your schema
function transformData(paper: ArxivPaper): DatabaseRow {
  return {
    title: paper.title?.replace(/\n/g, ' ').trim() || null,
    abstract: paper.abstract?.replace(/\n/g, ' ').trim() || null,
    authors: paper.authors || null,
    'publish-date': paper.update_date || null,
    doi: paper.doi || null,
    'journal-ref': paper['journal-ref'] || null,
    // embedding will be null by default
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
  for (let i = 0; i < numberOfPapersToUpload; i += batchSize) {
    batches.push(filteredData.slice(i, i + batchSize));
  }

  console.log(`Uploading ${numberOfPapersToUpload} papers in ${batches.length} batches...`);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].map(transformData);
    
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

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nUpload complete!`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the upload
uploadToSupabase(arxivData)
  .then(() => console.log('Done!'))
  .catch((err: Error) => console.error('Fatal error:', err));