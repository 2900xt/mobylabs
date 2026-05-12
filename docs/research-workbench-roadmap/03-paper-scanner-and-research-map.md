# Stage 3: Paper Scanner and Research Map

## Goal

Add source ingestion for new papers and related research artifacts, then cluster
them into a structured field map.

## Sources

MVP sources:

- arXiv API.
- Semantic Scholar API.
- Crossref metadata.
- User-provided PDFs and URLs.
- Local BibTeX files.

Later sources:

- OpenReview.
- PubMed.
- Papers With Code.
- GitHub repositories.
- Conference proceedings.
- Lab websites and RSS feeds.

## Pipeline

1. Build query set from user profile and research program.
2. Fetch candidate papers.
3. Deduplicate by DOI, arXiv ID, title similarity, and URL.
4. Store metadata.
5. Summarize abstract and available full text.
6. Extract claims, methods, datasets, metrics, and limitations.
7. Link papers to open questions and existing hypotheses.
8. Cluster papers into research directions.
9. Produce a "what changed" brief since the previous scan.

## Research Map Output

The field map should include:

- Active questions.
- Recent methods.
- Known baselines.
- Datasets.
- Evaluation metrics.
- Disagreements or contradictions.
- Under-tested assumptions.
- Promising gaps.
- Papers requiring human review.

## Novelty Guardrails

Never state that an idea is novel without qualification.

Preferred wording:

```text
I found no direct match in the scanned sources. This is not proof of novelty.
Recommended next step: targeted novelty search.
```

The scanner should distinguish:

- `source_not_checked`
- `weak_match_found`
- `adjacent_match_found`
- `direct_match_found`
- `insufficient_evidence`

## Implementation Tasks

- Add paper search adapters.
- Add PDF/text ingestion.
- Add metadata deduplication.
- Add paper summarization prompts with structured output.
- Add claim extraction.
- Add citation storage.
- Add a field-map generator.
- Add scan scheduling and incremental updates.
- Add human review queue for uncertain or important papers.

## Complexity

Complexity: XL.

Risk level: High. External source quality varies, PDF extraction is messy, and
novelty detection is inherently uncertain. The MVP should optimize for careful
provenance rather than breadth.

## Acceptance Criteria

- A user can run `/scan` for an active research program.
- New papers are stored with metadata and summaries.
- Duplicate papers are merged or flagged.
- The app produces a research map with cited support.
- The app can produce a brief of changes since the last scan.
- Uncertain relevance is surfaced for human review instead of hidden.
