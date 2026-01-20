// Takes in the output of /gen-angles (research angles with ratings, reasoning, brief plans, related limitations)
// Then, synthesizes an abstract for a research proposal that addresses the gaps identified in the angles.
// Returns the generated abstract.

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

interface GenAbstractRequestBody {
  userId: string;
  selectedAngle: ResearchAngle; // The chosen angle from /gen-angles
  userIdea: string; // Original research idea
  additionalContext?: string; // Optional additional context or requirements
}

interface GeneratedAbstract {
  title: string;
  abstract: string;
  keywords: string[];
  contributions: string[];
}

interface GenAbstractResponseBody {
  generated: GeneratedAbstract;
  basedOnAngle: string;
  userIdea: string;
}

// Generate a research abstract from a selected angle
async function generateAbstract(
  angle: ResearchAngle,
  userIdea: string,
  additionalContext?: string
): Promise<GeneratedAbstract> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert academic writer who crafts compelling research proposal abstracts.

Your task is to synthesize a well-structured research abstract based on:
1. A selected research angle (with title, description, plan, and identified gaps)
2. The user's original research interest
3. Any additional context provided

The abstract should:
- Be 200-300 words
- Clearly state the research problem and motivation
- Outline the proposed approach/methodology
- Highlight expected contributions and impact
- Be written in formal academic style
- Address the gaps/limitations identified in the research angle

Also provide:
- A concise, descriptive title for the research proposal
- 5-7 relevant keywords
- 3-4 key expected contributions

Format your response as JSON:
{
  "title": "Research Proposal Title",
  "abstract": "The full abstract text...",
  "keywords": ["keyword1", "keyword2", ...],
  "contributions": ["contribution 1", "contribution 2", ...]
}`
      },
      {
        role: "user",
        content: `Generate a research proposal abstract based on the following:

Selected Research Angle:
- Title: ${angle.title}
- Description: ${angle.description}
- Reasoning: ${angle.reasoning}
- Brief Plan: ${angle.briefPlan.map((step, i) => `${i + 1}. ${step}`).join('\n')}
- Addresses these limitations: ${angle.relatedLimitations.join(', ')}
- Scores: Novelty ${angle.novelty}/10, Practicality ${angle.practicality}/10, Impact ${angle.impact}/10

User's Original Research Interest:
${userIdea}

${additionalContext ? `Additional Context/Requirements:\n${additionalContext}` : ''}

Generate a compelling research proposal abstract that synthesizes this information into a cohesive narrative.`
      }
    ],
    max_tokens: 2000,
    temperature: 0.7,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message?.content || "{}";
  const parsed = JSON.parse(content);

  return {
    title: parsed.title || "Untitled Research Proposal",
    abstract: parsed.abstract || "",
    keywords: parsed.keywords || [],
    contributions: parsed.contributions || []
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GenAbstractRequestBody = await request.json();
    const { userId, selectedAngle, userIdea, additionalContext } = body;

    // Rate limiting
    const identifier = getClientIdentifier(request, userId);
    const rateLimit = checkRateLimit(identifier, "gen-abstract", RATE_LIMITS.SEARCH_CREATE);

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

    if (!userIdea || typeof userIdea !== "string") {
      return NextResponse.json(
        { error: "userIdea is required and must be a string" },
        { status: 400 }
      );
    }

    if (userIdea.length < 20) {
      return NextResponse.json(
        { error: "userIdea must be at least 20 characters" },
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

    // Check credits - costs 1 credit
    if (profile.credits_remaining < 1) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }

    // Deduct 1 credit
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits_remaining: profile.credits_remaining - 1 })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating credits:", updateError);
      return NextResponse.json(
        { error: "Failed to update credits" },
        { status: 402 }
      );
    }

    // Generate the abstract
    const generated = await generateAbstract(selectedAngle, userIdea, additionalContext);

    const response: GenAbstractResponseBody = {
      generated,
      basedOnAngle: selectedAngle.title,
      userIdea,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Gen abstract error:", error);
    return NextResponse.json(
      { error: "Failed to generate abstract. Please try again." },
      { status: 500 }
    );
  }
}