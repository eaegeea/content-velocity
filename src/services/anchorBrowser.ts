import axios from 'axios';

interface BlogPost {
  title: string;
  publishDate: string;
}

interface ScrapeResult {
  blogTitle: string | null;
  posts: BlogPost[];
}

interface AnchorBrowserResponse {
  data: {
    result: string;
  };
}

/**
 * Scrapes blog posts from a domain using Anchor Browser API
 */
export async function scrapeBlogPosts(domain: string): Promise<ScrapeResult> {
  const apiKey = process.env.ANCHOR_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANCHOR_API_KEY environment variable is not set');
  }

  const prompt = `Visit ${domain}, find their blog, visit it, scrape the last 60 blog posts published. Output in JSON format with an array of objects, each containing "title" and "publishDate" fields. The publishDate should be in ISO 8601 format (YYYY-MM-DD). If you cannot find a blog or cannot access it, return an empty array.`;

  try {
    const response = await axios.post<AnchorBrowserResponse>(
      'https://api.anchorbrowser.io/v1/tools/perform-web-task',
      {
        prompt,
        url: domain.startsWith('http') ? domain : `https://${domain}`,
        agent: 'browser-use',
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        detect_elements: true,
        human_intervention: false,
        max_steps: 200,
        highlight_elements: false,
        output_schema: {
          type: 'object',
          properties: {
            blogTitle: {
              type: 'string',
              description: 'The title of the blog'
            },
            posts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'The title of the blog post'
                  },
                  publishDate: {
                    type: 'string',
                    description: 'The publish date in ISO 8601 format (YYYY-MM-DD)'
                  }
                },
                required: ['title', 'publishDate']
              }
            }
          },
          required: ['blogTitle', 'posts']
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'anchor-api-key': apiKey
        },
        timeout: 300000 // 5 minutes timeout for long-running tasks
      }
    );

    const result = response.data.data.result;
    
    // Try to parse the JSON result
    let parsedResult: any;
    try {
      // The result might be a JSON string, try to parse it
      parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
    } catch (e) {
      // If parsing fails, try to extract JSON from the string
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        console.warn('Could not parse result as JSON:', result);
        return { blogTitle: null, posts: [] };
      }
    }

    // Extract blog title and posts from the parsed result
    let blogTitle: string | null = null;
    let posts: BlogPost[] = [];

    if (parsedResult.blogTitle) {
      blogTitle = parsedResult.blogTitle;
    }

    if (parsedResult.posts && Array.isArray(parsedResult.posts)) {
      posts = parsedResult.posts.map((post: any) => ({
        title: post.title || '',
        publishDate: post.publishDate || post.publish_date || ''
      }));
    } else if (Array.isArray(parsedResult)) {
      // Fallback: try to find posts array in different formats
      posts = parsedResult.map((post: any) => ({
        title: post.title || '',
        publishDate: post.publishDate || post.publish_date || ''
      }));
    }

    return { blogTitle, posts };

  } catch (error: any) {
    if (error.response) {
      console.error('Anchor Browser API error:', error.response.data);
      throw new Error(`Anchor Browser API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('No response from Anchor Browser API:', error.message);
      throw new Error(`Failed to connect to Anchor Browser API: ${error.message}`);
    } else {
      console.error('Error setting up request:', error.message);
      throw error;
    }
  }
}

