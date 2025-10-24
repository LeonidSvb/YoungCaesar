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

    // Build query using calls_enriched view
    let query = supabase
      .from('calls_enriched')
      .select('id, started_at, duration_seconds, cost, assistant_name, customer_phone_number, qci_score, has_transcript, has_qci, status', { count: 'exact' });

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

    // Apply stage filter using boolean flags (DATABASE SIDE, not client!)
    if (stageFilter && stageFilter !== 'all') {
      switch (stageFilter) {
        case 'errors':
          query = query.eq('is_not_started', true);
          break;
        case 'no_errors':
          query = query.eq('is_not_started', false);
          break;
        case 'short':
          query = query.eq('is_short_call', true);
          break;
        case 'quality':
          query = query.eq('is_quality_call', true);
          break;
        case 'with_tools':
          query = query.eq('has_calendar_booking', true);
          break;
      }
    }

    // Apply quality filter
    if (qualityFilter && qualityFilter !== 'all') {
      switch (qualityFilter) {
        case 'with_transcript':
          query = query.eq('has_transcript', true);
          break;
        case 'with_qci':
          query = query.eq('has_qci', true);
          break;
        case 'quality':
          query = query.eq('is_quality_call', true);
          break;
      }
    }

    // Pagination and sorting
    const { data: calls, error, count: totalCount } = await query
      .order('effective_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch calls list', details: error.message },
        { status: 500 }
      );
    }

    // Format calls for frontend (add quality field and customer_number for compatibility)
    const filteredCalls = calls?.map(call => ({
      ...call,
      customer_number: call.customer_phone_number,
      quality: call.qci_score && call.qci_score > 70 ? 'excellent' :
               call.qci_score && call.qci_score > 50 ? 'good' :
               call.qci_score ? 'average' : 'poor'
    }));

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
