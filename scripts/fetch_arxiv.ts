import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: '.env', override: true });

// ============================================================================
// Configuration
// ============================================================================

// arXiv categories to fetch (CS AI/ML related)
const ARXIV_CATEGORIES = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.NE'];

// Date range: last year from today
const END_DATE = new Date();
const START_DATE = new Date();
START_DATE.setFullYear(START_DATE.getFullYear() - 1);

// API settings
const ARXIV_API_BASE = 'http://export.arxiv.org/api/query';
const RESULTS_PER_REQUEST = 500; // Reduced for stability
const MAX_RESULTS_PER_QUERY = 8000; // arXiv fails beyond ~10k, stay safe
const RATE_LIMIT_DELAY_MS = 3500; // 3.5 seconds between requests (arXiv requires 3s minimum)

// Batch settings for database uploads
const DB_BATCH_SIZE = 50; // Papers to upload per batch

// ============================================================================
// Type Definitions
// ============================================================================

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  categories: string[];
  doi: string | null;
  journalRef: string | null;
  pdfUrl: string | null;
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

// ============================================================================
// Initialize Clients
// ============================================================================

const supabase = createClient(
  process.env.PAPER_SUPABASE_URL!,
  process.env.PAPER_SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractArxivId(url: string): string {
  // arXiv ID format: http://arxiv.org/abs/2401.12345v1 -> 2401.12345
  const match = url.match(/arxiv\.org\/abs\/([^v]+)/);
  return match ? match[1] : url;
}

function cleanText(text: string): string {
  return text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// arXiv API Functions
// ============================================================================

function buildSearchQuery(startDate: Date, endDate: Date): string {
  // Build category query with OR logic
  const categoryQuery = ARXIV_CATEGORIES.map((cat) => `cat:${cat}`).join('+OR+');

  // Add date range filter
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  // Combine with date filter
  return `(${categoryQuery})+AND+submittedDate:[${startDateStr}+TO+${endDateStr}]`;
}

function generateMonthlyRanges(start: Date, end: Date): Array<{ start: Date; end: Date }> {
  const ranges: Array<{ start: Date; end: Date }> = [];
  const current = new Date(start);

  while (current < end) {
    const rangeStart = new Date(current);
    // Move to next month
    current.setMonth(current.getMonth() + 1);
    const rangeEnd = current < end ? new Date(current) : new Date(end);

    ranges.push({ start: rangeStart, end: rangeEnd });
  }

  return ranges;
}

async function fetchArxivPage(start: number, startDate: Date, endDate: Date): Promise<{ entries: ArxivEntry[]; totalResults: number }> {
  const searchQuery = buildSearchQuery(startDate, endDate);
  const url = `${ARXIV_API_BASE}?search_query=${searchQuery}&start=${start}&max_results=${RESULTS_PER_REQUEST}&sortBy=submittedDate&sortOrder=descending`;

  console.log(`Fetching from arXiv: start=${start}, max_results=${RESULTS_PER_REQUEST}`);

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Rate limit exceeded (HTTP 503). Wait and retry.');
    }
    throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  return parseArxivResponse(xml);
}

function parseArxivResponse(xml: string): { entries: ArxivEntry[]; totalResults: number } {
  const entries: ArxivEntry[] = [];

  // Extract total results
  const totalMatch = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
  const totalResults = totalMatch ? parseInt(totalMatch[1], 10) : 0;

  // Extract entries
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entryXml = entryMatch[1];

    // Parse ID
    const idMatch = entryXml.match(/<id>([^<]+)<\/id>/);
    const id = idMatch ? extractArxivId(idMatch[1]) : '';

    // Parse title
    const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? cleanText(titleMatch[1]) : '';

    // Parse summary (abstract)
    const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
    const summary = summaryMatch ? cleanText(summaryMatch[1]) : '';

    // Parse authors
    const authors: string[] = [];
    const authorRegex = /<author>\s*<name>([^<]+)<\/name>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entryXml)) !== null) {
      authors.push(authorMatch[1].trim());
    }

    // Parse dates
    const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/);
    const published = publishedMatch ? publishedMatch[1] : '';

    const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/);
    const updated = updatedMatch ? updatedMatch[1] : '';

    // Parse categories
    const categories: string[] = [];
    const categoryRegex = /<category[^>]*term="([^"]+)"/g;
    let categoryMatch;
    while ((categoryMatch = categoryRegex.exec(entryXml)) !== null) {
      categories.push(categoryMatch[1]);
    }

    // Parse DOI (if present)
    const doiMatch = entryXml.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/);
    const doi = doiMatch ? doiMatch[1] : null;

    // Parse journal reference (if present)
    const journalMatch = entryXml.match(/<arxiv:journal_ref[^>]*>([^<]+)<\/arxiv:journal_ref>/);
    const journalRef = journalMatch ? journalMatch[1] : null;

    // Parse PDF URL
    const pdfMatch = entryXml.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
    const pdfUrl = pdfMatch ? pdfMatch[1] : null;

    if (id && title && summary) {
      entries.push({
        id,
        title,
        summary,
        authors,
        published,
        updated,
        categories,
        doi,
        journalRef,
        pdfUrl,
      });
    }
  }

  return { entries, totalResults };
}

