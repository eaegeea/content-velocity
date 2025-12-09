import axios from 'axios';

interface BlogTitle {
  title: string;
}

interface ClassificationDetail {
  title: string;
  aeo_optimized: boolean;
  reason: string;
}

interface AEOClassificationResult {
  total_titles: number;
  aeo_optimized_count: number;
  non_aeo_count: number;
  aeo_percentage: number;
  non_aeo_percentage: number;
  details: ClassificationDetail[];
}

const SYSTEM_PROMPT = `You are an AI subsystem that classifies blog post titles as AEO-optimized or not.

AEO = AI Engine Optimization. Titles designed to rank in AI engines (ChatGPT, Perplexity, etc.).

AEO-OPTIMIZED titles match one or more:
1. Directly answers a question ("how", "what", "why", "when", "should", "can", "is X worth it")
2. Solves a task ("how to", "guide", "checklist", "template", "framework", "best", "top X")
3. Targets high-intent queries ("pricing", "alternatives", "vs", "examples", "benchmark")
4. Natural-language phrasing ("explain", "compare", "help me understand")
5. Structured/definitional ("definitions", "playbooks", "step-by-step")

NOT AEO:
- Company updates, announcements
- Fundraising, partnership news
- Product release notes
- Vague thought leadership
- Bland editorial without clear task/query intent

CLASSIFICATION EXAMPLES:

AEO:
- "How to choose the right SOC 2 automation tool"
- "SOC 2 changes in 2025: What companies need to know"
- "Top 10 IAM best practices for scaling teams"
- "Understanding OAuth vs SAML: A simple guide"

NOT AEO:
- "Announcing our Q4 product release"
- "Inside our company offsite"
- "Product Update: v3.2 is now live"
- "Reflecting on leadership in 2025"

For EACH title, classify as AEO or Not AEO with a brief reason.

Return ONLY valid JSON matching this schema:
{
  "details": [
    {
      "title": "original title",
      "aeo_optimized": true or false,
      "reason": "brief specific reason"
    }
  ]
}`;

/**
 * Classifies blog titles as AEO-optimized using x.ai (Grok) API
 */
export async function classifyBlogTitles(
  domain: string,
  titles: string[]
): Promise<AEOClassificationResult> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }

  console.log(`XAI_API_KEY configured: ${apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No'}`);

  if (titles.length === 0) {
    return {
      total_titles: 0,
      aeo_optimized_count: 0,
      non_aeo_count: 0,
      aeo_percentage: 0,
      non_aeo_percentage: 0,
      details: []
    };
  }

  console.log(`Classifying ${titles.length} blog titles for ${domain}...`);
  console.log(`Using x.ai API endpoint: https://api.x.ai/v1/chat/completions`);

  try {
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: `Classify these blog titles:\n\n${JSON.stringify(titles, null, 2)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000
      }
    );

    const result = JSON.parse(response.data.choices[0].message.content);
    const details: ClassificationDetail[] = result.details || [];

    // Calculate aggregates
    const total_titles = titles.length;
    const aeo_optimized_count = details.filter(d => d.aeo_optimized).length;
    const non_aeo_count = total_titles - aeo_optimized_count;
    const aeo_percentage = total_titles > 0 
      ? Math.round((aeo_optimized_count / total_titles) * 1000) / 10 
      : 0;
    const non_aeo_percentage = total_titles > 0 
      ? Math.round((non_aeo_count / total_titles) * 1000) / 10 
      : 0;

    console.log(`AEO Classification complete: ${aeo_optimized_count}/${total_titles} optimized (${aeo_percentage}%)`);

    return {
      total_titles,
      aeo_optimized_count,
      non_aeo_count,
      aeo_percentage,
      non_aeo_percentage,
      details
    };
  } catch (error: any) {
    if (error.response) {
      console.error('x.ai API error:', error.response.status, error.response.data);
      if (error.response.status === 403) {
        throw new Error(`x.ai API authentication failed (403). Please check XAI_API_KEY is set correctly.`);
      }
      throw new Error(`x.ai API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('No response from x.ai API:', error.message);
      throw new Error(`Failed to connect to x.ai API: ${error.message}`);
    } else {
      console.error('Error classifying blog titles:', error.message);
      throw new Error(`Failed to classify blog titles: ${error.message}`);
    }
  }
}

