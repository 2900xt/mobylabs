// Simple tester script for the gen-angles API
// Run with: npx ts-node scripts/test-gen-angles.ts
//
// This script first calls /extract-claims to get paper analyses,
// then passes them to /gen-angles to generate research angles.

(async () => {
  const EXTRACT_CLAIMS_URL = "http://localhost:3000/api/pearl/extract-claims";
  const GEN_ANGLES_URL = "http://localhost:3000/api/pearl/gen-angles";

  // Replace with a valid userId from your database
  const USER_ID = "2b76f673-7b00-4205-9520-b665b6f66be2";

  // Example arxiv IDs to analyze
  const ARXIV_IDS = [
    "2501.13073", // Replace with relevant paper IDs
  ];

  // Example research idea
  const RESEARCH_IDEA = `
I'm interested in exploring how large language models can be used for automated code review.
Specifically, I want to understand how LLMs can detect subtle bugs, security vulnerabilities,
and code quality issues that traditional static analysis tools might miss. I'm also curious
about how these models handle context from large codebases and maintain consistency in their feedback.
`.trim();

  interface PaperAnalysis {
    arxiv_id: string | null;
    claims: string[];
    methods: string[];
    limitations: string[];
    conclusion: string;
  }

  interface ResearchAngle {
    title: string;
    description: string;
    novelty: number;
    practicality: number;
    impact: number;
    overallScore: number;
    reasoning: string;
    briefPlan: string[];
    relatedLimitations: string[];
  }

  console.log("=== Step 1: Extract claims from papers ===\n");
  console.log("ArXiv IDs:", ARXIV_IDS);
  console.log("---\n");

  // First, call extract-claims to get paper analyses
  let papers: PaperAnalysis[] = [];

  try {
    const extractResponse = await fetch(EXTRACT_CLAIMS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arxiv_ids: ARXIV_IDS,
        userId: USER_ID,
      }),
    });

    console.log("Extract-claims status:", extractResponse.status);

    const extractData = await extractResponse.json();

    if (!extractResponse.ok) {
      console.error("Extract-claims error:", extractData.error);
      return;
    }

    papers = extractData.papers;
    console.log(`Extracted claims from ${papers.length} papers\n`);

    // Show a summary of what was extracted
    for (const paper of papers) {
      console.log(`Paper ${paper.arxiv_id}:`);
      console.log(`  - ${paper.claims.length} claims`);
      console.log(`  - ${paper.methods.length} methods`);
      console.log(`  - ${paper.limitations.length} limitations`);
    }
  } catch (error) {
    console.error("Extract-claims request failed:", error);
    return;
  }

  console.log("\n=== Step 2: Generate research angles ===\n");
  console.log("Research Idea:");
  console.log(`  "${RESEARCH_IDEA.slice(0, 100)}..."\n`);
  console.log("---\n");

  try {
    const startTime = Date.now();

    const response = await fetch(GEN_ANGLES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: USER_ID,
        researchIdea: RESEARCH_IDEA,
        papers: papers,
      }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Gen-angles status: ${response.status} (took ${elapsed}s)\n`);

    const data = await response.json();

    if (!response.ok) {
      console.error("Error:", data.error);
      return;
    }

    console.log(`Based on ${data.analyzedPapers} papers\n`);

    // Print research angles
    console.log("=== TOP 3 RESEARCH ANGLES ===\n");

    data.angles.forEach((angle: ResearchAngle, index: number) => {
      console.log(`--- Angle ${index + 1}: ${angle.title} ---`);
      console.log(`\nDescription: ${angle.description}`);
      console.log(`\nScores:`);
      console.log(`  Novelty:      ${angle.novelty}/10`);
      console.log(`  Practicality: ${angle.practicality}/10`);
      console.log(`  Impact:       ${angle.impact}/10`);
      console.log(`  Overall:      ${angle.overallScore.toFixed(2)}/10`);
      console.log(`\nReasoning: ${angle.reasoning}`);
      console.log(`\nBrief Plan:`);
      angle.briefPlan.forEach((step: string, i: number) => {
        console.log(`  ${i + 1}. ${step}`);
      });
      console.log(`\nAddresses Limitations:`);
      angle.relatedLimitations.forEach((lim: string) => {
        console.log(`  - ${lim}`);
      });
      console.log("\n");
    });
  } catch (error) {
    console.error("Gen-angles request failed:", error);
  }
})();
