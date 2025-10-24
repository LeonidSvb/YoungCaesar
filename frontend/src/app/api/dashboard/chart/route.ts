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

// Calculate smart granularity based on date range
function getSmartGranularity(dateFrom: string, dateTo: string): 'hour' | 'day' | 'week' | 'month' {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 2) return 'hour';
  if (days <= 30) return 'day';
  if (days <= 90) return 'week';
  return 'month';
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('assistant_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    const granularity = dateFrom && dateTo
      ? getSmartGranularity(dateFrom, dateTo)
      : 'day';

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

    const { data: calls, error } = await query.order('effective_date', { ascending: true });

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chart data', details: error.message },
        { status: 500 }
      );
    }

    // Group by date with granularity and calculate metrics
    const groupedData = new Map<string, TimelineDataPoint>();

    calls?.forEach(call => {
      if (!call.effective_date) return;

      const date = new Date(call.effective_date);
      let groupKey: string;

      switch (granularity) {
        case 'hour':
          groupKey = `${date.toISOString().split('T')[0]}T${date.getHours().toString().padStart(2, '0')}:00`;
          break;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          groupKey = weekStart.toISOString().split('T')[0];
          break;
        }
        case 'month':
          groupKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-01`;
          break;
        default:
          groupKey = call.effective_date.split('T')[0];
      }

      if (!groupedData.has(groupKey)) {
        groupedData.set(groupKey, {
          date: groupKey,
          total_calls: 0,
          quality_calls: 0,
          engaged_calls: 0,
          analyzed_calls: 0
        });
      }

      const point = groupedData.get(groupKey)!;
      point.total_calls++;
      if (call.is_quality_call) point.quality_calls++;
      if (call.is_quality_call) point.engaged_calls++;
      if (call.has_qci) point.analyzed_calls++;
    });

    const data = Array.from(groupedData.values()).sort((a, b) => a.date.localeCompare(b.date));

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
