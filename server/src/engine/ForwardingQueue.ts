import { Queue, Worker, Job } from 'bullmq';
import { getRedisConnection, isRedisConnected } from '../config/redis.js';
import { logger } from '../config/logger.js';

export interface ForwardingJobData {
  forwardingJobId: string;
}

type JobProcessor = (data: ForwardingJobData) => Promise<void>;

export class ForwardingQueueManager {
  private queue: Queue<ForwardingJobData> | null = null;
  private worker: Worker<ForwardingJobData> | null = null;
  private memoryQueue: ForwardingJobData[] = [];
  private isProcessingMemory = false;
  private processor: JobProcessor | null = null;

  constructor() {
    this.initBullMQ();
  }

  private initBullMQ(): void {
    try {
      const redis = getRedisConnection();
      this.queue = new Queue<ForwardingJobData>('whatsapp-forwarding-queue', {
        connection: redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      });

      logger.info('Initialized BullMQ forwarding queue with Redis');
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to initialize BullMQ queue, falling back to in-memory mode');
    }
  }

  public registerProcessor(processor: JobProcessor): void {
    this.processor = processor;

    try {
      const redis = getRedisConnection();
      this.worker = new Worker<ForwardingJobData>(
        'whatsapp-forwarding-queue',
        async (job: Job<ForwardingJobData>) => {
          logger.info({ jobId: job.id, forwardingJobId: job.data.forwardingJobId }, 'Processing queue job');
          await processor(job.data);
        },
        {
          connection: redis,
          concurrency: 5,
        }
      );

      this.worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err: err.message }, 'Queue job failed');
      });

      this.worker.on('completed', (job) => {
        logger.info({ jobId: job?.id }, 'Queue job completed');
      });
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Worker could not bind to Redis, processing via memory dispatcher');
    }
  }

  public async addJob(data: ForwardingJobData): Promise<void> {
    if (this.queue && isRedisConnected()) {
      try {
        await this.queue.add('forward-message', data, {
          jobId: `job_${data.forwardingJobId}`,
        });
        return;
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Error enqueuing to BullMQ, falling back to memory queue');
      }
    }

    // In-Memory Fallback
    this.memoryQueue.push(data);
    this.processMemoryQueue();
  }

  private async processMemoryQueue(): Promise<void> {
    if (this.isProcessingMemory || !this.processor || this.memoryQueue.length === 0) return;
    this.isProcessingMemory = true;

    while (this.memoryQueue.length > 0) {
      const jobData = this.memoryQueue.shift();
      if (jobData && this.processor) {
        try {
          await this.processor(jobData);
        } catch (err: any) {
          logger.error({ forwardingJobId: jobData.forwardingJobId, err: err.message }, 'In-memory job processing failed');
        }
      }
    }

    this.isProcessingMemory = false;
  }

  public async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

export const forwardingQueue = new ForwardingQueueManager();
