"""Pipeline nodes — each function maps to one step in the Pearl research agent."""

from __future__ import annotations

import json
import io
import httpx
from pypdf import PdfReader
from openai import OpenAI
from supabase import create_client

from state import (
    PearlState,
    PaperResult,
    PaperAnalysis,
    ResearchAngle,
    GeneratedAbstract,
    MethodologyInspiration,
    ResearchPlan,
    ResearchPlanIntro,
    Methodology,
    MethodologyPhase,
    TimelineEntry,
    Challenge,
    ExecutionStep,
    ExecutionStepResult,
    ExecutionPlan,
    PlanCritique,
    OverallAssessment,
    CritiqueSection,
    MethodologicalConcern,
    SuggestedImprovement,
)

from config import get_openai_client, get_paper_supabase


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _save_step(state: PearlState, step_name: str, data: dict) -> None:
    """Write a step's output to a JSON file in the output directory."""
    if not state.output_dir:
        return
    import os
    os.makedirs(state.output_dir, exist_ok=True)
    path = os.path.join(state.output_dir, f"{step_name}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"      -> Saved to {path}")


def _llm_json(client: OpenAI, system: str, user: str, *, temperature: float = 0.7, max_tokens: int = 4000) -> dict:
    """Call GPT-4o with JSON mode and return parsed dict."""
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=max_tokens,
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content or "{}")


def _llm_text(client: OpenAI, system: str, user: str, *, temperature: float = 0.7, max_tokens: int = 500) -> str:
    """Call GPT-4o and return plain text."""
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""


def _embed(client: OpenAI, text: str) -> list[float]:
    resp = client.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding


def _fetch_pdf_text(arxiv_id: str) -> str:
    """Download an arXiv PDF and extract its text."""
    url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    r = httpx.get(url, follow_redirects=True, timeout=60)
    r.raise_for_status()
    reader = PdfReader(io.BytesIO(r.content))
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n\n".join(pages)
    # Basic cleanup
    text = text.replace("\r\n", "\n")
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text.strip()


# ===================================================================
# Node 1 — Search for related papers
# ===================================================================


def search_papers(state: PearlState) -> PearlState:
    """Embed the research idea and find similar papers via Supabase vector search."""
    state.current_step = "searching"
    print(f"\n[1/6] Searching for papers related to: {state.research_idea[:80]}...")

    openai = get_openai_client()
    paper_sb = get_paper_supabase()

    embedding = _embed(openai, state.research_idea)

    result = paper_sb.rpc(
        "match_papers",
        {"query_embedding": embedding, "match_threshold": 0.0, "match_count": 10},
    ).execute()

    papers: list[PaperResult] = []
    for row in result.data or []:
        papers.append(
            PaperResult(
                arxiv_id=row.get("arxiv_id", ""),
                title=row.get("title", ""),
                abstract=row.get("abstract", ""),
                authors=row.get("authors"),
                publish_date=row.get("publish_date"),
                similarity=row.get("similarity"),
            )
        )

    state.papers = papers
    print(f"      Found {len(papers)} papers.")
    _save_step(state, "1_search_papers", {
        "research_idea": state.research_idea,
        "papers": [p.model_dump() for p in papers],
    })
    return state


# ===================================================================
# Node 2 — Extract claims from top papers (2-pass)
# ===================================================================


