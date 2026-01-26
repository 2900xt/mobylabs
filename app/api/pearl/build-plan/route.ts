// Takes a novel angle from gen-angles and builds a fully-fleshed research plan
// Pipeline:
// 1. Generate an abstract for the angle
// 2. Search reef for 10 nearest papers using the abstract
// 3. Extract claims from those papers to find methodologies as inspiration
// 4. Generate a detailed research plan in paper format

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import pdf from "pdf-parse/lib/pdf-parse";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const paperSupabase = createClient(
  process.env.PAPER_SUPABASE_URL!,
  process.env.PAPER_SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

interface BuildPlanRequestBody {
  userId: string;
  selectedAngle: ResearchAngle;
  userIdea: string;
  draftPlan?: string; // Optional additional draft plan details from the user
}

interface MethodologyInspiration {
  arxiv_id: string;
  methods: string[];
  relevance: string;
}

interface ResearchPlan {
  title: string;
  abstract: string;
  introduction: {
    background: string;
    problemStatement: string;
    researchQuestions: string[];
    objectives: string[];
  };
  methodology: {
    overview: string;
    phases: Array<{
      name: string;
      description: string;
      steps: string[];
      expectedOutputs: string[];
      tools?: string[];
    }>;
    dataCollection?: string;
    analysisApproach?: string;
  };
  expectedContributions: string[];
  timeline: Array<{
    phase: string;
    duration: string;
    milestones: string[];
  }>;
  potentialChallenges: Array<{
    challenge: string;
    mitigation: string;
  }>;
  references: string[];
}

interface BuildPlanResponseBody {
  plan: ResearchPlan;
  inspirationSources: MethodologyInspiration[];
  basedOnAngle: string;
}

// Generate abstract for the angle (inline version of gen-abstract logic)
async function generateAbstract(
  angle: ResearchAngle,
  userIdea: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert academic writer. Generate a concise research abstract (150-200 words) that:
- Clearly states the research problem
- Outlines the proposed approach
- Highlights expected contributions

Return only the abstract text, no JSON formatting needed.`
      },
      {
        role: "user",
        content: `Generate a research abstract based on:

Research Angle: ${angle.title}
Description: ${angle.description}
Brief Plan: ${angle.briefPlan.join("; ")}
Addresses limitations: ${angle.relatedLimitations.join(", ")}

User's Research Interest: ${userIdea}`
      }
    ],
    max_tokens: 500,
    temperature: 0.7,
  });

  return response.choices[0].message?.content || "";
}

// Search reef for similar papers
async function searchSimilarPapers(abstract: string): Promise<Array<{ arxiv_id: string; title: string; abstract: string }>> {
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: abstract,
  });

  const embedding = embeddingResponse.data[0].embedding;

  const { data: papers, error } = await paperSupabase.rpc("match_papers", {
    query_embedding: embedding,
    match_threshold: 0.0,
    match_count: 10,
  });

  if (error) {
    console.error("Papers fetch error:", error);
    return [];
  }

  return papers || [];
}

// Extract methodologies from a paper
async function fetchArxivPdf(arxivId: string): Promise<Buffer> {
  const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF for arxiv ID ${arxivId}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  const pdfData = await pdf(pdfBuffer);
  return pdfData.text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractMethodologies(arxivId: string): Promise<{ methods: string[]; relevance: string }> {
  try {
    const pdfBuffer = await fetchArxivPdf(arxivId);
    const paperText = await extractTextFromPdf(pdfBuffer);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a research methodology analyst. Extract the key methodologies, techniques, and approaches used in this paper.

Focus on:
1. Specific techniques and algorithms used
2. Experimental design and setup
3. Data collection and processing methods
4. Evaluation metrics and approaches

Return JSON: { "methods": ["method 1", "method 2", ...], "relevance": "brief note on how these methods could inspire new research" }`
        },
        {
          role: "user",
          content: `Extract methodologies from this paper:\n\n${paperText.slice(0, 25000)}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      methods: parsed.methods || [],
      relevance: parsed.relevance || ""
    };
  } catch (error) {
    console.error(`Error extracting methodologies from ${arxivId}:`, error);
    return { methods: [], relevance: "" };
  }
}

