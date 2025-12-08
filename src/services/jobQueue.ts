interface Job {
  id: string;
  domain: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Simple in-memory job storage (use Redis/database in production)
const jobs = new Map<string, Job>();

export function createJob(domain: string): string {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  jobs.set(jobId, {
    id: jobId,
    domain,
    status: 'pending',
    createdAt: new Date()
  });
  
  return jobId;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, updates: Partial<Job>): void {
  const job = jobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
    jobs.set(jobId, job);
  }
}

export function completeJob(jobId: string, result: any): void {
  updateJob(jobId, {
    status: 'completed',
    result,
    completedAt: new Date()
  });
}

export function failJob(jobId: string, error: string): void {
  updateJob(jobId, {
    status: 'failed',
    error,
    completedAt: new Date()
  });
}

// Clean up old jobs after 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [jobId, job] of jobs.entries()) {
    if (job.createdAt.getTime() < oneHourAgo) {
      jobs.delete(jobId);
    }
  }
}, 600000); // Run every 10 minutes