def extract_claims(state: PearlState) -> PearlState:
    """Fetch PDFs for top 5 papers, run 2-pass claim extraction."""
    state.current_step = "extracting"
    top_papers = state.papers[:5]
    print(f"\n[2/6] Extracting claims from {len(top_papers)} papers...")

    openai = get_openai_client()
    analyses: list[PaperAnalysis] = []

    for i, paper in enumerate(top_papers):
        arxiv_id = paper.arxiv_id
        print(f"      Processing paper {i + 1}/{len(top_papers)}: {arxiv_id}")
        try:
            paper_text = _fetch_pdf_text(arxiv_id)
            if not paper_text:
                print(f"      WARNING: No text extracted from {arxiv_id}, skipping.")
                continue

            # Pass 1: synthesize
            raw = _llm_json(
                openai,
                system=(
                    "You are a research paper analyst. Extract key information from academic papers.\n"
                    "Your task is to identify:\n"
                    "1. Main claims/findings - the key scientific claims or discoveries made in the paper\n"
                    "2. Methods - the methodologies, techniques, or approaches used\n"
                    "3. Limitations - acknowledged limitations or potential weaknesses\n"
                    "4. Conclusion - a brief summary of the paper's main contribution\n\n"
                    "Be precise and extract only what is explicitly stated or strongly implied in the paper.\n"
                    "Format your response as JSON with the following structure:\n"
                    '{\n  "claims": ["claim 1", "claim 2", ...],\n'
                    '  "methods": ["method 1", "method 2", ...],\n'
                    '  "limitations": ["limitation 1", "limitation 2", ...],\n'
                    '  "conclusion": "Brief conclusion summary"\n}'
                ),
                user=f"Extract the key claims, methods, limitations, and conclusion from this research paper:\n\n{paper_text[:30000]}",
                temperature=0.3,
                max_tokens=2000,
            )

            # Pass 2: verify & refine
            verified = _llm_json(
                openai,
                system=(
                    "You are a research verification specialist. Your task is to verify and refine "
                    "extracted claims from academic papers.\n\n"
                    "For each claim, method, and limitation:\n"
                    "1. Verify it is actually supported by the paper content\n"
                    "2. Refine the wording for clarity and precision\n"
                    "3. Remove any duplicates or overly vague statements\n"
                    "4. Ensure claims are specific and verifiable\n\n"
                    "Format your response as JSON with the following structure:\n"
                    '{\n  "claims": ["verified claim 1", ...],\n'
                    '  "methods": ["verified method 1", ...],\n'
                    '  "limitations": ["verified limitation 1", ...],\n'
                    '  "conclusion": "Refined conclusion summary"\n}'
                ),
                user=(
                    "Verify and refine these extracted elements against the original paper.\n\n"
                    f"Extracted elements:\n"
                    f"Claims: {json.dumps(raw.get('claims', []))}\n"
                    f"Methods: {json.dumps(raw.get('methods', []))}\n"
                    f"Limitations: {json.dumps(raw.get('limitations', []))}\n"
                    f"Conclusion: {raw.get('conclusion', '')}\n\n"
                    f"Original paper excerpt (for verification):\n{paper_text[:15000]}"
                ),
                temperature=0.2,
                max_tokens=2000,
            )

            analyses.append(
                PaperAnalysis(
                    arxiv_id=arxiv_id,
                    claims=verified.get("claims", []),
                    methods=verified.get("methods", []),
                    limitations=verified.get("limitations", []),
                    conclusion=verified.get("conclusion", ""),
                )
            )
        except Exception as exc:
            print(f"      ERROR processing {arxiv_id}: {exc}")

    state.paper_analyses = analyses
    print(f"      Successfully analysed {len(analyses)} papers.")
    _save_step(state, "2_extract_claims", {
        "paper_analyses": [a.model_dump() for a in analyses],
    })
    return state


# ===================================================================
# Node 3 — Generate research angles
# ===================================================================