// Generate the full research plan
async function generateResearchPlan(
  angle: ResearchAngle,
  userIdea: string,
  abstract: string,
  methodologyInspirations: MethodologyInspiration[],
  draftPlan?: string
): Promise<ResearchPlan> {
  const methodsContext = methodologyInspirations
    .filter(m => m.methods.length > 0)
    .map(m => `From ${m.arxiv_id}: ${m.methods.join(", ")} (${m.relevance})`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert research planner who creates detailed, actionable research plans in academic format.

Create a comprehensive research plan that is:
1. EXPLICIT - Every step should be clearly defined with specific actions
2. PROCEDURAL - Written as a step-by-step procedure that can be followed
3. DETAILED - Include specific techniques, tools, and approaches where applicable
4. REALISTIC - Consider practical constraints and potential challenges

The plan should follow academic research paper structure and be thorough enough that a graduate student could follow it.

Return JSON with this structure:
{
  "title": "Research project title",
  "abstract": "200-250 word abstract",
  "introduction": {
    "background": "2-3 paragraphs of background context",
    "problemStatement": "Clear problem statement",
    "researchQuestions": ["RQ1", "RQ2", ...],
    "objectives": ["Objective 1", "Objective 2", ...]
  },
  "methodology": {
    "overview": "Methodology overview paragraph",
    "phases": [
      {
        "name": "Phase name",
        "description": "Detailed description",
        "steps": ["Specific step 1", "Specific step 2", ...],
        "expectedOutputs": ["Output 1", "Output 2", ...],
        "tools": ["Tool 1", "Tool 2", ...]
      }
    ],
    "dataCollection": "Data collection approach if applicable",
    "analysisApproach": "Analysis methodology"
  },
  "expectedContributions": ["Contribution 1", "Contribution 2", ...],
  "timeline": [
    {
      "phase": "Phase name",
      "duration": "e.g., Weeks 1-4",
      "milestones": ["Milestone 1", "Milestone 2"]
    }
  ],
  "potentialChallenges": [
    {
      "challenge": "Challenge description",
      "mitigation": "Mitigation strategy"
    }
  ],
  "references": ["Reference to methodology inspiration sources"]
}`
      },
      {
        role: "user",
        content: `Create a detailed research plan based on the following:

RESEARCH ANGLE:
Title: ${angle.title}
Description: ${angle.description}
Reasoning: ${angle.reasoning}
Initial Brief Plan:
${angle.briefPlan.map((step, i) => `${i + 1}. ${step}`).join("\n")}

Addresses these limitations in existing work:
${angle.relatedLimitations.join("\n- ")}

USER'S RESEARCH INTEREST:
${userIdea}

GENERATED ABSTRACT:
${abstract}

${draftPlan ? `USER'S DRAFT PLAN NOTES:\n${draftPlan}\n` : ""}
METHODOLOGY INSPIRATIONS FROM SIMILAR PAPERS:
${methodsContext || "No specific methodology inspirations available"}

Generate a comprehensive, explicit, and actionable research plan. Each methodology phase should have specific, numbered steps that are detailed enough to follow without ambiguity.`
      }
    ],
    max_tokens: 6000,
    temperature: 0.7,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message?.content || "{}";
  const parsed = JSON.parse(content);

  return {
    title: parsed.title || angle.title,
    abstract: parsed.abstract || abstract,
    introduction: parsed.introduction || {
      background: "",
      problemStatement: "",
      researchQuestions: [],
      objectives: []
    },
    methodology: parsed.methodology || {
      overview: "",
      phases: [],
    },
    expectedContributions: parsed.expectedContributions || [],
    timeline: parsed.timeline || [],
    potentialChallenges: parsed.potentialChallenges || [],
    references: parsed.references || []
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: BuildPlanRequestBody = await request.json();
    const { userId, selectedAngle, userIdea, draftPlan } = body;

    // Rate limiting
    const identifier = getClientIdentifier(request, userId);
    const rateLimit = checkRateLimit(identifier, "build-plan", RATE_LIMITS.SEARCH_CREATE);

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

    // Validate required fields
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!selectedAngle || typeof selectedAngle !== "object") {
      return NextResponse.json(
        { error: "selectedAngle is required and must be an object (from /gen-angles output)" },
        { status: 400 }
      );
    }

    if (!selectedAngle.title || !selectedAngle.description || !selectedAngle.briefPlan) {
      return NextResponse.json(
        { error: "selectedAngle must contain title, description, and briefPlan fields" },
        { status: 400 }
      );
    }

    if (!userIdea || typeof userIdea !== "string" || userIdea.length < 20) {
      return NextResponse.json(
        { error: "userIdea is required and must be at least 20 characters" },
        { status: 400 }
      );
    }

    // Check user profile and permissions
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("whitelisted, credits_remaining")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    if (!profile.whitelisted) {
      return NextResponse.json(
        { error: "Forbidden: User is not whitelisted" },
        { status: 403 }
      );
    }

    // Check credits - this is an expensive operation (15 credits)
    const creditCost = 15;
    if (profile.credits_remaining < creditCost) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }

    // Step 1: Generate abstract for the angle
    console.log("Step 1: Generating abstract...");
    const abstract = await generateAbstract(selectedAngle, userIdea);

    // Step 2: Search reef for similar papers
    console.log("Step 2: Searching for similar papers...");
    const similarPapers = await searchSimilarPapers(abstract);

    // Step 3: Extract methodologies from top papers (limit to 5 to manage API costs)
    console.log("Step 3: Extracting methodologies...");
    const methodologyInspirations: MethodologyInspiration[] = [];
    const papersToProcess = similarPapers.slice(0, 5);

    for (const paper of papersToProcess) {
      if (paper.arxiv_id) {
        const { methods, relevance } = await extractMethodologies(paper.arxiv_id);
        if (methods.length > 0) {
          methodologyInspirations.push({
            arxiv_id: paper.arxiv_id,
            methods,
            relevance
          });
        }
      }
    }

    // Step 4: Generate the full research plan
    console.log("Step 4: Generating research plan...");
    const plan = await generateResearchPlan(
      selectedAngle,
      userIdea,
      abstract,
      methodologyInspirations,
      draftPlan
    );

    // Deduct credits
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits_remaining: profile.credits_remaining - creditCost })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating credits:", updateError);
      return NextResponse.json(
        { error: "Failed to update credits" },
        { status: 402 }
      );
    }

    const response: BuildPlanResponseBody = {
      plan,
      inspirationSources: methodologyInspirations,
      basedOnAngle: selectedAngle.title
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Build plan error:", error);
    return NextResponse.json(
      { error: "Failed to build research plan. Please try again." },
      { status: 500 }
    );
  }
}
