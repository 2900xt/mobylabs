
import { fetchArxivRSS, parseRSSEntry } from '../lib/arxiv';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', override: true });

async function test() {
  console.log('Testing RSS Fetching...');
  try {
    const papers = await fetchArxivRSS('cs.AI');
    console.log(`Fetched ${papers.length} papers from cs.AI`);

    if (papers.length > 0) {
      const firstPaper = papers[0];
      console.log('First paper snippet:', {
        title: firstPaper.title,
        link: firstPaper.link,
      });

      console.log('\nTesting Parsing...');
      // Mock embedding generation to avoid API cost in test or just let it run if key is present
      // For this test we will try to run it real if key exists, allowing us to see if parser works with database row shape
      if (process.env.OPENAI_API_KEY) {
        const row = await parseRSSEntry(firstPaper);
        console.log('Parsed Row:', {
          title: row?.title,
          arxiv_id: row?.arxiv_id,
          hasEmbedding: !!row?.embedding,
          embeddingLength: row?.embedding?.length
        });
      } else {
        console.log('Skipping embedding generation (no API key)');
      }
    }
  } catch (error) {
    console.error('Test Failed:', error);
  }
}

test();
