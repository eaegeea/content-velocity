import express from 'express';
import dotenv from 'dotenv';
import { analyzeContentVelocity } from './services/velocityAnalyzer';
import { scrapeBlogPosts } from './services/anchorBrowser';
import { createJob, getJob, updateJob, completeJob, failJob } from './services/jobQueue';
import { classifyBlogTitles } from './services/aeoClassifier';

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

// Process job in background
async function processJob(jobId: string, domain: string) {
  updateJob(jobId, { status: 'processing' });
  
  try {
    console.log(`[${jobId}] Starting Anchor Browser scrape for ${domain}...`);
    const scrapeResult = await scrapeBlogPosts(domain);
    console.log(`[${jobId}] Scrape completed. Found ${scrapeResult.posts.length} posts`);

    const blogFound = (scrapeResult.posts && scrapeResult.posts.length > 0) || scrapeResult.blogTitle !== null;

    if (!scrapeResult.posts || scrapeResult.posts.length === 0) {
      completeJob(jobId, {
        domain,
        blog_found: blogFound,
        blog_title: scrapeResult.blogTitle || null,
        last_30_days_count: 0,
        previous_30_days_count: 0,
        velocity_status: 'No posts found',
        percentage_change: 0
      });
      return;
    }

    const velocityMetrics = analyzeContentVelocity(scrapeResult.posts, scrapeResult.blogTitle);

    // Classify blog titles for AEO optimization
    let aeoClassification;
    try {
      console.log(`[${jobId}] Starting AEO classification...`);
      const titles = scrapeResult.posts.map(post => post.title);
      aeoClassification = await classifyBlogTitles(domain, titles);
      console.log(`[${jobId}] AEO classification complete: ${aeoClassification.aeo_optimized_count}/${aeoClassification.total_titles} optimized`);
    } catch (aeoError: any) {
      console.error(`[${jobId}] AEO classification failed:`, aeoError.message);
      // Fallback: return empty AEO data
      aeoClassification = {
        total_titles: scrapeResult.posts.length,
        aeo_optimized_count: 0,
        non_aeo_count: 0,
        aeo_percentage: 0,
        non_aeo_percentage: 0,
        aeo_optimized_titles: [],
        non_aeo_titles: []
      };
      console.log(`[${jobId}] Continuing without AEO classification`);
    }

    completeJob(jobId, {
      // Basic Info
      domain,
      blog_found: true,
      blog_title: velocityMetrics.blogTitle,
      total_posts_analyzed: aeoClassification.total_titles,
      
      // 30-Day Velocity Metrics
      posts_last_30_days: velocityMetrics.last30DaysCount,
      posts_previous_30_days: velocityMetrics.previous30DaysCount,
      velocity_trend_30_days: velocityMetrics.velocityStatus,
      percentage_change_30_days: `${velocityMetrics.percentageChange}%`,
      
      // 14-Day Velocity Metrics
      posts_last_14_days: velocityMetrics.last14DaysCount,
      posts_previous_14_days: velocityMetrics.previous14DaysCount,
      velocity_trend_14_days: velocityMetrics.velocityStatus14Days,
      percentage_change_14_days: `${velocityMetrics.percentageChange14Days}%`,
      
      // AEO Optimization Metrics
      aeo_optimized_count: aeoClassification.aeo_optimized_count,
      aeo_optimized_percentage: `${aeoClassification.aeo_percentage}%`,
      non_aeo_count: aeoClassification.non_aeo_count,
      non_aeo_percentage: `${aeoClassification.non_aeo_percentage}%`,
      
      // AEO Optimized Titles (detailed breakdown)
      aeo_optimized_titles: aeoClassification.aeo_optimized_titles,
      
      // Non-AEO Titles (detailed breakdown)
      non_aeo_titles: aeoClassification.non_aeo_titles
    });
  } catch (error: any) {
    console.error(`[${jobId}] Error:`, error);
    failJob(jobId, error.message);
  }
}

// Main Clay integration endpoint - Async version
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
      domain = url.hostname; // Keep www. if present - some sites need it
    } catch (e) {
      // If URL parsing fails, use as-is
    }

    console.log(`Creating job for domain: ${domain}`);
    console.log(`Original input: ${website_url}`);

    // Create job and start processing in background
    const jobId = createJob(domain);
    
    // Start processing asynchronously (don't await)
    processJob(jobId, domain).catch(err => {
      console.error(`[${jobId}] Unhandled error:`, err);
    });

    // Return immediately with job ID
    res.json({
      jobId,
      domain,
      status: 'pending',
      message: 'Job created. Use GET /analyze-velocity/{jobId} to check status.',
      statusUrl: `/analyze-velocity/${jobId}`
    });

  } catch (error: any) {
    console.error('Error analyzing content velocity:', error);
    res.status(500).json({
      error: 'Failed to analyze content velocity',
      message: error.message
    });
  }
});

// Get job status and results
app.get('/analyze-velocity/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  const job = getJob(jobId);
  
  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      message: `No job found with ID: ${jobId}`
    });
  }
  
  if (job.status === 'completed') {
    return res.json({
      status: 'completed',
      result: job.result
    });
  }
  
  if (job.status === 'failed') {
    return res.status(500).json({
      status: 'failed',
      error: job.error
    });
  }
  
  // Job still processing or pending
  res.json({
    status: job.status,
    message: job.status === 'processing' 
      ? 'Job is currently processing. Check back in 30-60 seconds.' 
      : 'Job is queued and will start soon.',
    jobId: job.id,
    domain: job.domain,
    createdAt: job.createdAt
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Content Velocity API ready for Clay integration`);
});

// Set timeout to 20 minutes for long-running Anchor Browser tasks (clicking into posts takes time)
server.timeout = 1200000; // 20 minutes
server.keepAliveTimeout = 1210000; // Slightly longer than timeout
server.headersTimeout = 1220000; // Slightly longer than keepAliveTimeout

