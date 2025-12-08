interface BlogPost {
  title: string;
  publishDate: string;
}

interface VelocityMetrics {
  blogTitle: string | null;
  last30DaysCount: number;
  previous30DaysCount: number;
  velocityStatus: 'Velocity up' | 'Velocity down' | 'No change';
  percentageChange: number;
}

/**
 * Analyzes content velocity by comparing last 30 days vs previous 30 days
 */
export function analyzeContentVelocity(posts: BlogPost[], blogTitle: string | null = null): VelocityMetrics {
  const now = new Date();
  const last30DaysStart = new Date(now);
  last30DaysStart.setDate(now.getDate() - 30);
  
  const previous30DaysStart = new Date(now);
  previous30DaysStart.setDate(now.getDate() - 60);
  previous30DaysStart.setHours(0, 0, 0, 0);

  let last30DaysCount = 0;
  let previous30DaysCount = 0;

  // Process each post
  for (const post of posts) {
    if (!post.publishDate) continue;

    // Parse the publish date
    let publishDate: Date;
    try {
      // Try ISO format first
      publishDate = new Date(post.publishDate);
      
      // If invalid, try other common formats
      if (isNaN(publishDate.getTime())) {
        // Try YYYY-MM-DD format
        const dateParts = post.publishDate.split('-');
        if (dateParts.length === 3) {
          publishDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
          );
        } else {
          continue; // Skip if we can't parse the date
        }
      }
    } catch (e) {
      console.warn(`Could not parse date: ${post.publishDate}`);
      continue;
    }

    // Normalize dates to start of day for comparison
    publishDate.setHours(0, 0, 0, 0);

    // Count posts in last 30 days
    if (publishDate >= last30DaysStart && publishDate <= now) {
      last30DaysCount++;
    }
    // Count posts in previous 30 days (31-60 days ago)
    else if (publishDate >= previous30DaysStart && publishDate < last30DaysStart) {
      previous30DaysCount++;
    }
  }

  // Calculate percentage change
  let percentageChange = 0;
  let velocityStatus: 'Velocity up' | 'Velocity down' | 'No change' = 'No change';

  if (previous30DaysCount > 0) {
    percentageChange = ((last30DaysCount - previous30DaysCount) / previous30DaysCount) * 100;
    
    if (percentageChange > 0) {
      velocityStatus = 'Velocity up';
    } else if (percentageChange < 0) {
      velocityStatus = 'Velocity down';
    }
  } else if (last30DaysCount > 0 && previous30DaysCount === 0) {
    // If there were no posts in previous period but there are now
    percentageChange = 100;
    velocityStatus = 'Velocity up';
  } else if (last30DaysCount === 0 && previous30DaysCount > 0) {
    // If there were posts before but none now
    percentageChange = -100;
    velocityStatus = 'Velocity down';
  }

  return {
    blogTitle,
    last30DaysCount,
    previous30DaysCount,
    velocityStatus,
    percentageChange: Math.round(percentageChange * 100) / 100 // Round to 2 decimal places
  };
}