def generate_angles(state: PearlState) -> PearlState:
    """Synthesize 5 novel research angles, keep top 3."""
    state.current_step = "generating"
    print("\n[3/6] Generating research angles...")

    openai = get_openai_client()
    analyses = state.paper_analyses

    all_limitations = [l for p in analyses for l in p.limitations]
    all_methods = [m for p in analyses for m in p.methods]
    all_claims = [c for p in analyses for c in p.claims]
    all_conclusions = [p.conclusion for p in analyses if p.conclusion]

    result = _llm_json(
        openai,
        system=(
            "You are a research ideation specialist who identifies promising research directions "
            "by analyzing gaps in existing literature.\n\n"
            "Your task is to synthesize novel research angles based on:\n"
            "1. The user's initial research idea/interest\n"
            "2. Limitations and gaps identified in related papers\n"
            "3. Existing methods that could be extended or combined\n\n"
            "For each research angle, you must:\n"
            "- Provide a clear, concise title\n"
            "- Write a description of the proposed research direction\n"
            "- Rate on three dimensions (1-10 scale):\n"
            "  * Novelty: How original and unexplored is this direction?\n"
            "  * Practicality: How feasible is this research with current resources/methods?\n"
            "  * Impact: How significant would successful results be?\n"
            "- Explain your reasoning for the ratings\n"
            "- Provide a brief action plan (3-5 steps)\n"
            "- List which limitations from the literature this addresses\n\n"
            "Generate exactly 5 research angles, then we will select the top 3.\n\n"
            "Format your response as JSON:\n"
            '{\n  "angles": [\n    {\n'
            '      "title": "Research Angle Title",\n'
            '      "description": "2-3 sentence description of the research direction",\n'
            '      "novelty": 8,\n'
            '      "practicality": 7,\n'
            '      "impact": 9,\n'
            '      "reasoning": "Explanation of why this is promising and how ratings were determined",\n'
            '      "briefPlan": ["Step 1", "Step 2", "Step 3"],\n'
            '      "relatedLimitations": ["limitation this addresses 1", "limitation 2"]\n'
            "    }\n  ]\n}"
        ),
        user=(
            f"User's Research Idea/Interest:\n{state.research_idea}\n\n"
            f"Limitations identified in related papers:\n"
            + "\n".join(f"{i+1}. {l}" for i, l in enumerate(all_limitations))
            + f"\n\nMethods used in related papers:\n"
            + "\n".join(f"{i+1}. {m}" for i, m in enumerate(all_methods))
            + f"\n\nKey claims from related papers:\n"
            + "\n".join(f"{i+1}. {c}" for i, c in enumerate(all_claims))
            + f"\n\nConclusions from related papers:\n"
            + "\n".join(f"{i+1}. {c}" for i, c in enumerate(all_conclusions))
            + "\n\nBased on this information, generate 5 novel research angles that address "
            "gaps in the current literature while aligning with the user's interests."
        ),
        temperature=0.7,
        max_tokens=4000,
    )

    angles: list[ResearchAngle] = []
    for a in result.get("angles", []):
        angle = ResearchAngle(
            title=a.get("title", ""),
            description=a.get("description", ""),
            novelty=a.get("novelty", 5),
            practicality=a.get("practicality", 5),
            impact=a.get("impact", 5),
            reasoning=a.get("reasoning", ""),
            brief_plan=a.get("briefPlan", []),
            related_limitations=a.get("relatedLimitations", []),
        )
        angle.overall_score = (angle.novelty + angle.practicality + angle.impact) / 3
        angles.append(angle)

    angles.sort(key=lambda a: a.overall_score, reverse=True)
    state.angles = angles[:3]

    for i, angle in enumerate(state.angles):
        print(f"      Angle {i+1}: {angle.title} (score: {angle.overall_score:.1f})")
    _save_step(state, "3_generate_angles", {
        "angles": [a.model_dump() for a in state.angles],
    })
    return state


# ===================================================================
# Node 4 — Generate abstract for the top angle
# ===================================================================


