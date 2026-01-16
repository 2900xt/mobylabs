#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const REEF_API_BASE_URL = process.env.REEF_API_URL || "https://reef.mobylabs.org";
const REEF_USER_ID = process.env.REEF_USER_ID;
async function createSearch(userId, abstract) {
    const response = await fetch(`${REEF_API_BASE_URL}/api/papers/new`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, abstract }),
    });
    return response.json();
}
async function getSearchResults(userId, searchId) {
    const response = await fetch(`${REEF_API_BASE_URL}/api/search/${searchId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
    });
    return response.json();
}
function formatPaper(paper, index) {
    const authors = Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors;
    return `
## ${index + 1}. ${paper.title}
- **Authors:** ${authors || "N/A"}
- **Published:** ${paper.publish_date || "N/A"}
- **DOI:** ${paper.doi || "N/A"}
- **Similarity:** ${(paper.similarity * 100).toFixed(1)}%

**Abstract:**
${paper.abstract || "No abstract available"}
`.trim();
}
// Create the MCP server
const server = new McpServer({
    name: "reef-ai",
    version: "1.0.0",
});
// Tool: Create a new paper search
server.tool("reef_search_new", "Create a new research paper search from an abstract. Returns a search ID that can be used to retrieve results. Costs 1 credit per search.", {
    abstract: z.string().describe("The research paper abstract or description to search for similar papers"),
    userId: z.string().optional().describe("Your Reef API user ID. If not provided, uses REEF_USER_ID environment variable"),
}, async ({ abstract, userId }) => {
    const effectiveUserId = userId || REEF_USER_ID;
    if (!effectiveUserId) {
        return {
            content: [
                {
                    type: "text",
                    text: "Error: No user ID provided. Either pass userId parameter or set REEF_USER_ID environment variable.",
                },
            ],
        };
    }
    try {
        const result = await createSearch(effectiveUserId, abstract);
        if ("error" in result) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${result.error}`,
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: `Search created successfully!\n\n**Search ID:** ${result.searchId}\n\nUse the \`reef_get_results\` tool with this search ID to retrieve similar papers.`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error creating search: ${error instanceof Error ? error.message : "Unknown error"}`,
                },
            ],
        };
    }
});
// Tool: Get search results
server.tool("reef_get_results", "Retrieve search results for a given search ID. Returns the original search info and a list of similar research papers.", {
    searchId: z.string().describe("The search ID returned from reef_search_new"),
    userId: z.string().optional().describe("Your Reef API user ID. If not provided, uses REEF_USER_ID environment variable"),
}, async ({ searchId, userId }) => {
    const effectiveUserId = userId || REEF_USER_ID;
    if (!effectiveUserId) {
        return {
            content: [
                {
                    type: "text",
                    text: "Error: No user ID provided. Either pass userId parameter or set REEF_USER_ID environment variable.",
                },
            ],
        };
    }
    try {
        const result = await getSearchResults(effectiveUserId, searchId);
        if ("error" in result) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${result.error}`,
                    },
                ],
            };
        }
        const { search, papers } = result;
        const papersText = papers.length > 0
            ? papers.map((paper, i) => formatPaper(paper, i)).join("\n\n---\n\n")
            : "No similar papers found.";
        return {
            content: [
                {
                    type: "text",
                    text: `# Search Results

## Original Search
- **Title:** ${search.title}
- **Created:** ${new Date(search.created_at).toLocaleString()}

**Abstract:**
${search.abstract}

---

# Similar Papers (${papers.length} found)

${papersText}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error fetching results: ${error instanceof Error ? error.message : "Unknown error"}`,
                },
            ],
        };
    }
});
// Tool: Search and get results in one call
server.tool("reef_search", "Create a new search AND immediately retrieve results in one call. This is a convenience tool that combines reef_search_new and reef_get_results. Costs 1 credit.", {
    abstract: z.string().describe("The research paper abstract or description to search for similar papers"),
    userId: z.string().optional().describe("Your Reef API user ID. If not provided, uses REEF_USER_ID environment variable"),
}, async ({ abstract, userId }) => {
    const effectiveUserId = userId || REEF_USER_ID;
    if (!effectiveUserId) {
        return {
            content: [
                {
                    type: "text",
                    text: "Error: No user ID provided. Either pass userId parameter or set REEF_USER_ID environment variable.",
                },
            ],
        };
    }
    try {
        // First create the search
        const createResult = await createSearch(effectiveUserId, abstract);
        if ("error" in createResult) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error creating search: ${createResult.error}`,
                    },
                ],
            };
        }
        // Then get the results
        const searchResult = await getSearchResults(effectiveUserId, createResult.searchId);
        if ("error" in searchResult) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Search created (ID: ${createResult.searchId}) but error fetching results: ${searchResult.error}`,
                    },
                ],
            };
        }
        const { search, papers } = searchResult;
        const papersText = papers.length > 0
            ? papers.map((paper, i) => formatPaper(paper, i)).join("\n\n---\n\n")
            : "No similar papers found.";
        return {
            content: [
                {
                    type: "text",
                    text: `# Search Results

**Search ID:** ${createResult.searchId}

## Your Query
- **Generated Title:** ${search.title}
- **Created:** ${new Date(search.created_at).toLocaleString()}

**Abstract:**
${search.abstract}

---

# Similar Papers (${papers.length} found)

${papersText}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                },
            ],
        };
    }
});
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Reef AI MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
