require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

class ExecutionLogger {
    constructor(scriptType, executionMode = 'terminal') {
        this.scriptType = scriptType;
        this.executionMode = executionMode;
        this.executionId = null;
        this.sequenceNumber = 0;
        this.startTime = new Date();

        // Initialize Supabase client
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        this.onLogCallback = null; // For streaming to frontend
    }

    // Set callback for streaming logs to frontend
    setLogCallback(callback) {
        this.onLogCallback = callback;
    }

    // Start new execution
    async startExecution(config = {}, sessionId = null) {
        try {
            const { data, error } = await this.supabase
                .from('execution_logs')
                .insert({
                    script_type: this.scriptType,
                    execution_mode: this.executionMode,
                    status: 'running',
                    config: config,
                    session_id: sessionId,
                    started_at: this.startTime.toISOString()
                })
                .select('id')
                .single();

            if (error) {
                console.error('Failed to create execution log:', error);
                return null;
            }

            this.executionId = data.id;
            await this.log('info', `🚀 Started ${this.scriptType} execution`, { config });

            return this.executionId;
        } catch (error) {
            console.error('ExecutionLogger initialization failed:', error);
            return null;
        }
    }

    // Log message with level
    async log(level, message, details = {}) {
        this.sequenceNumber++;

        const logEntry = {
            level,
            message,
            details,
            timestamp: new Date().toISOString(),
            sequence: this.sequenceNumber
        };

        // Always output to console
        const timestamp = new Date().toLocaleTimeString();
        console.log(`${timestamp}: ${message}`);

        // Send to frontend if callback is set
        if (this.onLogCallback) {
            this.onLogCallback(`${timestamp}: ${message}`);
        }

        // Save to database if execution is initialized
        if (this.executionId) {
            try {
                await this.supabase
                    .from('execution_log_entries')
                    .insert({
                        execution_id: this.executionId,
                        log_level: level,
                        message: message,
                        details: details,
                        sequence_number: this.sequenceNumber
                    });
            } catch (error) {
                console.error('Failed to save log entry:', error);
            }
        }

        return logEntry;
    }

    // Convenience methods for different log levels
    async info(message, details = {}) {
        return this.log('info', message, details);
    }

    async success(message, details = {}) {
        return this.log('success', `✅ ${message}`, details);
    }

    async warning(message, details = {}) {
        return this.log('warn', `⚠️ ${message}`, details);
    }

    async error(message, details = {}) {
        return this.log('error', `❌ ${message}`, details);
    }

    async debug(message, details = {}) {
        return this.log('debug', message, details);
    }

    // Update execution status and results
    async updateExecution(status, results = {}, stats = {}, files = []) {
        if (!this.executionId) return;

        const completedAt = new Date();
        const durationSeconds = Math.round((completedAt - this.startTime) / 1000);

        try {
            await this.supabase
                .from('execution_logs')
                .update({
                    status,
                    results,
                    stats,
                    files_created: files,
                    completed_at: completedAt.toISOString(),
                    duration_seconds: durationSeconds
                })
                .eq('id', this.executionId);

            if (status === 'completed') {
                await this.success(`Execution completed in ${durationSeconds}s`, {
                    results,
                    stats,
                    files: files.length
                });
            }
        } catch (error) {
            console.error('Failed to update execution:', error);
        }
    }

    // Mark execution as failed
    async markFailed(errorMessage, errorDetails = {}) {
        if (!this.executionId) return;

        await this.error(errorMessage, errorDetails);

        try {
            await this.supabase
                .from('execution_logs')
                .update({
                    status: 'failed',
                    error_message: errorMessage,
                    error_details: errorDetails,
                    completed_at: new Date().toISOString(),
                    duration_seconds: Math.round((new Date() - this.startTime) / 1000)
                })
                .eq('id', this.executionId);
        } catch (error) {
            console.error('Failed to mark execution as failed:', error);
        }
    }

    // Get execution history
    async getExecutionHistory(limit = 50) {
        try {
            const { data, error } = await this.supabase
                .from('execution_logs')
                .select('*')
                .eq('script_type', this.scriptType)
                .order('started_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to get execution history:', error);
            return [];
        }
    }

    // Get detailed logs for specific execution
    async getExecutionLogs(executionId) {
        try {
            const { data, error } = await this.supabase
                .from('execution_log_entries')
                .select('*')
                .eq('execution_id', executionId)
                .order('sequence_number', { ascending: true });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to get execution logs:', error);
            return [];
        }
    }
}

module.exports = ExecutionLogger;