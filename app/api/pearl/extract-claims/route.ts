// This API route takes a arxiv id as input
// Then, it scrapes the paper text from the arxiv id from it's pdf
//  - Call /api/reef/parse-document to extract text from the pdf
// Then, it synthesizes claims from the paper text using openAI
// Then, we verify and structure the claims using another openAI call
// A structured report is returned as output

interface ExtractClaimsResponseBody 
{
  papers: Array<{
    arxiv_id: string | null;
    claims: string[];
    methods: string[];
    limitations: string[];
    conclusion: string;
  }>
};

export async function POST() {
  return Response.json({ error: 'Bad Request' }, { status: 400 });
}