// ============================================================================
// Embedding Generation
// ============================================================================

async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error: unknown) {
      const err = error as { status?: number };
      if (err?.status === 429 && attempt < retries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`  OpenAI rate limit hit, waiting ${waitTime}ms before retry...`);
        await sleep(waitTime);
      } else {
        console.error('Error generating embedding:', error);
        throw error;
      }
    }
  }
  throw new Error('Failed to generate embedding after retries');
}

// ============================================================================
// Database Operations
// ============================================================================

async function getExistingArxivIds(): Promise<Set<string>> {
  console.log('Fetching existing arXiv IDs from database...');

  const existingIds = new Set<string>();
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('reef_papers')
      .select('arxiv_id')
      .not('arxiv_id', 'is', null)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching existing IDs:', error);
      throw error;
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.arxiv_id) {
        existingIds.add(row.arxiv_id);
      }
    }

    offset += limit;

    if (data.length < limit) break;
  }

  console.log(`Found ${existingIds.size} existing papers in database`);
  return existingIds;
}

async function transformEntry(entry: ArxivEntry): Promise<DatabaseRow> {
  const textForEmbedding = `${entry.title}\n\n${entry.summary}`;
  const embedding = await generateEmbedding(textForEmbedding);

  // Parse date to YYYY-MM-DD format
  const publishDate = entry.published
    ? entry.published.split('T')[0]
    : null;

  return {
    arxiv_id: entry.id,
    title: entry.title,
    abstract: entry.summary,
    authors: entry.authors.join(', '),
    publish_date: publishDate,
    doi: entry.doi,
    journal_ref: entry.journalRef,
    embedding,
  };
}

async function uploadBatch(batch: DatabaseRow[]): Promise<{ success: number; errors: number }> {
  const { error } = await supabase
    .from('reef_papers')
    .insert(batch);

  if (error) {
    console.error('Batch upload error:', error);
    return { success: 0, errors: batch.length };
  }

  return { success: batch.length, errors: 0 };
}

// ============================================================================
// Main Execution
// ============================================================================

async function fetchAllPapersForDateRange(
  startDate: Date,
  endDate: Date
): Promise<ArxivEntry[]> {
  const entries: ArxivEntry[] = [];
  let start = 0;

  // First request to get total count for this range
  const firstPage = await fetchArxivPage(0, startDate, endDate);
  entries.push(...firstPage.entries);
  const totalResults = firstPage.totalResults;

  console.log(`  Range has ${totalResults} papers total`);

  // If more than MAX_RESULTS_PER_QUERY, we'll hit the API limit - this shouldn't happen with monthly chunks
  if (totalResults > MAX_RESULTS_PER_QUERY) {
    console.warn(`  Warning: ${totalResults} papers exceeds safe limit. Some may be missed.`);
  }

  // Fetch remaining pages for this date range
  while (entries.length < totalResults && entries.length < MAX_RESULTS_PER_QUERY) {
    start += RESULTS_PER_REQUEST;

    await sleep(RATE_LIMIT_DELAY_MS);

    try {
      const page = await fetchArxivPage(start, startDate, endDate);
      if (page.entries.length === 0) break;
      entries.push(...page.entries);
      console.log(`  Fetched ${entries.length}/${Math.min(totalResults, MAX_RESULTS_PER_QUERY)} papers`);
    } catch (error) {
      console.error(`  Error at start=${start}:`, error);
      // Wait longer and retry once
      await sleep(10000);
      try {
        const page = await fetchArxivPage(start, startDate, endDate);
        if (page.entries.length === 0) break;
        entries.push(...page.entries);
      } catch (retryError) {
        console.error('  Retry failed, moving to next range');
        break;
      }
    }
  }

  return entries;
}

