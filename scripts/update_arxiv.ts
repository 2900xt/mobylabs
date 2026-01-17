import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

// Type definitions
interface ArxivPaper {
  id: string;
  title: string;
  abstract: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Number of papers to process from the arXiv dataset
const numberOfPapersToProcess = 1000;

// Call the python script to filter the papers
execSync(`python3 scripts/extract_arxiv.py ${numberOfPapersToProcess} data/arxiv-output-filtered.json data/arxiv-output.json`, { stdio: 'inherit' });

// Read the JSON file from Python output
const arxivData: ArxivPaper[] = JSON.parse(
  fs.readFileSync('data/arxiv-output-filtered.json', 'utf8')
);

// Normalize text for comparison (remove newlines, extra spaces, trim)
function normalizeText(text: string): string {
  return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Update arxiv_id for existing papers in Supabase
async function updateArxivIds(): Promise<void> {
  console.log(`Processing ${arxivData.length} papers from arXiv data...`);

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (let i = 0; i < arxivData.length; i++) {
    const paper = arxivData[i];
    const normalizedTitle = normalizeText(paper.title);

    // Find matching paper in Supabase by title
    const { data: existingPapers, error: fetchError } = await supabase
      .from('reef_papers')
      .select('id, title, arxiv_id')
      .is('arxiv_id', null);

    if (fetchError) {
      console.error(`Error fetching papers:`, fetchError);
      errorCount++;
      continue;
    }

    // Find a match by normalized title
    const match = existingPapers?.find(
      (p) => normalizeText(p.title || '') === normalizedTitle
    );

    if (match) {
      // Update the arxiv_id
      const { error: updateError } = await supabase
        .from('reef_papers')
        .update({ arxiv_id: paper.id })
        .eq('id', match.id);

      if (updateError) {
        console.error(`Error updating paper ${match.id}:`, updateError);
        errorCount++;
      } else {
        successCount++;
        console.log(`Updated: "${paper.title.slice(0, 50)}..." -> arxiv_id: ${paper.id}`);
      }
    } else {
      notFoundCount++;
    }

    // Progress indicator
    if ((i + 1) % 50 === 0) {
      console.log(`Processed ${i + 1}/${arxivData.length} papers...`);
    }
  }

  console.log(`\nUpdate complete!`);
  console.log(`Updated: ${successCount}`);
  console.log(`Not found in Supabase: ${notFoundCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the update
updateArxivIds()
  .then(() => console.log('Done!'))
  .catch((err: Error) => console.error('Fatal error:', err));
