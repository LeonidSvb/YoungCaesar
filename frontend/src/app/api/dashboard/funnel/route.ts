/**
 * SALES FUNNEL ENDPOINT
 *
 * GET /api/dashboard/funnel
 *
 * Returns 6-stage sales funnel data
 *
 * Query Parameters:
 * - assistant_id: Filter by assistant (optional)
 * - date_from: Start date filter (optional, YYYY-MM-DD)
 * - date_to: End date filter (optional, YYYY-MM-DD)
 *
 * Stages:
 * 1. All Calls - всего звонков
 * 2. Errors - звонки с ошибками (started_at = NULL)
 * 3. No Errors - звонки без ошибок
 * 4. Short (1-59s) - короткие звонки
 * 5. Quality (≥60s) - качественные звонки
 * 6. With Tools - звонки где использовались инструменты
 *
 * Response:
 * {
 *   "stages": [
 *     { "name": "All Calls", "count": 8559, "rate": 100 },
 *     { "name": "Errors", "count": 6182, "rate": 72.2 },
 *     { "name": "No Errors", "count": 2377, "rate": 27.8 },
 *     { "name": "Short (1-59s)", "count": 1782, "rate": 20.8 },
 *     { "name": "Quality (≥60s)", "count": 571, "rate": 6.7 },
 *     { "name": "With Tools", "count": 119, "rate": 1.4 }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('assistant_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    logger.info('GET /api/dashboard/funnel', { assistantId, dateFrom, dateTo });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all calls with minimal fields (started_at needed for errors detection)
    // Use count: 'exact' to get total, then fetch in batches if needed
    let query = supabase
      .from('vapi_calls_raw')
      .select('started_at, duration_seconds, raw_json', { count: 'exact' });

    // Filter by assistant
    if (assistantId && assistantId !== 'all') {
      query = query.eq('assistant_id', assistantId);
    }

    // Filter by date - use created_at (always present) for consistency
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Set explicit large limit to avoid default 1000 rows limit
    const { data: calls, error, count: totalCount } = await query.limit(50000);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch funnel data', details: error.message },
        { status: 500 }
      );
    }

    // Calculate funnel stages
    const totalCalls = calls?.length || 0;

    // Log actual vs total count
    if (totalCount && totalCount > totalCalls) {
      logger.warn('Funnel query truncated', {
        returned: totalCalls,
        total: totalCount,
        message: 'Increase limit if needed'
      });
    }

    // Stage 1: Errors (started_at = NULL)
    const errorCalls = calls?.filter(c => !c.started_at).length || 0;

    // Stage 2: No Errors (started_at exists)
    const noErrorCalls = totalCalls - errorCalls;

    // Stage 3: Short calls (1-59s)
    const shortCalls = calls?.filter(c => {
      const duration = c.duration_seconds || 0;
      return c.started_at && duration >= 1 && duration < 60;
    }).length || 0;

    // Stage 4: Quality calls (≥60s)
    const qualityCalls = calls?.filter(c => {
      const duration = c.duration_seconds || 0;
      return c.started_at && duration >= 60;
    }).length || 0;

    // Stage 5: With Tools (any tool called in quality calls)
    const withTools = calls?.filter(c => {
      if (!c.started_at || (c.duration_seconds || 0) < 60) return false;

      try {
        const messages = c.raw_json?.artifact?.messages || [];
        return messages.some((msg: any) => {
          const toolCalls = msg.toolCalls || [];
          return toolCalls.length > 0;
        });
      } catch (e) {
        return false;
      }
    }).length || 0;

    const stages = [
      {
        name: 'All Calls',
        count: totalCalls,
        rate: 100
      },
      {
        name: 'Errors',
        count: errorCalls,
        rate: totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 1000) / 10 : 0
      },
      {
        name: 'No Errors',
        count: noErrorCalls,
        rate: totalCalls > 0 ? Math.round((noErrorCalls / totalCalls) * 1000) / 10 : 0
      },
      {
        name: 'Short (1-59s)',
        count: shortCalls,
        rate: totalCalls > 0 ? Math.round((shortCalls / totalCalls) * 1000) / 10 : 0
      },
      {
        name: 'Quality (≥60s)',
        count: qualityCalls,
        rate: totalCalls > 0 ? Math.round((qualityCalls / totalCalls) * 1000) / 10 : 0
      },
      {
        name: 'With Tools',
        count: withTools,
        rate: totalCalls > 0 ? Math.round((withTools / totalCalls) * 1000) / 10 : 0
      }
    ];

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/dashboard/funnel', 200, duration, { stagesCount: stages.length, totalCalls });

    return NextResponse.json({ stages });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Sales funnel API error', { error: errorMessage, duration });
    logger.api('GET', '/api/dashboard/funnel', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch sales funnel data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
