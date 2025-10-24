/**
 * CHART DATA ENDPOINT
 *
 * GET /api/dashboard/chart
 *
 * Returns timeline data for multi-line chart
 *
 * Query Parameters:
 * - assistant_id: Filter by assistant (optional)
 * - date_from: Start date filter (optional, YYYY-MM-DD)
 * - date_to: End date filter (optional, YYYY-MM-DD)
 * - granularity: 'hour' | 'day' | 'week' | 'month' (optional, default: 'day')
 *
 * Response:
 * {
 *   "labels": ["2025-10-13", "2025-10-14", ...],
 *   "datasets": [
 *     { "label": "All Calls", "data": [161, 136, ...] },
 *     { "label": "Quality (>30s)", "data": [113, 76, ...] },
 *     { "label": "Analyzed", "data": [0, 0, ...] }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

interface TimelineDataPoint {
  date: string;
  total_calls: number;
  quality_calls: number;
  engaged_calls: number;
  analyzed_calls: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('assistant_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const granularity = searchParams.get('granularity') || 'day';

    logger.info('GET /api/dashboard/chart', { assistantId, dateFrom, dateTo, granularity });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase.from('calls_enriched').select('effective_date, is_quality_call, has_calendar_booking, has_qci');

    if (assistantId && assistantId !== 'all') {
      query = query.eq('assistant_id', assistantId);
    }

    if (dateFrom) {
      query = query.gte('effective_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('effective_date', dateTo);
    }

    const { data: calls, error } = await query
      .order('effective_date', { ascending: true })
      .range(0, 99999);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chart data', details: error.message },
        { status: 500 }
      );
    }

    // Calculate the number of days in range
    const start = dateFrom ? new Date(dateFrom) : new Date();
    const end = dateTo ? new Date(dateTo) : new Date();
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Only fill in all dates if range is reasonable (< 90 days)
    // For longer periods, show only dates with actual data
    const fillAllDates = daysDiff <= 90;

    const allDates = new Map<string, TimelineDataPoint>();

    if (fillAllDates && dateFrom && dateTo) {
      // Generate all dates for short periods (inclusive of both start and end)
      const current = new Date(start);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        allDates.set(dateStr, {
          date: dateStr,
          total_calls: 0,
          quality_calls: 0,
          engaged_calls: 0,
          analyzed_calls: 0
        });
        current.setDate(current.getDate() + 1);
      }
    }

    // Fill in the actual call data
    calls?.forEach(call => {
      const dateStr = call.effective_date?.split('T')[0] || '';
      if (!dateStr) return;

      if (!allDates.has(dateStr)) {
        allDates.set(dateStr, {
          date: dateStr,
          total_calls: 0,
          quality_calls: 0,
          engaged_calls: 0,
          analyzed_calls: 0
        });
      }

      const point = allDates.get(dateStr)!;
      point.total_calls++;
      if (call.is_quality_call) point.quality_calls++;
      if (call.is_quality_call) point.engaged_calls++;
      if (call.has_qci) point.analyzed_calls++;
    });

    const data = Array.from(allDates.values()).sort((a, b) => a.date.localeCompare(b.date));

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/dashboard/chart', 200, duration, { dataPoints: data.length });

    return NextResponse.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Chart data API error', { error: errorMessage, duration });
    logger.api('GET', '/api/dashboard/chart', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch chart data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