def generate_abstract(state: PearlState) -> PearlState:
    """Generate a research proposal abstract from the selected angle."""
    state.current_step = "generating_abstract"
    idx = state.selected_angle_index
    angle = state.angles[idx]
    print(f"\n[4/6] Generating abstract for: {angle.title}")

    openai = get_openai_client()

    result = _llm_json(
        openai,
        system=(
            "You are an expert academic writer who crafts compelling research proposal abstracts.\n\n"
            "Your task is to synthesize a well-structured research abstract based on:\n"
            "1. A selected research angle (with title, description, plan, and identified gaps)\n"
            "2. The user's original research interest\n\n"
            "The abstract should:\n"
            "- Be 200-300 words\n"
            "- Clearly state the research problem and motivation\n"
            "- Outline the proposed approach/methodology\n"
            "- Highlight expected contributions and impact\n"
            "- Be written in formal academic style\n"
            "- Address the gaps/limitations identified in the research angle\n\n"
            "Also provide:\n"
            "- A concise, descriptive title for the research proposal\n"
            "- 5-7 relevant keywords\n"
            "- 3-4 key expected contributions\n\n"
            "Format your response as JSON:\n"
            '{\n  "title": "Research Proposal Title",\n'
            '  "abstract": "The full abstract text...",\n'
            '  "keywords": ["keyword1", "keyword2", ...],\n'
            '  "contributions": ["contribution 1", "contribution 2", ...]\n}'
        ),
        user=(
            "Generate a research proposal abstract based on the following:\n\n"
            f"Selected Research Angle:\n"
            f"- Title: {angle.title}\n"
            f"- Description: {angle.description}\n"
            f"- Reasoning: {angle.reasoning}\n"
            f"- Brief Plan: {chr(10).join(f'{i+1}. {s}' for i, s in enumerate(angle.brief_plan))}\n"
            f"- Addresses these limitations: {', '.join(angle.related_limitations)}\n"
            f"- Scores: Novelty {angle.novelty}/10, Practicality {angle.practicality}/10, Impact {angle.impact}/10\n\n"
            f"User's Original Research Interest:\n{state.research_idea}\n\n"
            "Generate a compelling research proposal abstract that synthesizes this information into a cohesive narrative."
        ),
        temperature=0.7,
        max_tokens=2000,
    )

    state.generated_abstract = GeneratedAbstract(
        title=result.get("title", "Untitled Research Proposal"),
        abstract=result.get("abstract", ""),
        keywords=result.get("keywords", []),
        contributions=result.get("contributions", []),
    )

    print(f"      Title: {state.generated_abstract.title}")
    _save_step(state, "4_generate_abstract", state.generated_abstract.model_dump())
    return state


# ===================================================================
# Node 5 — Build detailed research plan
# ===================================================================


