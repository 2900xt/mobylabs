// Takes a research plan and provides constructive criticism
// Identifies weaknesses, gaps, and suggests improvements
// Returns a structured critique with actionable feedback

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ResearchPlan {
  title: string;
  abstract: string;
  introduction?: {
    background: string;
    problemStatement: string;
    researchQuestions: string[];
    objectives: string[];
  };
  methodology?: {
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
  expectedContributions?: string[];
  timeline?: Array<{
    phase: string;
    duration: string;
    milestones: string[];
  }>;
  potentialChallenges?: Array<{
    challenge: string;
    mitigation: string;
  }>;
}

interface CritiquePlanRequestBody {
  userId: string;
  plan: ResearchPlan;
  focusAreas?: string[]; // Optional specific areas to focus critique on
}

interface CritiqueSection {
  section: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  priority: "high" | "medium" | "low";
}

interface PlanCritique {
  overallAssessment: {
    summary: string;
    score: number; // 1-10
    readinessLevel: "needs_major_revision" | "needs_minor_revision" | "ready_for_execution";
  };
  sectionCritiques: CritiqueSection[];
  methodologicalConcerns: Array<{
    concern: string;
    impact: string;
    recommendation: string;
  }>;
  missingElements: string[];
  suggestedImprovements: Array<{
    area: string;
    currentState: string;
    suggestedChange: string;
    rationale: string;
  }>;
  questionsToConsider: string[];
}

interface CritiquePlanResponseBody {
  critique: PlanCritique;
  planTitle: string;
}

async function generateCritique(
  plan: ResearchPlan,
  focusAreas?: string[]
): Promise<PlanCritique> {
  const focusContext = focusAreas && focusAreas.length > 0
    ? `\n\nPay special attention to these areas: ${focusAreas.join(", ")}`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert research advisor and peer reviewer with extensive experience in evaluating research proposals. Your role is to provide constructive, actionable criticism that helps strengthen research plans.

When critiquing a research plan:
1. Be thorough but fair - identify both strengths and weaknesses
2. Be specific - vague criticism is not helpful
3. Be constructive - every weakness should come with a suggestion for improvement
4. Consider feasibility, novelty, methodology rigor, and clarity
5. Think like a skeptical reviewer who wants the research to succeed

Evaluate the following aspects:
- Clarity and specificity of research questions
- Soundness of methodology
- Feasibility of the proposed approach
- Completeness of the plan
- Potential gaps or blind spots
- Timeline realism
- Risk assessment adequacy

Return JSON with this structure:
{
  "overallAssessment": {
    "summary": "2-3 sentence overall assessment",
    "score": 7,
    "readinessLevel": "needs_minor_revision"
  },
  "sectionCritiques": [
    {
      "section": "Section name (e.g., Methodology, Introduction)",
      "strengths": ["Strength 1", "Strength 2"],
      "weaknesses": ["Weakness 1", "Weakness 2"],
      "suggestions": ["Specific suggestion 1", "Specific suggestion 2"],
      "priority": "high"
    }
  ],
  "methodologicalConcerns": [
    {
      "concern": "Description of methodological concern",
      "impact": "How this could affect the research",
      "recommendation": "Specific recommendation to address it"
    }
  ],
  "missingElements": ["Missing element 1", "Missing element 2"],
  "suggestedImprovements": [
    {
      "area": "Area needing improvement",
      "currentState": "What the plan currently says/does",
      "suggestedChange": "What should be changed",
      "rationale": "Why this change would improve the plan"
    }
  ],
  "questionsToConsider": ["Question 1 the researcher should think about", "Question 2"]
}`
      },
      {
        role: "user",
        content: `Please provide a thorough critique of this research plan:

TITLE: ${plan.title}

ABSTRACT:
${plan.abstract}

${plan.introduction ? `INTRODUCTION:
Background: ${plan.introduction.background}
Problem Statement: ${plan.introduction.problemStatement}
Research Questions:
${plan.introduction.researchQuestions.map((q, i) => `  ${i + 1}. ${q}`).join("\n")}
Objectives:
${plan.introduction.objectives.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}
` : ""}

${plan.methodology ? `METHODOLOGY:
Overview: ${plan.methodology.overview}

Phases:
${plan.methodology.phases.map((phase, i) => `
Phase ${i + 1}: ${phase.name}
Description: ${phase.description}
Steps:
${phase.steps.map((s, j) => `  ${j + 1}. ${s}`).join("\n")}
Expected Outputs: ${phase.expectedOutputs.join(", ")}
${phase.tools ? `Tools: ${phase.tools.join(", ")}` : ""}
`).join("\n")}

${plan.methodology.dataCollection ? `Data Collection: ${plan.methodology.dataCollection}` : ""}
${plan.methodology.analysisApproach ? `Analysis Approach: ${plan.methodology.analysisApproach}` : ""}
` : ""}

${plan.expectedContributions ? `EXPECTED CONTRIBUTIONS:
${plan.expectedContributions.map((c, i) => `${i + 1}. ${c}`).join("\n")}
` : ""}

${plan.timeline ? `TIMELINE:
${plan.timeline.map(t => `${t.phase} (${t.duration}): ${t.milestones.join(", ")}`).join("\n")}
` : ""}

${plan.potentialChallenges ? `POTENTIAL CHALLENGES:
${plan.potentialChallenges.map(c => `- ${c.challenge}\n  Mitigation: ${c.mitigation}`).join("\n")}
` : ""}
${focusContext}

Provide a comprehensive critique with specific, actionable feedback.`
      }
    ],
    max_tokens: 4000,
    temperature: 0.6,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message?.content || "{}";
  const parsed = JSON.parse(content);

  return {
    overallAssessment: parsed.overallAssessment || {
      summary: "Unable to generate assessment",
      score: 5,
      readinessLevel: "needs_major_revision"
    },
    sectionCritiques: parsed.sectionCritiques || [],
    methodologicalConcerns: parsed.methodologicalConcerns || [],
    missingElements: parsed.missingElements || [],
    suggestedImprovements: parsed.suggestedImprovements || [],
    questionsToConsider: parsed.questionsToConsider || []
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: CritiquePlanRequestBody = await request.json();
    const { userId, plan, focusAreas } = body;

    // Rate limiting
    const identifier = getClientIdentifier(request, userId);
    const rateLimit = checkRateLimit(identifier, "critique-plan", RATE_LIMITS.SEARCH_CREATE);

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

    if (!plan || typeof plan !== "object") {
      return NextResponse.json(
        { error: "plan is required and must be an object" },
        { status: 400 }
      );
    }

    if (!plan.title || !plan.abstract) {
      return NextResponse.json(
        { error: "plan must contain at least title and abstract fields" },
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

    // Check credits - costs 5 credits
    const creditCost = 5;
    if (profile.credits_remaining < creditCost) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }

    // Generate the critique
    const critique = await generateCritique(plan, focusAreas);

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

    const response: CritiquePlanResponseBody = {
      critique,
      planTitle: plan.title
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Critique plan error:", error);
    return NextResponse.json(
      { error: "Failed to critique plan. Please try again." },
      { status: 500 }
    );
  }
}
