// This API route takes a arxiv id as input
// Then, it scrapes the paper text from the arxiv id from it's pdf
//  - Call /api/reef/parse-document to extract text from the pdf
// Then, it synthesizes claims from the paper text using openAI
// Then, we verify and structure the claims using another openAI call
// A structured report is returned as output

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import pdf from "pdf-parse/lib/pdf-parse";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ExtractClaimsRequestBody {
  arxiv_ids: string[];
  userId?: string;
}

interface PaperAnalysis {
  arxiv_id: string | null;
  claims: string[];
  methods: string[];
  limitations: string[];
  conclusion: string;
}

interface ExtractClaimsResponseBody {
  papers: PaperAnalysis[];
}

async function fetchArxivPdf(arxivId: string): Promise<Buffer> {
  // ArXiv PDF URL format: https://arxiv.org/pdf/{id}.pdf
  const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF for arxiv ID ${arxivId}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  const pdfData = await pdf(pdfBuffer);
  let text = pdfData.text;

  // Clean up the extracted text
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

async function synthesizeClaims(paperText: string): Promise<{
  rawClaims: string[];
  rawMethods: string[];
  rawLimitations: string[];
  rawConclusion: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a research paper analyst. Extract key information from academic papers.
Your task is to identify:
1. Main claims/findings - the key scientific claims or discoveries made in the paper
2. Methods - the methodologies, techniques, or approaches used
3. Limitations - acknowledged limitations or potential weaknesses
4. Conclusion - a brief summary of the paper's main contribution

Be precise and extract only what is explicitly stated or strongly implied in the paper.
Format your response as JSON with the following structure:
{
  "claims": ["claim 1", "claim 2", ...],
  "methods": ["method 1", "method 2", ...],
  "limitations": ["limitation 1", "limitation 2", ...],
  "conclusion": "Brief conclusion summary"
}`
      },
      {
        role: "user",
        content: `Extract the key claims, methods, limitations, and conclusion from this research paper:\n\n${paperText.slice(0, 30000)}`
      }
    ],
    max_tokens: 2000,
    temperature: 0.3,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message?.content || "{}";
  const parsed = JSON.parse(content);

  return {
    rawClaims: parsed.claims || [],
    rawMethods: parsed.methods || [],
    rawLimitations: parsed.limitations || [],
    rawConclusion: parsed.conclusion || ""
  };
}

async function verifyAndStructureClaims(
  rawData: {
    rawClaims: string[];
    rawMethods: string[];
    rawLimitations: string[];
    rawConclusion: string;
  },
  paperText: string
): Promise<{
  claims: string[];
  methods: string[];
  limitations: string[];
  conclusion: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a research verification specialist. Your task is to verify and refine extracted claims from academic papers.

For each claim, method, and limitation:
1. Verify it is actually supported by the paper content
2. Refine the wording for clarity and precision
3. Remove any duplicates or overly vague statements
4. Ensure claims are specific and verifiable

Format your response as JSON with the following structure:
{
  "claims": ["verified claim 1", "verified claim 2", ...],
  "methods": ["verified method 1", "verified method 2", ...],
  "limitations": ["verified limitation 1", "verified limitation 2", ...],
  "conclusion": "Refined conclusion summary"
}`
      },
      {
        role: "user",
        content: `Verify and refine these extracted elements against the original paper.

Extracted elements:
Claims: ${JSON.stringify(rawData.rawClaims)}
Methods: ${JSON.stringify(rawData.rawMethods)}
Limitations: ${JSON.stringify(rawData.rawLimitations)}
Conclusion: ${rawData.rawConclusion}

Original paper excerpt (for verification):
${paperText.slice(0, 15000)}`
      }
    ],
    max_tokens: 2000,
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message?.content || "{}";
  const parsed = JSON.parse(content);

  return {
    claims: parsed.claims || [],
    methods: parsed.methods || [],
    limitations: parsed.limitations || [],
    conclusion: parsed.conclusion || ""
  };
}

async function processPaper(arxivId: string): Promise<PaperAnalysis> {
  // Fetch and parse the PDF
  const pdfBuffer = await fetchArxivPdf(arxivId);
  const paperText = await extractTextFromPdf(pdfBuffer);

  if (!paperText) {
    throw new Error(`No text could be extracted from paper ${arxivId}`);
  }

  // First pass: synthesize claims
  const rawData = await synthesizeClaims(paperText);

  // Second pass: verify and structure
  const verifiedData = await verifyAndStructureClaims(rawData, paperText);

  return {
    arxiv_id: arxivId,
    claims: verifiedData.claims,
    methods: verifiedData.methods,
    limitations: verifiedData.limitations,
    conclusion: verifiedData.conclusion
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ExtractClaimsRequestBody = await request.json();
    const { arxiv_ids, userId } = body;

    // Validate input
    if (!arxiv_ids || !Array.isArray(arxiv_ids) || arxiv_ids.length === 0) {
      return NextResponse.json(
        { error: "arxiv_ids is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    // Rate limiting
    const identifier = getClientIdentifier(request, userId);
    const rateLimit = checkRateLimit(identifier, "extract-claims", RATE_LIMITS.SEARCH_CREATE);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetAt.toString(),
            "Retry-After": Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Process each paper
    const papers: PaperAnalysis[] = [];
    const errors: Array<{ arxiv_id: string; error: string }> = [];

    for (const arxivId of arxiv_ids) {
      try {
        const analysis = await processPaper(arxivId);
        papers.push(analysis);
      } catch (error) {
        console.error(`Error processing paper ${arxivId}:`, error);
        errors.push({
          arxiv_id: arxivId,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    const response: ExtractClaimsResponseBody & { errors?: typeof errors } = { papers };
    if (errors.length > 0) {
      response.errors = errors;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Extract claims error:", error);
    return NextResponse.json(
      { error: "Failed to extract claims. Please try again." },
      { status: 500 }
    );
  }
}