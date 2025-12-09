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
  last14DaysCount: number;
  previous14DaysCount: number;
  velocityStatus14Days: 'Velocity up' | 'Velocity down' | 'No change';
  percentageChange14Days: number;
}

/**
 * Analyzes content velocity by comparing:
 * - Last 30 days vs previous 30 days
 * - Last 14 days vs previous 14 days
 */
export function analyzeContentVelocity(posts: BlogPost[], blogTitle: string | null = null): VelocityMetrics {
  const now = new Date();
  
  // 30-day periods
  const last30DaysStart = new Date(now);
  last30DaysStart.setDate(now.getDate() - 30);
  
  const previous30DaysStart = new Date(now);
  previous30DaysStart.setDate(now.getDate() - 60);
  previous30DaysStart.setHours(0, 0, 0, 0);

  // 14-day periods
  const last14DaysStart = new Date(now);
  last14DaysStart.setDate(now.getDate() - 14);
  
  const previous14DaysStart = new Date(now);
  previous14DaysStart.setDate(now.getDate() - 28);
  previous14DaysStart.setHours(0, 0, 0, 0);

  let last30DaysCount = 0;
  let previous30DaysCount = 0;
  let last14DaysCount = 0;
  let previous14DaysCount = 0;

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

    // Count posts in last 14 days
    if (publishDate >= last14DaysStart && publishDate <= now) {
      last14DaysCount++;
    }
    // Count posts in previous 14 days (15-28 days ago)
    else if (publishDate >= previous14DaysStart && publishDate < last14DaysStart) {
      previous14DaysCount++;
    }
  }

  // Calculate 30-day percentage change
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
    percentageChange = 100;
    velocityStatus = 'Velocity up';
  } else if (last30DaysCount === 0 && previous30DaysCount > 0) {
    percentageChange = -100;
    velocityStatus = 'Velocity down';
  }

  // Calculate 14-day percentage change
  let percentageChange14Days = 0;
  let velocityStatus14Days: 'Velocity up' | 'Velocity down' | 'No change' = 'No change';

  if (previous14DaysCount > 0) {
    percentageChange14Days = ((last14DaysCount - previous14DaysCount) / previous14DaysCount) * 100;
    
    if (percentageChange14Days > 0) {
      velocityStatus14Days = 'Velocity up';
    } else if (percentageChange14Days < 0) {
      velocityStatus14Days = 'Velocity down';
    }
  } else if (last14DaysCount > 0 && previous14DaysCount === 0) {
    percentageChange14Days = 100;
    velocityStatus14Days = 'Velocity up';
  } else if (last14DaysCount === 0 && previous14DaysCount > 0) {
    percentageChange14Days = -100;
    velocityStatus14Days = 'Velocity down';
  }

  return {
    blogTitle,
    last30DaysCount,
    previous30DaysCount,
    velocityStatus,
    percentageChange: Math.round(percentageChange * 100) / 100,
    last14DaysCount,
    previous14DaysCount,
    velocityStatus14Days,
    percentageChange14Days: Math.round(percentageChange14Days * 100) / 100
  };
}

