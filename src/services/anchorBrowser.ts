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

      const prompt = `Scrape 60 UNIQUE blog posts from ${domain}

CRITICAL: Scroll down and navigate pages to find ALL posts!

Step 1: Find blog at ${domain}

Step 2: Extract posts from PAGE 1
- SCROLL DOWN to see all posts
- Try to find dates on the listing page (look for dates near titles)
- If dates are NOT visible on listing:
  * Click into FIRST post → extract date from article → go BACK
  * Click into SECOND post → extract date → go BACK
  * Continue for all posts on page 1
- Extract all titles + dates (format: YYYY-MM-DD)

Step 3: Navigate to PAGE 2
- SCROLL to bottom of page
- Look for "Next", "2", "Older Posts", "Load More", or "→"
- CLICK the pagination control
- WAIT 2-3 seconds for content to update (URL may NOT change - that's OK!)
- Check if post titles changed - if yes, extract them
- If posts changed but URL stayed same, pagination is working (continue!)

Step 4: Repeat for pages 3, 4, 5...
- Keep scrolling to bottom and clicking Next
- For each new page, extract titles + dates (click into posts if dates not visible)
- Continue until you have 60 unique posts OR no more pages

IMPORTANT CHECKS:
✓ Scroll down on each page - don't just grab top visible posts
✓ If dates NOT on listing page, click into each post to get the date
✓ Each page should have DIFFERENT posts (not duplicates)
✓ Trust UI pagination buttons even if URL doesn't change
✓ Verify content changed after clicking (different post titles = success!)
✓ If infinite scroll: keep scrolling until 60 posts loaded

Return: {"blogTitle": "...", "posts": [{"title": "...", "publishDate": "2025-12-09"}]}`;

      const targetUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      console.log(`Starting Anchor Browser scrape for ${domain}...`);
      console.log(`Target URL: ${targetUrl}`);
      const startTime = Date.now();
  
      const response = await axios.post<AnchorBrowserResponse>(
        'https://api.anchorbrowser.io/v1/tools/perform-web-task',
        {
          prompt,
          url: targetUrl,
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
                      type: 'string'
                    },
                    publishDate: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'anchor-api-key': apiKey
          },
          timeout: 900000, // 15 minutes timeout for Anchor Browser API (clicking into posts takes time)
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
        const errorDetails = typeof response.data === 'object' 
          ? JSON.stringify(response.data, null, 2).substring(0, 500)
          : String(response.data).substring(0, 500);
        console.error(errorMsg);
        console.error('Error details:', errorDetails);
        lastError = new Error(`${errorMsg}: ${errorDetails}`);
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

      // Deduplicate posts (remove duplicates based on title and date)
      const uniquePosts = posts.filter((post, index, self) => 
        index === self.findIndex((p) => 
          p.title === post.title && p.publishDate === post.publishDate
        )
      );
      
      console.log(`Deduplicated: ${posts.length} posts → ${uniquePosts.length} unique posts`);

      // Success! Return the result
      return { blogTitle, posts: uniquePosts };

    } catch (error: any) {
      // Handle errors during this attempt
      if (error.response) {
        const status = error.response.status;
        if (status >= 500) {
          // Server error - will retry
          const errorData = typeof error.response.data === 'object'
            ? JSON.stringify(error.response.data, null, 2)
            : String(error.response.data);
          console.error(`Anchor Browser server error (${status}) on attempt ${attempt + 1}/${MAX_RETRIES}`);
          console.error('Server error details:', errorData.substring(0, 500));
          lastError = new Error(`Anchor Browser server error: ${status}. ${errorData.substring(0, 200)}`);
          continue; // Retry
        } else {
          // Client error - don't retry
          console.error('Anchor Browser API client error:', JSON.stringify(error.response.data, null, 2));
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