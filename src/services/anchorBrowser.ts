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
    result: any; // Can be string or object with nested result
  };
}

/**
 * Helper function to delay execution
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scrapes blog posts from a domain using Anchor Browser API
 * Implements retry logic for transient server errors
 */
export async function scrapeBlogPosts(domain: string): Promise<ScrapeResult> {
  const apiKey = process.env.ANCHOR_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANCHOR_API_KEY environment variable is not set');
  }

  const MAX_RETRIES = 3;
  const BASE_DELAY = 5000; // 5 seconds
  
  let lastError: Error | null = null;

  // Retry loop for handling transient server errors
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = BASE_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms delay...`);
        await delay(delayMs);
      }

      const prompt = `Your task is to scrape the 60 most recent blog posts from: ${domain}

=== STEP 1: LOCATE THE BLOG ===
1. Visit ${domain}
2. Look for navigation links containing: "Blog", "Articles", "News", "Insights", "Resources", "Writing"
3. Check these locations: main nav, header, footer, homepage content
4. Common URL patterns: /blog, /articles, /posts, /news, /insights, /resources
5. If no obvious link, try appending /blog to the domain

=== STEP 2: ACCESS THE BLOG ===
1. Click the blog link or navigate to the blog URL
2. Wait 3-5 seconds for page to fully load (especially for JavaScript-heavy sites)
3. Verify you're on the blog listing page (not an individual post)

=== STEP 3: EXTRACT POSTS ===
For the 60 most recent posts (typically 2-4 pages of pagination):
- Extract the TITLE (full post title, clean text)
- Extract the PUBLISH DATE and convert to YYYY-MM-DD format
- Stop when you reach 60 posts or run out of posts

CRITICAL NAVIGATION RULES:
You MUST use the blog page's UI navigation - DO NOT construct or modify URLs manually.
- PAGINATION: Click on "Next", "Older Posts", page numbers (1, 2, 3...), or "Load More" buttons
- INFINITE SCROLL: Scroll down to the bottom of the page to trigger more posts to load
- Wait 2-3 seconds after each navigation action for new posts to load
- Extract posts from each page before navigating to the next
- Keep navigating through pages until you have 60 posts OR no more pages exist

Date conversion examples:
- "December 9, 2024" → "2024-12-09"
- "9 Dec 2024" → "2024-12-09"
- "12/09/2024" → "2024-12-09"

=== STEP 4: VALIDATE & FORMAT ===
Before returning, ensure:
- All dates are in strict YYYY-MM-DD format
- No empty or whitespace-only titles
- No duplicate posts
- Posts sorted newest to oldest
- No test/placeholder content

=== OUTPUT FORMAT ===
Return this exact JSON structure:
{
  "blogTitle": "The name of the blog section",
  "posts": [
    {"title": "Post Title Here", "publishDate": "2024-12-09"},
    ...
  ]
}

=== ERROR HANDLING ===
- Blog not found: Try direct URLs like ${domain}/blog, ${domain}/articles
- No dates visible: Check URL patterns or <time> tags
- Paywall/login required: Return {"blogTitle": null, "posts": []}
- Fewer than 60 posts exist: Return all available posts
- Site error/404: Return {"blogTitle": null, "posts": []}

Focus on accuracy over speed. Take your time to find the correct blog section and extract clean, validated data.`;

      console.log(`Starting Anchor Browser scrape for ${domain}...`);
      const startTime = Date.now();
  
      const response = await axios.post<AnchorBrowserResponse>(
        'https://api.anchorbrowser.io/v1/tools/perform-web-task',
        {
          prompt,
          url: domain.startsWith('http') ? domain : `https://${domain}`,
          agent: 'browser-use',
          provider: 'gemini',
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
          timeout: 300000, // 5 minutes timeout for Anchor Browser API
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          validateStatus: () => true // Accept all status codes, handle errors manually
        }
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Anchor Browser request completed for ${domain} in ${duration}s (Status: ${response.status})`);
      
      // Check for API errors and handle retries
      if (response.status >= 500) {
        // Server error - retry
        const errorMsg = `Anchor Browser server error (${response.status})`;
        console.error(errorMsg, typeof response.data === 'string' ? response.data.substring(0, 200) : response.data);
        lastError = new Error(errorMsg);
        continue; // Retry
      }
      
      if (response.status >= 400) {
        // Client error - don't retry, throw immediately
        console.error(`Anchor Browser API client error (${response.status}):`, response.data);
        throw new Error(`Anchor Browser API client error: ${response.status}. Please check your request parameters.`);
      }

      let result: any = response.data.data.result;
      console.log(`Result type: ${typeof result}`);
      console.log(`Raw result:`, JSON.stringify(result).substring(0, 500));
      
      // Check if result is double-wrapped (has a nested 'result' property)
      if (result && typeof result === 'object' && 'result' in result) {
        console.log('Detected double-wrapped result, extracting inner result');
        result = (result as any).result;
      }
      
      // Try to parse the JSON result
      let parsedResult: any;
      try {
        // The result might be a JSON string, try to parse it
        if (typeof result === 'string') {
          parsedResult = JSON.parse(result);
        } else if (typeof result === 'object') {
          parsedResult = result;
        } else {
          console.warn('Unexpected result type:', typeof result);
          return { blogTitle: null, posts: [] };
        }
      } catch (e) {
        console.error('JSON parse error:', e);
        // If parsing fails, try to extract JSON from the string
        if (typeof result === 'string') {
          const jsonMatch = result.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsedResult = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              console.error('Failed to parse extracted JSON:', e2);
              return { blogTitle: null, posts: [] };
            }
          } else {
            console.warn('Could not find JSON in result:', result.substring(0, 200));
            return { blogTitle: null, posts: [] };
          }
        } else {
          return { blogTitle: null, posts: [] };
        }
      }
      
      console.log(`Parsed result has blogTitle: ${!!parsedResult.blogTitle}, posts count: ${Array.isArray(parsedResult.posts) ? parsedResult.posts.length : 0}`);

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

      // Success! Return the result
      return { blogTitle, posts };

    } catch (error: any) {
      // Handle errors during this attempt
      if (error.response) {
        const status = error.response.status;
        if (status >= 500) {
          // Server error - will retry
          console.error(`Anchor Browser server error (${status}) on attempt ${attempt + 1}/${MAX_RETRIES}`);
          lastError = new Error(`Anchor Browser server error: ${status}. Their service may be temporarily unavailable.`);
          continue; // Retry
        } else {
          // Client error - don't retry
          console.error('Anchor Browser API client error:', error.response.data);
          throw new Error(`Anchor Browser API client error: ${status}. Please check your request parameters.`);
        }
      } else if (error.request) {
        // Network error - will retry
        console.error(`Network error on attempt ${attempt + 1}/${MAX_RETRIES}:`, error.message);
        lastError = new Error(`Failed to connect to Anchor Browser API: ${error.message}`);
        continue; // Retry
      } else if (error.message && !error.response) {
        // Non-retryable error (like our own validation errors)
        throw error;
      } else {
        // Unknown error - will retry
        console.error(`Unknown error on attempt ${attempt + 1}/${MAX_RETRIES}:`, error.message);
        lastError = error;
        continue; // Retry
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error(`Failed to scrape ${domain} after ${MAX_RETRIES} attempts. Anchor Browser service may be experiencing issues.`);
}