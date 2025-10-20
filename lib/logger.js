const fetch = require('node-fetch');

/**
 * Logger class for cron job execution tracking
 * Writes logs to Supabase runs and logs tables
 *
 * Based on ChatGPT specification with improvements for VAPI project
 */
class Logger {
  constructor(runId, supabaseUrl, supabaseKey) {
    this.runId = runId;
    this.url = supabaseUrl;
    this.key = supabaseKey;
  }

  /**
   * Write log entry to Supabase logs table
   */
  async log(level, step, message, meta = {}) {
    const body = {
      run_id: this.runId,
      level,
      step,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };

    try {
      await fetch(`${this.url}/rest/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(body),
      });

      console.log(`[${level}] ${step}: ${message}`);
    } catch (error) {
      console.error('Failed to write log to Supabase:', error.message);
      console.log(`[${level}] ${step}: ${message}`);
    }
  }

  /**
   * Log info message
   */
  info(step, message, meta = {}) {
    return this.log('INFO', step, message, meta);
  }

  /**
   * Log error message
   */
  error(step, message, meta = {}) {
    return this.log('ERROR', step, message, meta);
  }

  /**
   * Log warning message
   */
  warning(step, message, meta = {}) {
    return this.log('WARNING', step, message, meta);
  }

  /**
   * Log debug message (for development)
   */
  debug(step, message, meta = {}) {
    if (process.env.DEBUG === 'true') {
      return this.log('DEBUG', step, message, meta);
    }
  }
}

/**
 * Helper function to create a new run in Supabase
 */
async function createRun(scriptName, supabaseUrl, supabaseKey, triggeredBy = 'manual') {
  const body = {
    script_name: scriptName,
    status: 'running',
    triggered_by: triggeredBy,
    started_at: new Date().toISOString(),
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  const run = Array.isArray(data) ? data[0] : data;
  return run;
}

/**
 * Helper function to update run status
 */
async function updateRun(runId, updates, supabaseUrl, supabaseKey) {
  await fetch(`${supabaseUrl}/rest/v1/runs?id=eq.${runId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify(updates),
  });
}

module.exports = {
  Logger,
  createRun,
  updateRun,
};
