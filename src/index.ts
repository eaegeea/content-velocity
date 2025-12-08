import express from 'express';
import dotenv from 'dotenv';
import { analyzeContentVelocity } from './services/velocityAnalyzer';
import { scrapeBlogPosts } from './services/anchorBrowser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main Clay integration endpoint
app.post('/analyze-velocity', async (req, res) => {
  try {
    const { website_url } = req.body;

    if (!website_url) {
      return res.status(400).json({
        error: 'website_url is required in the request body'
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

    // Step 1: Scrape blog posts using Anchor Browser API
    const scrapeResult = await scrapeBlogPosts(domain);

    if (!scrapeResult.posts || scrapeResult.posts.length === 0) {
      return res.status(200).json({
        domain,
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
});

