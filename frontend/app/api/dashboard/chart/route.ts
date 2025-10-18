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

interface TimelineDataPoint {
  date: string;
  total_calls: number;
  quality_calls: number;
  engaged_calls: number;
  analyzed_calls: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('assistant_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const granularity = searchParams.get('granularity') || 'day';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.rpc('get_timeline_data', {
      p_assistant_id: assistantId || null,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
      p_granularity: granularity
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chart data', details: error.message },
        { status: 500 }
      );
    }

    // Return data directly for Recharts
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Chart data API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch chart data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
