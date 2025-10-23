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
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('assistant_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const qualityFilter = searchParams.get('quality_filter') || 'all';
    const stageFilter = searchParams.get('stage_filter') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    logger.info('GET /api/calls', { assistantId, dateFrom, dateTo, qualityFilter, stageFilter, limit, offset });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fix: Convert 'all' string to null for UUID field
    const { data: calls, error } = await supabase.rpc('get_calls_list', {
      p_assistant_id: (assistantId && assistantId !== 'all') ? assistantId : null,
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

    // Apply stage filter (client-side filtering after RPC)
    let filteredCalls = calls || [];

    if (stageFilter && stageFilter !== 'all') {
      filteredCalls = filteredCalls.filter((call: Record<string, unknown>) => {
        switch (stageFilter) {
          case 'errors':
            // Errors: duration_seconds IS NULL (RPC returns COALESCE for started_at)
            return call.duration_seconds === null;
          case 'no_errors':
            // No errors: duration_seconds IS NOT NULL
            return call.duration_seconds !== null;
          case 'short':
            // Short calls: 1-59 seconds
            return typeof call.duration_seconds === 'number' && call.duration_seconds >= 1 && call.duration_seconds < 60;
          case 'quality':
            // Quality calls: >= 60 seconds
            return typeof call.duration_seconds === 'number' && call.duration_seconds >= 60;
          case 'with_tools':
            // With tools: quality calls with has_qci indicator
            return typeof call.duration_seconds === 'number' && call.duration_seconds >= 60 && call.has_qci;
          default:
            return true;
        }
      });
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

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/calls', 200, duration, { total: totalCount, shown: filteredCalls?.length, offset });

    return NextResponse.json({
      calls: filteredCalls || [],
      total: totalCount || 0,
      shown: filteredCalls?.length || 0,
      hasMore: (offset + (filteredCalls?.length || 0)) < (totalCount || 0)
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Calls list API error', { error: errorMessage, duration });
    logger.api('GET', '/api/calls', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch calls list',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