def build_plan(state: PearlState) -> PearlState:
    """Build a comprehensive research plan: search for methodology inspiration, then generate."""
    state.current_step = "building_plan"
    angle = state.angles[state.selected_angle_index]
    print(f"\n[5/6] Building research plan for: {angle.title}")

    openai = get_openai_client()
    paper_sb = get_paper_supabase()

    # 5a — generate a short abstract for searching
    short_abstract = _llm_text(
        openai,
        system=(
            "You are an expert academic writer. Generate a concise research abstract (150-200 words) that:\n"
            "- Clearly states the research problem\n"
            "- Outlines the proposed approach\n"
            "- Highlights expected contributions\n\n"
            "Return only the abstract text, no JSON formatting needed."
        ),
        user=(
            f"Generate a research abstract based on:\n\n"
            f"Research Angle: {angle.title}\n"
            f"Description: {angle.description}\n"
            f"Brief Plan: {'; '.join(angle.brief_plan)}\n"
            f"Addresses limitations: {', '.join(angle.related_limitations)}\n\n"
            f"User's Research Interest: {state.research_idea}"
        ),
        max_tokens=500,
    )

    # 5b — vector search for methodology-relevant papers
    print("      Searching for methodology inspiration papers...")
    embedding = _embed(openai, short_abstract)
    result = paper_sb.rpc(
        "match_papers",
        {"query_embedding": embedding, "match_threshold": 0.0, "match_count": 10},
    ).execute()
    similar_papers = result.data or []

    # 5c — extract methodologies from top 5
    print("      Extracting methodologies from top papers...")
    inspirations: list[MethodologyInspiration] = []
    for paper in similar_papers[:5]:
        aid = paper.get("arxiv_id")
        if not aid:
            continue
        try:
            text = _fetch_pdf_text(aid)
            m = _llm_json(
                openai,
                system=(
                    "You are a research methodology analyst. Extract the key methodologies, "
                    "techniques, and approaches used in this paper.\n\n"
                    "Focus on:\n"
                    "1. Specific techniques and algorithms used\n"
                    "2. Experimental design and setup\n"
                    "3. Data collection and processing methods\n"
                    "4. Evaluation metrics and approaches\n\n"
                    'Return JSON: { "methods": ["method 1", "method 2", ...], '
                    '"relevance": "brief note on how these methods could inspire new research" }'
                ),
                user=f"Extract methodologies from this paper:\n\n{text[:25000]}",
                temperature=0.3,
                max_tokens=1000,
            )
            methods = m.get("methods", [])
            if methods:
                inspirations.append(
                    MethodologyInspiration(arxiv_id=aid, methods=methods, relevance=m.get("relevance", ""))
                )
        except Exception as exc:
            print(f"      WARNING: Could not extract methods from {aid}: {exc}")

    state.methodology_inspirations = inspirations

    # 5d — generate the full plan
    print("      Generating detailed research plan...")
    methods_context = "\n".join(
        f"From {m.arxiv_id}: {', '.join(m.methods)} ({m.relevance})"
        for m in inspirations
        if m.methods
    )

    plan_data = _llm_json(
        openai,
        system=(
            "You are an expert research planner who creates detailed, actionable research plans "
            "in academic format.\n\n"
            "Create a comprehensive research plan that is:\n"
            "1. EXPLICIT - Every step should be clearly defined with specific actions\n"
            "2. PROCEDURAL - Written as a step-by-step procedure that can be followed\n"
            "3. DETAILED - Include specific techniques, tools, and approaches where applicable\n"
            "4. REALISTIC - Consider practical constraints and potential challenges\n\n"
            "The plan should follow academic research paper structure and be thorough enough "
            "that a graduate student could follow it.\n\n"
            "Return JSON with this structure:\n"
            "{\n"
            '  "title": "Research project title",\n'
            '  "abstract": "200-250 word abstract",\n'
            '  "introduction": {\n'
            '    "background": "2-3 paragraphs of background context",\n'
            '    "problemStatement": "Clear problem statement",\n'
            '    "researchQuestions": ["RQ1", "RQ2", ...],\n'
            '    "objectives": ["Objective 1", "Objective 2", ...]\n'
            "  },\n"
            '  "methodology": {\n'
            '    "overview": "Methodology overview paragraph",\n'
            '    "phases": [\n'
            "      {\n"
            '        "name": "Phase name",\n'
            '        "description": "Detailed description",\n'
            '        "steps": ["Specific step 1", "Specific step 2", ...],\n'
            '        "expectedOutputs": ["Output 1", "Output 2", ...],\n'
            '        "tools": ["Tool 1", "Tool 2", ...]\n'
            "      }\n"
            "    ],\n"
            '    "dataCollection": "Data collection approach if applicable",\n'
            '    "analysisApproach": "Analysis methodology"\n'
            "  },\n"
            '  "expectedContributions": ["Contribution 1", "Contribution 2", ...],\n'
            '  "timeline": [\n'
            "    {\n"
            '      "phase": "Phase name",\n'
            '      "duration": "e.g., Weeks 1-4",\n'
            '      "milestones": ["Milestone 1", "Milestone 2"]\n'
            "    }\n"
            "  ],\n"
            '  "potentialChallenges": [\n'
            "    {\n"
            '      "challenge": "Challenge description",\n'
            '      "mitigation": "Mitigation strategy"\n'
            "    }\n"
            "  ],\n"
            '  "references": ["Reference to methodology inspiration sources"]\n'
            "}"
        ),
        user=(
            "Create a detailed research plan based on the following:\n\n"
            f"RESEARCH ANGLE:\n"
            f"Title: {angle.title}\n"
            f"Description: {angle.description}\n"
            f"Reasoning: {angle.reasoning}\n"
            f"Initial Brief Plan:\n"
            + "\n".join(f"{i+1}. {s}" for i, s in enumerate(angle.brief_plan))
            + f"\n\nAddresses these limitations in existing work:\n- "
            + "\n- ".join(angle.related_limitations)
            + f"\n\nUSER'S RESEARCH INTEREST:\n{state.research_idea}\n\n"
            f"GENERATED ABSTRACT:\n{short_abstract}\n\n"
            f"METHODOLOGY INSPIRATIONS FROM SIMILAR PAPERS:\n"
            f"{methods_context or 'No specific methodology inspirations available'}\n\n"
            "Generate a comprehensive, explicit, and actionable research plan. "
            "Each methodology phase should have specific, numbered steps that are "
            "detailed enough to follow without ambiguity."
        ),
        temperature=0.7,
        max_tokens=6000,
    )

    intro = plan_data.get("introduction", {})
    meth = plan_data.get("methodology", {})

    state.research_plan = ResearchPlan(
        title=plan_data.get("title", angle.title),
        abstract=plan_data.get("abstract", short_abstract),
        introduction=ResearchPlanIntro(
            background=intro.get("background", ""),
            problem_statement=intro.get("problemStatement", ""),
            research_questions=intro.get("researchQuestions", []),
            objectives=intro.get("objectives", []),
        ),
        methodology=Methodology(
            overview=meth.get("overview", ""),
            phases=[
                MethodologyPhase(
                    name=p.get("name", ""),
                    description=p.get("description", ""),
                    steps=p.get("steps", []),
                    expected_outputs=p.get("expectedOutputs", []),
                    tools=p.get("tools", []),
                )
                for p in meth.get("phases", [])
            ],
            data_collection=meth.get("dataCollection"),
            analysis_approach=meth.get("analysisApproach"),
        ),
        expected_contributions=plan_data.get("expectedContributions", []),
        timeline=[
            TimelineEntry(phase=t.get("phase", ""), duration=t.get("duration", ""), milestones=t.get("milestones", []))
            for t in plan_data.get("timeline", [])
        ],
        potential_challenges=[
            Challenge(challenge=c.get("challenge", ""), mitigation=c.get("mitigation", ""))
            for c in plan_data.get("potentialChallenges", [])
        ],
        references=plan_data.get("references", []),
    )

    print(f"      Plan generated: {state.research_plan.title}")
    _save_step(state, "5_build_plan", {
        "plan": state.research_plan.model_dump(),
        "methodology_inspirations": [m.model_dump() for m in inspirations],
    })
    return state


