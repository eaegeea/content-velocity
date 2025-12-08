import express from 'express';
import dotenv from 'dotenv';
import { analyzeContentVelocity } from './services/velocityAnalyzer';
import { scrapeBlogPosts } from './services/anchorBrowser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Custom body parser to handle both JSON and raw text
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));
app.use(express.urlencoded({ extended: true }));

// Root endpoint with API info
app.get('/', (req, res) => {
  res.json({
    name: 'Content Velocity API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      analyze: 'POST /analyze-velocity'
    },
    usage: {
      method: 'POST',
      url: '/analyze-velocity',
      body: {
        website_url: 'example.com'
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// GET handler for analyze-velocity (returns usage info)
app.get('/analyze-velocity', (req, res) => {
  res.status(405).json({
    error: 'Method Not Allowed',
    message: 'This endpoint requires POST method',
    usage: {
      method: 'POST',
      url: '/analyze-velocity',
      body: {
        website_url: 'example.com'
      },
      example_curl: 'curl -X POST https://your-app.railway.app/analyze-velocity -H "Content-Type: application/json" -d \'{"website_url":"example.com"}\''
    }
  });
});

// Main Clay integration endpoint
app.post('/analyze-velocity', async (req, res) => {
  try {
    // Handle different input formats from Clay
    let website_url: string | undefined;
    
    console.log('Request body type:', typeof req.body);
    console.log('Request body:', req.body);
    console.log('Content-Type:', req.get('content-type'));
    
    // Check if body is a JSON object with website_url property
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && req.body.website_url) {
      website_url = req.body.website_url;
    }
    // Check if body is an object with numeric keys (Clay's weird format)
    else if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && Object.keys(req.body).every(k => !isNaN(Number(k)))) {
      // Convert object like {"0":"s","1":"p",...} back to string
      website_url = Object.values(req.body).join('');
    }
    // Check if body is a plain string (raw body)
    else if (typeof req.body === 'string') {
      website_url = req.body.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
    }
    // Check query parameters as fallback
    else if (req.query.website_url) {
      website_url = req.query.website_url as string;
    }

    if (!website_url) {
      return res.status(400).json({
        error: 'website_url is required (in body, query parameter, or as raw body)',
        received_body: req.body,
        received_type: typeof req.body
      });
    }

    // Extract domain from URL if full URL is provided
    let domain = website_url;
    try {
      const url = new URL(website_url.startsWith('http') ? website_url : `https://${website_url}`);
      domain = url.hostname.replace('www.', '');
    } catch (e) {
      // If URL parsing fails, use as-is
    }

    console.log(`Analyzing content velocity for domain: ${domain}`);
    console.log(`[${new Date().toISOString()}] Starting Anchor Browser scrape...`);

    // Step 1: Scrape blog posts using Anchor Browser API
    const scrapeResult = await scrapeBlogPosts(domain);
    
    console.log(`[${new Date().toISOString()}] Anchor Browser scrape completed. Found ${scrapeResult.posts.length} posts`);

    // Determine if blog was found
    const blogFound = (scrapeResult.posts && scrapeResult.posts.length > 0) || scrapeResult.blogTitle !== null;

    if (!scrapeResult.posts || scrapeResult.posts.length === 0) {
      return res.status(200).json({
        domain,
        blog_found: blogFound,
        blog_title: scrapeResult.blogTitle || null,
        last_30_days_count: 0,
        previous_30_days_count: 0,
        velocity_status: 'No posts found',
        percentage_change: 0
      });
    }

    // Step 2: Calculate velocity metrics
    const velocityMetrics = analyzeContentVelocity(scrapeResult.posts, scrapeResult.blogTitle);

    // Step 3: Return Clay-compatible response
    res.json({
      domain,
      blog_found: true,
      blog_title: velocityMetrics.blogTitle,
      last_30_days_count: velocityMetrics.last30DaysCount,
      previous_30_days_count: velocityMetrics.previous30DaysCount,
      velocity_status: velocityMetrics.velocityStatus,
      percentage_change: velocityMetrics.percentageChange
    });

  } catch (error: any) {
    console.error('Error analyzing content velocity:', error);
    res.status(500).json({
      error: 'Failed to analyze content velocity',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Content Velocity API ready for Clay integration`);
});

