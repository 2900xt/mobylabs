// Takes the output of /extract-claims as input (paper analyses with claims, methods, limitations, conclusions)
// Then, synthesizes and rates the limits on practicality/novelty/impact. Also provides reasoning and a very brief plan for how to address the gap.
// Returns the top 3 ideas with the highest rated synthesized gaps.

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface PaperAnalysis {
  arxiv_id: string | null;
  claims: string[];
  methods: string[];
  limitations: string[];
  conclusion: string;
}

interface GenAnglesRequestBody {
  userId: string;
  researchIdea: string;
  papers: PaperAnalysis[]; // Output from /extract-claims
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

interface GenAnglesResponseBody {
  angles: ResearchAngle[];
  analyzedPapers: number;
  userIdea: string;
}

// Synthesize research angles from paper analyses
async function synthesizeAngles(
  userIdea: string,
  paperAnalyses: PaperAnalysis[]
): Promise<ResearchAngle[]> {
  // Compile all limitations and methods from analyzed papers
  const allLimitations = paperAnalyses.flatMap(p => p.limitations);
  const allMethods = paperAnalyses.flatMap(p => p.methods);
  const allClaims = paperAnalyses.flatMap(p => p.claims);
  const allConclusions = paperAnalyses.map(p => p.conclusion).filter(Boolean);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a research ideation specialist who identifies promising research directions by analyzing gaps in existing literature.

Your task is to synthesize novel research angles based on:
1. The user's initial research idea/interest
2. Limitations and gaps identified in related papers
3. Existing methods that could be extended or combined

For each research angle, you must:
- Provide a clear, concise title
- Write a description of the proposed research direction
- Rate on three dimensions (1-10 scale):
  * Novelty: How original and unexplored is this direction?
  * Practicality: How feasible is this research with current resources/methods?
  * Impact: How significant would successful results be?
- Explain your reasoning for the ratings
- Provide a brief action plan (3-5 steps)
- List which limitations from the literature this addresses

Generate exactly 5 research angles, then we will select the top 3.

Format your response as JSON:
{
  "angles": [
    {
      "title": "Research Angle Title",
      "description": "2-3 sentence description of the research direction",
      "novelty": 8,
      "practicality": 7,
      "impact": 9,
      "reasoning": "Explanation of why this is promising and how ratings were determined",
      "briefPlan": ["Step 1", "Step 2", "Step 3"],
      "relatedLimitations": ["limitation this addresses 1", "limitation 2"]
    }
  ]
}`
      },
      {
        role: "user",
        content: `User's Research Idea/Interest:
${userIdea}

Limitations identified in related papers:
${allLimitations.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Methods used in related papers:
${allMethods.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Key claims from related papers:
${allClaims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Conclusions from related papers:
${allConclusions.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Based on this information, generate 5 novel research angles that address gaps in the current literature while aligning with the user's interests.`
      }
    ],
    max_tokens: 4000,
    temperature: 0.7,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message?.content || "{}";
  const parsed = JSON.parse(content);

  // Calculate overall score and sort by it
  const anglesWithScores: ResearchAngle[] = (parsed.angles || []).map((angle: ResearchAngle) => ({
    ...angle,
    overallScore: (angle.novelty + angle.practicality + angle.impact) / 3
  }));

  // Sort by overall score descending and return top 3
  return anglesWithScores
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 3);
}

export async function POST(request: NextRequest) {
  try {
    const body: GenAnglesRequestBody = await request.json();
    const { userId, researchIdea, papers } = body;

    // Rate limiting
    const identifier = getClientIdentifier(request, userId);
    const rateLimit = checkRateLimit(identifier, "gen-angles", RATE_LIMITS.SEARCH_CREATE);

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

    if (!researchIdea || typeof researchIdea !== "string") {
      return NextResponse.json(
        { error: "researchIdea is required and must be a string" },
        { status: 400 }
      );
    }

    if (researchIdea.length < 20) {
      return NextResponse.json(
        { error: "researchIdea must be at least 20 characters" },
        { status: 400 }
      );
    }

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return NextResponse.json(
        { error: "papers is required and must be a non-empty array (output from /extract-claims)" },
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

    // Free for public use - no credit deduction
    if (profile.credits_remaining <= 0) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 402 }
      );
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits_remaining: profile.credits_remaining - 10 })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating credits:', updateError);
      return NextResponse.json(
        { error: 'Failed to update credits' },
        { status: 402 }
      );
    }

    // Synthesize research angles from the provided paper analyses
    const angles = await synthesizeAngles(researchIdea, papers);

    const response: GenAnglesResponseBody = {
      angles,
      analyzedPapers: papers.length,
      userIdea: researchIdea,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Gen angles error:", error);
    return NextResponse.json(
      { error: "Failed to generate research angles. Please try again." },
      { status: 500 }
    );
  }
}