# ===================================================================
# Node 6 — Critique the plan
# ===================================================================


def critique_plan(state: PearlState) -> PearlState:
    """Provide constructive criticism of the generated research plan."""
    state.current_step = "critiquing"
    plan = state.research_plan
    if not plan:
        print("\n[6/6] Skipping critique — no plan available.")
        return state

    print(f"\n[6/6] Critiquing research plan: {plan.title}")
    openai = get_openai_client()

    # Build plan text for the prompt
    phases_text = ""
    for i, phase in enumerate(plan.methodology.phases):
        phases_text += f"\nPhase {i+1}: {phase.name}\n"
        phases_text += f"Description: {phase.description}\n"
        phases_text += "Steps:\n" + "\n".join(f"  {j+1}. {s}" for j, s in enumerate(phase.steps)) + "\n"
        phases_text += f"Expected Outputs: {', '.join(phase.expected_outputs)}\n"
        if phase.tools:
            phases_text += f"Tools: {', '.join(phase.tools)}\n"

    result = _llm_json(
        openai,
        system=(
            "You are an expert research advisor and peer reviewer with extensive experience in "
            "evaluating research proposals. Your role is to provide constructive, actionable "
            "criticism that helps strengthen research plans.\n\n"
            "When critiquing a research plan:\n"
            "1. Be thorough but fair - identify both strengths and weaknesses\n"
            "2. Be specific - vague criticism is not helpful\n"
            "3. Be constructive - every weakness should come with a suggestion for improvement\n"
            "4. Consider feasibility, novelty, methodology rigor, and clarity\n"
            "5. Think like a skeptical reviewer who wants the research to succeed\n\n"
            "Evaluate the following aspects:\n"
            "- Clarity and specificity of research questions\n"
            "- Soundness of methodology\n"
            "- Feasibility of the proposed approach\n"
            "- Completeness of the plan\n"
            "- Potential gaps or blind spots\n"
            "- Timeline realism\n"
            "- Risk assessment adequacy\n\n"
            "Return JSON with this structure:\n"
            "{\n"
            '  "overallAssessment": {\n'
            '    "summary": "2-3 sentence overall assessment",\n'
            '    "score": 7,\n'
            '    "readinessLevel": "needs_minor_revision"\n'
            "  },\n"
            '  "sectionCritiques": [\n'
            "    {\n"
            '      "section": "Section name",\n'
            '      "strengths": ["Strength 1"],\n'
            '      "weaknesses": ["Weakness 1"],\n'
            '      "suggestions": ["Suggestion 1"],\n'
            '      "priority": "high"\n'
            "    }\n"
            "  ],\n"
            '  "methodologicalConcerns": [\n'
            "    {\n"
            '      "concern": "Description",\n'
            '      "impact": "How this could affect the research",\n'
            '      "recommendation": "Specific recommendation"\n'
            "    }\n"
            "  ],\n"
            '  "missingElements": ["Missing element 1"],\n'
            '  "suggestedImprovements": [\n'
            "    {\n"
            '      "area": "Area",\n'
            '      "currentState": "What the plan currently says",\n'
            '      "suggestedChange": "What should be changed",\n'
            '      "rationale": "Why"\n'
            "    }\n"
            "  ],\n"
            '  "questionsToConsider": ["Question 1"]\n'
            "}"
        ),
        user=(
            f"Please provide a thorough critique of this research plan:\n\n"
            f"TITLE: {plan.title}\n\n"
            f"ABSTRACT:\n{plan.abstract}\n\n"
            f"INTRODUCTION:\n"
            f"Background: {plan.introduction.background}\n"
            f"Problem Statement: {plan.introduction.problem_statement}\n"
            f"Research Questions:\n"
            + "\n".join(f"  {i+1}. {q}" for i, q in enumerate(plan.introduction.research_questions))
            + f"\nObjectives:\n"
            + "\n".join(f"  {i+1}. {o}" for i, o in enumerate(plan.introduction.objectives))
            + f"\n\nMETHODOLOGY:\nOverview: {plan.methodology.overview}\n\nPhases:{phases_text}\n"
            + (f"\nData Collection: {plan.methodology.data_collection}" if plan.methodology.data_collection else "")
            + (f"\nAnalysis Approach: {plan.methodology.analysis_approach}" if plan.methodology.analysis_approach else "")
            + f"\n\nEXPECTED CONTRIBUTIONS:\n"
            + "\n".join(f"{i+1}. {c}" for i, c in enumerate(plan.expected_contributions))
            + f"\n\nTIMELINE:\n"
            + "\n".join(f"{t.phase} ({t.duration}): {', '.join(t.milestones)}" for t in plan.timeline)
            + f"\n\nPOTENTIAL CHALLENGES:\n"
            + "\n".join(f"- {c.challenge}\n  Mitigation: {c.mitigation}" for c in plan.potential_challenges)
            + "\n\nProvide a comprehensive critique with specific, actionable feedback."
        ),
        temperature=0.6,
        max_tokens=4000,
    )

    oa = result.get("overallAssessment", {})
    state.critique = PlanCritique(
        overall_assessment=OverallAssessment(
            summary=oa.get("summary", ""),
            score=oa.get("score", 5),
            readiness_level=oa.get("readinessLevel", "needs_major_revision"),
        ),
        section_critiques=[
            CritiqueSection(
                section=s.get("section", ""),
                strengths=s.get("strengths", []),
                weaknesses=s.get("weaknesses", []),
                suggestions=s.get("suggestions", []),
                priority=s.get("priority", "medium"),
            )
            for s in result.get("sectionCritiques", [])
        ],
        methodological_concerns=[
            MethodologicalConcern(
                concern=m.get("concern", ""),
                impact=m.get("impact", ""),
                recommendation=m.get("recommendation", ""),
            )
            for m in result.get("methodologicalConcerns", [])
        ],
        missing_elements=result.get("missingElements", []),
        suggested_improvements=[
            SuggestedImprovement(
                area=s.get("area", ""),
                current_state=s.get("currentState", ""),
                suggested_change=s.get("suggestedChange", ""),
                rationale=s.get("rationale", ""),
            )
            for s in result.get("suggestedImprovements", [])
        ],
        questions_to_consider=result.get("questionsToConsider", []),
    )

    print(f"      Score: {state.critique.overall_assessment.score}/10")
    print(f"      Readiness: {state.critique.overall_assessment.readiness_level}")
    _save_step(state, "6_critique_plan", state.critique.model_dump())
    return state


