/**
 * SALES FUNNEL ENDPOINT
 *
 * GET /api/dashboard/funnel
 *
 * Returns 4-stage sales funnel data
 *
 * Query Parameters:
 * - assistant_id: Filter by assistant (optional)
 * - date_from: Start date filter (optional, YYYY-MM-DD)
 * - date_to: End date filter (optional, YYYY-MM-DD)
 *
 * Response:
 * {
 *   "stages": [
 *     { "name": "All Calls", "count": 8559, "rate": 100 },
 *     { "name": "Quality (>30s)", "count": 1156, "rate": 13.5 },
 *     { "name": "Engaged (>60s)", "count": 578, "rate": 6.8 },
 *     { "name": "Meeting Booked", "count": 38, "rate": 0.44 }
 *   ]
 * }
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

    // TODO: Create get_sales_funnel() RPC function in Supabase
    // For now, using direct query
    let query = supabase.from('vapi_calls_raw').select('duration_seconds, vapi_success_evaluation, raw_json');

    if (assistantId) {
      query = query.eq('assistant_id', assistantId);
    }
    if (dateFrom) {
      query = query.gte('started_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('started_at', dateTo);
    }

    const { data: calls, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch funnel data', details: error.message },
        { status: 500 }
      );
    }

    // Calculate funnel stages
    const totalCalls = calls?.length || 0;
    const qualityCalls = calls?.filter(c => (c.duration_seconds || 0) > 30).length || 0;
    const engagedCalls = calls?.filter(c => (c.duration_seconds || 0) > 60).length || 0;
    const meetingBooked = calls?.filter(c =>
      c.vapi_success_evaluation?.toLowerCase().includes('booked') ||
      c.vapi_success_evaluation?.toLowerCase().includes('meeting outcome: yes')
    ).length || 0;

    const stages = [
      {
        name: 'All Calls',
        count: totalCalls,
        rate: 100
      },
      {
        name: 'Quality (>30s)',
        count: qualityCalls,
        rate: totalCalls > 0 ? Math.round((qualityCalls / totalCalls) * 1000) / 10 : 0
      },
      {
        name: 'Engaged (>60s)',
        count: engagedCalls,
        rate: totalCalls > 0 ? Math.round((engagedCalls / totalCalls) * 1000) / 10 : 0
      },
      {
        name: 'Meeting Booked',
        count: meetingBooked,
        rate: totalCalls > 0 ? Math.round((meetingBooked / totalCalls) * 10000) / 100 : 0
      }
    ];

    return NextResponse.json({ stages });
  } catch (error) {
    console.error('Sales funnel API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch sales funnel data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
