export interface PaperAnalysis {
  arxiv_id: string | null;
  claims: string[];
  methods: string[];
  limitations: string[];
  conclusion: string;
}

export interface ResearchAngle {
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

export type ProcessStep = "idle" | "searching" | "extracting" | "generating" | "complete" | "error";

export interface ProgressState {
  papersFound: number;
  papersProcessed: number;
  totalPapers: number;
}

export interface ResultsState {
  angles: ResearchAngle[];
  analyzedPapers: number;
}