# ===================================================================
# Node 7a — Check readiness (conditional edge function)
# ===================================================================


def check_readiness(state: PearlState) -> str:
    """Conditional edge: decide whether to execute or skip.

    Returns "execute" if:
      - target_repo is set (--execute flag was used)
      - critique readiness is NOT needs_major_revision
    Otherwise returns "skip".
    """
    # No target repo means --execute was not passed
    if not state.target_repo:
        return "skip"

    # Check critique readiness
    if state.critique:
        level = state.critique.overall_assessment.readiness_level
        if level == "needs_major_revision":
            print("\n[7/8] Execution GATED — plan needs major revision.")
            state.execution_status = "gated"
            return "skip"
        if level == "needs_minor_revision":
            print("\n[7/8] Warning: plan needs minor revision, proceeding with execution anyway.")

    return "execute"


# ===================================================================
# Node 7b — Translate research plan into execution steps
# ===================================================================


def translate_plan(state: PearlState) -> PearlState:
    """Translate the ResearchPlan into a flat ExecutionPlan."""
    state.current_step = "translating"
    plan = state.research_plan
    if not plan:
        print("\n[7/8] Skipping translation — no research plan available.")
        return state

    print(f"\n[7/8] Translating research plan into execution steps...")

    from plan_translator import translate_plan as do_translate

    execution_plan = do_translate(
        research_plan=plan,
        research_idea=state.research_idea,
        target_repo=state.target_repo,
        budget_cap_usd=state.execution_budget_usd,
    )

    state.execution_plan = execution_plan
    print(f"      Generated {len(execution_plan.steps)} execution steps.")
    for step in execution_plan.steps:
        print(f"      Step {step.step_number}: {step.description} [{step.risk_level}]")

    _save_step(state, "7_translate_plan", {
        "reasoning": execution_plan.reasoning,
        "steps": [s.model_dump() for s in execution_plan.steps],
    })
    return state


