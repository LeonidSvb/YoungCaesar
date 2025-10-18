/**
 * DASHBOARD METRICS ENDPOINT
 *
 * GET /api/dashboard/metrics
 *
 * Returns 6 key dashboard metrics
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('assistant_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.rpc('get_dashboard_metrics', {
      p_assistant_id: assistantId || null,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch metrics from database', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Dashboard metrics API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard metrics',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
