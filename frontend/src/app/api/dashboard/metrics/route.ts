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

    // Build base query for counting
    const buildQuery = (select: string) => {
      let q = supabase.from('calls_enriched').select(select, { count: 'exact' });

      if (assistantId && assistantId !== 'all') {
        q = q.eq('assistant_id', assistantId);
      }
      if (dateFrom) {
        q = q.gte('effective_date', dateFrom);
      }
      if (dateTo) {
        q = q.lte('effective_date', dateTo);
      }

      return q;
    };

    // Get total calls count
    const { count: totalCalls, error: totalError } = await buildQuery('id');

    if (totalError) {
      logger.error('Supabase query error in /api/dashboard/metrics (total)', totalError);
      return NextResponse.json(
        { error: 'Failed to fetch metrics from database', details: totalError.message },
        { status: 500 }
      );
    }

    // Get quality calls count
    const { count: qualityCalls } = await buildQuery('id').eq('is_quality_call', true);

    // Get engaged calls count (duration >= 60s)
    const { count: engagedCalls } = await buildQuery('id').gte('duration_seconds', 60);

    // Get analyzed calls count
    const { count: analyzedCalls } = await buildQuery('id').eq('has_qci', true);

    // Get calls with tools count
    const { count: withTools } = await buildQuery('id').eq('has_calendar_booking', true);

    // Get average duration and QCI - need to fetch actual data but only necessary fields
    // Using range to get more data for accurate averages
    const { data: statsData } = await buildQuery('duration_seconds, qci_score, assistant_id')
      .range(0, 99999);

    const callsWithDuration = statsData?.filter(c => c.duration_seconds > 0) || [];
    const avgDuration = callsWithDuration.length > 0
      ? Math.round(callsWithDuration.reduce((sum, c) => sum + c.duration_seconds, 0) / callsWithDuration.length)
      : 0;

    const callsWithQci = statsData?.filter(c => c.qci_score !== null) || [];
    const avgQCI = callsWithQci.length > 0
      ? Math.round(callsWithQci.reduce((sum, c) => sum + (c.qci_score || 0), 0) / callsWithQci.length * 10) / 10
      : 0;

    const qualityRate = (totalCalls || 0) > 0
      ? Math.round(((qualityCalls || 0) / (totalCalls || 0)) * 1000) / 10
      : 0;

    const uniqueAssistants = new Set(statsData?.map(c => c.assistant_id).filter(Boolean));
    const totalAssistants = uniqueAssistants.size;

    const metrics = {
      totalCalls: totalCalls || 0,
      qualityCalls: qualityCalls || 0,
      engagedCalls: engagedCalls || 0,
      analyzedCalls: analyzedCalls || 0,
      withTools: withTools || 0,
      avgDuration,
      avgQCI,
      qualityRate,
      totalAssistants
    };

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/dashboard/metrics', 200, duration, { totalCalls: metrics.totalCalls });

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
