/**
 * DASHBOARD METRICS ENDPOINT (using calls_enriched view)
 *
 * GET /api/dashboard/metrics
 *
 * Returns 6 key dashboard metrics calculated from calls_enriched view
 *
 * Query Parameters:
 * - assistant_id: Filter by assistant (optional)
 * - date_from: Start date filter (optional, YYYY-MM-DD)
 * - date_to: End date filter (optional, YYYY-MM-DD)
 *
 * Example:
 * GET /api/dashboard/metrics?assistant_id=35cd1a47-714b-4436-9a19-34d7f2d00b56&date_from=2025-10-01&date_to=2025-10-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const assistantId = searchParams.get('assistant_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  logger.info('GET /api/dashboard/metrics', { assistantId, dateFrom, dateTo });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase.from('calls_enriched').select('*');

    if (assistantId && assistantId !== 'all') {
      query = query.eq('assistant_id', assistantId);
    }

    if (dateFrom) {
      query = query.gte('effective_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('effective_date', dateTo);
    }

    const { data: calls, error } = await query;

    if (error) {
      logger.error('Supabase query error in /api/dashboard/metrics', error);
      return NextResponse.json(
        { error: 'Failed to fetch metrics from database', details: error.message },
        { status: 500 }
      );
    }

    const totalCalls = calls?.length || 0;
    const qualityCalls = calls?.filter(c => c.is_quality_call).length || 0;
    const engagedCalls = calls?.filter(c => c.duration_seconds >= 60).length || 0;
    const analyzedCalls = calls?.filter(c => c.has_qci).length || 0;
    const withTools = calls?.filter(c => c.has_calendar_booking).length || 0;

    const callsWithDuration = calls?.filter(c => c.duration_seconds > 0) || [];
    const avgDuration = callsWithDuration.length > 0
      ? Math.round(callsWithDuration.reduce((sum, c) => sum + c.duration_seconds, 0) / callsWithDuration.length)
      : 0;

    const callsWithQci = calls?.filter(c => c.qci_score !== null) || [];
    const avgQCI = callsWithQci.length > 0
      ? Math.round(callsWithQci.reduce((sum, c) => sum + (c.qci_score || 0), 0) / callsWithQci.length * 10) / 10
      : 0;

    const qualityRate = totalCalls > 0
      ? Math.round((qualityCalls / totalCalls) * 1000) / 10
      : 0;

    const uniqueAssistants = new Set(calls?.map(c => c.assistant_id).filter(Boolean));
    const totalAssistants = uniqueAssistants.size;

    const metrics = {
      totalCalls,
      qualityCalls,
      engagedCalls,
      analyzedCalls,
      withTools,
      avgDuration,
      avgQCI,
      qualityRate,
      totalAssistants
    };

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/dashboard/metrics', 200, duration, { totalCalls });

    return NextResponse.json(metrics);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Dashboard metrics API error', { error: errorMessage, duration });
    logger.api('GET', '/api/dashboard/metrics', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard metrics',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