# ===================================================================
# Node 8 — Execute the plan via worker containers
# ===================================================================


def execute_plan(state: PearlState) -> PearlState:
    """Execute the plan step-by-step using Docker worker containers."""
    state.current_step = "executing"
    ep = state.execution_plan
    if not ep or not ep.steps:
        print("\n[8/8] Skipping execution — no execution plan available.")
        return state

    print(f"\n[8/8] Executing research plan ({len(ep.steps)} steps, ${ep.budget_cap_usd:.2f} budget)...")
    state.execution_status = "running"

    from executor import execute_plan as do_execute

    results, total_cost, revisions = do_execute(
        plan=ep,
        research_plan_title=state.research_plan.title if state.research_plan else "",
        research_idea=state.research_idea,
    )

    state.execution_results = results
    ep.total_cost_usd = total_cost
    ep.plan_revisions = revisions

    # Determine overall status
    completed = sum(1 for r in results if r.status == "completed")
    failed = sum(1 for r in results if r.status == "failed")
    if failed == 0 and completed > 0:
        state.execution_status = "completed"
    elif completed > 0:
        state.execution_status = "completed"  # partial success
    else:
        state.execution_status = "failed"

    print(f"\n      Execution finished: {completed} completed, {failed} failed")
    print(f"      Total cost: ${total_cost:.2f}")

    _save_step(state, "8_execute_plan", {
        "status": state.execution_status,
        "total_cost_usd": total_cost,
        "plan_revisions": revisions,
        "results": [r.model_dump() for r in results],
    })
    return state
