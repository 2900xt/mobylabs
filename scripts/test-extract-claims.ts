// Simple tester script for the extract-claims API
// Run with: npx ts-node scripts/test-extract-claims.ts

const API_URL = "http://localhost:3000/api/pearl/extract-claims";

// Example arxiv IDs - replace with your own
const TEST_ARXIV_IDS = [
  "2501.13073", // Example: a real arxiv paper ID
];

async function testExtractClaims() {
  console.log("Testing extract-claims API...\n");
  console.log("ArXiv IDs:", TEST_ARXIV_IDS);
  console.log("---\n");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        arxiv_ids: TEST_ARXIV_IDS,
      }),
    });

    console.log("Status:", response.status);

    const data = await response.json();

    if (!response.ok) {
      console.error("Error:", data.error);
      return;
    }

    // Print results
    for (const paper of data.papers) {
      console.log(`\n=== Paper: ${paper.arxiv_id} ===\n`);

      console.log("Claims:");
      paper.claims.forEach((c: string, i: number) => console.log(`  ${i + 1}. ${c}`));

      console.log("\nMethods:");
      paper.methods.forEach((m: string, i: number) => console.log(`  ${i + 1}. ${m}`));

      console.log("\nLimitations:");
      paper.limitations.forEach((l: string, i: number) => console.log(`  ${i + 1}. ${l}`));

      console.log("\nConclusion:");
      console.log(`  ${paper.conclusion}`);
    }

    if (data.errors?.length > 0) {
      console.log("\n--- Errors ---");
      for (const err of data.errors) {
        console.log(`  ${err.arxiv_id}: ${err.error}`);
      }
    }
  } catch (error) {
    console.error("Request failed:", error);
  }
}

testExtractClaims();