async function processAndUploadEntries(
  entries: ArxivEntry[],
  existingIds: Set<string>
): Promise<{ success: number; errors: number; skipped: number }> {
  // Filter out duplicates and already-uploaded papers
  const newEntries = entries.filter((entry) => !existingIds.has(entry.id));
  const skipped = entries.length - newEntries.length;

  if (newEntries.length === 0) {
    return { success: 0, errors: 0, skipped };
  }

  let totalSuccess = 0;
  let totalErrors = 0;
  const batches = Math.ceil(newEntries.length / DB_BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const batchStart = batchIndex * DB_BATCH_SIZE;
    const batchEnd = Math.min(batchStart + DB_BATCH_SIZE, newEntries.length);
    const batchEntries = newEntries.slice(batchStart, batchEnd);

    console.log(`    Batch ${batchIndex + 1}/${batches} (papers ${batchStart + 1}-${batchEnd})`);

    // Transform entries (generate embeddings)
    const transformedBatch: DatabaseRow[] = [];
    for (let i = 0; i < batchEntries.length; i++) {
      try {
        const transformed = await transformEntry(batchEntries[i]);
        transformedBatch.push(transformed);

        if ((i + 1) % 10 === 0) {
          console.log(`      Generated embeddings: ${i + 1}/${batchEntries.length}`);
        }
      } catch (error) {
        console.error(`      Error processing paper ${batchEntries[i].id}:`, error);
        totalErrors++;
      }
    }

    // Upload batch
    const result = await uploadBatch(transformedBatch);
    totalSuccess += result.success;
    totalErrors += result.errors;

    // Add uploaded IDs to existingIds to prevent duplicates in subsequent months
    for (const entry of batchEntries) {
      existingIds.add(entry.id);
    }

    console.log(`      Uploaded: ${result.success}, Errors: ${result.errors}`);
  }

  return { success: totalSuccess, errors: totalErrors, skipped };
}

async function main() {
  console.log('='.repeat(70));
  console.log('arXiv Paper Fetcher - CS AI/ML Categories');
  console.log('='.repeat(70));
  console.log(`Categories: ${ARXIV_CATEGORIES.join(', ')}`);
  console.log(`Date range: ${formatDate(START_DATE)} to ${formatDate(END_DATE)}`);
  console.log('Processing month-by-month: fetch → upload → next month');
  console.log('='.repeat(70));

  // Step 1: Get existing papers to avoid duplicates
  const existingIds = await getExistingArxivIds();

  // Step 2: Generate monthly date ranges
  const monthlyRanges = generateMonthlyRanges(START_DATE, END_DATE);
  console.log(`\nWill process ${monthlyRanges.length} monthly chunks`);

  // Track totals across all months
  let grandTotalFetched = 0;
  let grandTotalSuccess = 0;
  let grandTotalErrors = 0;
  let grandTotalSkipped = 0;

  // Step 3: Process each month: fetch → upload → next
  for (let i = 0; i < monthlyRanges.length; i++) {
    const range = monthlyRanges[i];
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[Month ${i + 1}/${monthlyRanges.length}] ${formatDate(range.start)} to ${formatDate(range.end)}`);
    console.log('='.repeat(50));

    // Fetch papers for this month
    console.log('  Fetching from arXiv...');
    const monthEntries = await fetchAllPapersForDateRange(range.start, range.end);
    grandTotalFetched += monthEntries.length;
    console.log(`  Fetched ${monthEntries.length} papers`);

    if (monthEntries.length === 0) {
      console.log('  No papers found for this month, skipping...');
      continue;
    }

    // Upload papers for this month
    console.log('  Processing and uploading...');
    const result = await processAndUploadEntries(monthEntries, existingIds);

    grandTotalSuccess += result.success;
    grandTotalErrors += result.errors;
    grandTotalSkipped += result.skipped;

    console.log(`  Month complete: ${result.success} uploaded, ${result.skipped} skipped, ${result.errors} errors`);
    console.log(`  Running totals: ${grandTotalSuccess} uploaded, ${grandTotalSkipped} skipped, ${grandTotalErrors} errors`);

    // Rate limit between months
    if (i < monthlyRanges.length - 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  // Step 4: Final Summary
  console.log('\n' + '='.repeat(70));
  console.log('ALL MONTHS COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total papers fetched from arXiv: ${grandTotalFetched}`);
  console.log(`Successfully uploaded: ${grandTotalSuccess}`);
  console.log(`Skipped (already in DB): ${grandTotalSkipped}`);
  console.log(`Errors: ${grandTotalErrors}`);
  console.log('='.repeat(70));
}

// Run
main()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err: Error) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
