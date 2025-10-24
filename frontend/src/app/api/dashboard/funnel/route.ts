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

    // Use calls_enriched view with boolean flags
    let query = supabase
      .from('calls_enriched')
      .select('is_not_started, is_short_call, is_quality_call, is_voicemail, has_calendar_booking', { count: 'exact' });

    // Filter by assistant
    if (assistantId && assistantId !== 'all') {
      query = query.eq('assistant_id', assistantId);
    }

    // Filter by date
    if (dateFrom) {
      query = query.gte('effective_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('effective_date', dateTo);
    }

    const { data: calls, error, count: totalCount } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch funnel data', details: error.message },
        { status: 500 }
      );
    }

    // Calculate funnel stages using boolean flags
    const totalCalls = totalCount || 0;
    const errorCalls = calls?.filter(c => c.is_not_started).length || 0;
    const noErrorCalls = totalCalls - errorCalls;
    const shortCalls = calls?.filter(c => c.is_short_call).length || 0;
    const qualityCalls = calls?.filter(c => c.is_quality_call).length || 0;
    const withTools = calls?.filter(c => c.has_calendar_booking).length || 0;

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
