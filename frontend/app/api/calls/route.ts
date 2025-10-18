/**
 * CALLS LIST ENDPOINT
 *
 * GET /api/calls
 *
 * Returns paginated list of calls with filtering and sorting
 *
 * Query Parameters:
 * - assistant_id: Filter by assistant (optional)
 * - date_from: Start date filter (optional, YYYY-MM-DD)
 * - date_to: End date filter (optional, YYYY-MM-DD)
 * - quality_filter: 'all' | 'quality' | 'excellent' | 'with_qci' | 'with_transcript' (optional)
 * - sort_by: 'date' | 'duration' | 'qci' | 'cost' (optional, frontend handles sorting for now)
 * - sort_order: 'asc' | 'desc' (optional, frontend handles for now)
 * - limit: Number of calls to return (optional, default: 50)
 * - offset: Pagination offset (optional, default: 0)
 *
 * Response:
 * {
 *   "calls": [...],
 *   "total": 8559,
 *   "shown": 50,
 *   "hasMore": true
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
    const qualityFilter = searchParams.get('quality_filter') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: calls, error } = await supabase.rpc('get_calls_list', {
      p_assistant_id: assistantId || null,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
      p_quality_filter: qualityFilter,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch calls list', details: error.message },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase.from('vapi_calls_raw').select('id', { count: 'exact', head: true });

    if (assistantId) {
      countQuery = countQuery.eq('assistant_id', assistantId);
    }
    if (dateFrom) {
      countQuery = countQuery.gte('started_at', dateFrom);
    }
    if (dateTo) {
      countQuery = countQuery.lte('started_at', dateTo);
    }

    const { count: totalCount } = await countQuery;

    return NextResponse.json({
      calls: calls || [],
      total: totalCount || 0,
      shown: calls?.length || 0,
      hasMore: (offset + (calls?.length || 0)) < (totalCount || 0)
    });
  } catch (error) {
    console.error('Calls list API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch calls list',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
