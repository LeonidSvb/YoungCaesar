class ParallelProcessor {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 20;
        this.maxConcurrent = options.maxConcurrent || 5;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.progressCallback = options.onProgress || (() => {});
        this.errorCallback = options.onError || (() => {});
    }

    async process(items, processFn, options = {}) {
        const {
            onProgress = this.progressCallback,
            onError = this.errorCallback,
            saveProgressEvery = 100
        } = options;

        console.log(`Starting parallel processing: ${items.length} items, ${this.batchSize} batch size, ${this.maxConcurrent} concurrent`);

        const batches = this.createBatches(items);
        const results = [];
        let processed = 0;

        const processBatch = async (batch) => {
            const batchResults = await Promise.all(
                batch.map(async (item) => {
                    try {
                        const result = await this.processWithRetry(item, processFn);
                        processed++;

                        if (processed % 10 === 0 || processed === items.length) {
                            onProgress(processed, items.length);
                        }

                        return result;
                    } catch (error) {
                        onError(error, item);
                        processed++;
                        return null;
                    }
                })
            );

            return batchResults;
        };

        const semaphore = new Semaphore(this.maxConcurrent);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            await semaphore.acquire();

            processBatch(batch)
                .then(batchResults => {
                    results.push(...batchResults);
                    semaphore.release();
                })
                .catch(error => {
                    console.error(`Batch ${i} failed:`, error);
                    semaphore.release();
                });

            if (results.length >= saveProgressEvery && results.length % saveProgressEvery === 0) {
                await this.saveProgress(results, processed, items.length);
            }
        }

        await semaphore.waitForAll();

        console.log(`Parallel processing completed: ${results.filter(r => r !== null).length}/${items.length} successful`);

        return results;
    }

    async processWithRetry(item, processFn) {
        let lastError;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                return await processFn(item);
            } catch (error) {
                lastError = error;

                if (attempt < this.retryAttempts) {
                    const delay = this.calculateRetryDelay(attempt);
                    console.log(`Retry ${attempt}/${this.retryAttempts} for item ${item.id || 'unknown'} after ${delay}ms`);
                    await this.sleep(delay);
                } else {
                    console.error(`Failed after ${this.retryAttempts} attempts:`, error.message);
                }
            }
        }

        throw lastError;
    }

    createBatches(items) {
        const batches = [];
        for (let i = 0; i < items.length; i += this.batchSize) {
            batches.push(items.slice(i, i + this.batchSize));
        }
        return batches;
    }

    calculateRetryDelay(attempt) {
        const baseDelay = this.retryDelay;
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.3 * exponentialDelay;
        return Math.min(exponentialDelay + jitter, 30000);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async saveProgress(results, processed, total) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `qci_progress_${timestamp}_${processed}_of_${total}.json`;

            console.log(`Saving progress: ${processed}/${total} to ${filename}`);

        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    }
}

class Semaphore {
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
        this.current = 0;
        this.queue = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (this.current < this.maxConcurrent) {
                this.current++;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release() {
        this.current--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.current++;
            next();
        }
    }

    async waitForAll() {
        while (this.current > 0 || this.queue.length > 0) {
            await this.sleep(100);
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class BatchProcessor {
    constructor(options = {}) {
        this.processor = new ParallelProcessor(options);
        this.results = [];
        this.stats = {
            processed: 0,
            failed: 0,
            startTime: Date.now()
        };
    }

    async processCalls(calls, analyzeFn, options = {}) {
        const startTime = Date.now();

        console.log(`\n🚀 Starting batch processing of ${calls.length} calls`);
        console.log(`⚙️  Config: ${this.processor.batchSize} batch size, ${this.processor.maxConcurrent} concurrent`);

        const results = await this.processor.process(
            calls,
            async (call) => {
                const result = await analyzeFn(call);
                this.stats.processed++;
                return result;
            },
            {
                onProgress: (processed, total) => {
                    const percent = Math.round((processed / total) * 100);
                    const elapsed = (Date.now() - startTime) / 1000;
                    const rate = processed / elapsed;
                    const eta = Math.round((total - processed) / rate);

                    console.log(`📊 Progress: ${processed}/${total} (${percent}%) | ${rate.toFixed(1)}/s | ETA: ${eta}s`);
                },
                onError: (error, call) => {
                    console.error(`❌ Failed to process call ${call.id}:`, error.message);
                    this.stats.failed++;
                }
            }
        );

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log(`\n✅ Batch processing completed in ${duration.toFixed(1)}s`);
        console.log(`📈 Success: ${this.stats.processed} | Failed: ${this.stats.failed} | Rate: ${(this.stats.processed / duration).toFixed(1)}/s`);

        return {
            results: results.filter(r => r !== null),
            stats: {
                ...this.stats,
                duration,
                successRate: this.stats.processed / (this.stats.processed + this.stats.failed)
            }
        };
    }
}

module.exports = {
    ParallelProcessor,
    BatchProcessor,
    Semaphore
};