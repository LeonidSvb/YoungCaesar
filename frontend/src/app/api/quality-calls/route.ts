/**
 * QUALITY CALLS ENDPOINT (NEW - using views)
 *
 * GET /api/quality-calls
 *
 * Returns quality calls using the quality_calls view.
 * This is a NEW endpoint that demonstrates views usage.
 *
 * Query Parameters:
 * - assistant_id: Filter by assistant (optional)
 * - date_from: Start date filter (optional, YYYY-MM-DD)
 * - date_to: End date filter (optional, YYYY-MM-DD)
 * - has_tools: Filter by tool usage (optional, true/false)
 * - has_calendar: Filter by calendar booking (optional, true/false)
 * - min_qci: Minimum QCI score (optional, 0-100)
 * - limit: Number of calls to return (optional, default: 50)
 * - offset: Pagination offset (optional, default: 0)
 *
 * Response:
 * {
 *   "calls": [...],
 *   "total": 411,
 *   "shown": 50,
 *   "hasMore": true,
 *   "stats": {
 *     "avgDuration": 120,
 *     "avgQci": 75,
 *     "withTools": 140,
 *     "withCalendar": 85
 *   }
 * }
 *
 * Example Usage:
 * - All quality calls: GET /api/quality-calls
 * - With tools: GET /api/quality-calls?has_tools=true
 * - High QCI: GET /api/quality-calls?min_qci=70
 * - Specific assistant: GET /api/quality-calls?assistant_id=xxx
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
    const hasTools = searchParams.get('has_tools');
    const hasCalendar = searchParams.get('has_calendar');
    const minQci = searchParams.get('min_qci');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    logger.info('GET /api/quality-calls', {
      assistantId,
      dateFrom,
      dateTo,
      hasTools,
      hasCalendar,
      minQci,
      limit,
      offset
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build query using quality_calls VIEW (not RPC!)
    let query = supabase
      .from('quality_calls')  // VIEW with business logic
      .select('*', { count: 'exact' });

    // Apply filters using WHERE (parameters, not business logic)
    if (assistantId && assistantId !== 'all') {
      query = query.eq('assistant_id', assistantId);
    }

    if (dateFrom) {
      query = query.gte('effective_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('effective_date', dateTo);
    }

    if (hasTools === 'true') {
      query = query.eq('has_tool_calls', true);
    }

    if (hasCalendar === 'true') {
      query = query.eq('has_calendar_booking', true);
    }

    if (minQci) {
      query = query.gte('qci_score', parseFloat(minQci));
    }

    // Pagination and sorting
    const { data: calls, error, count: totalCount } = await query
      .order('effective_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch quality calls', details: error.message },
        { status: 500 }
      );
    }

    // Calculate statistics
    const stats = {
      avgDuration: calls && calls.length > 0
        ? Math.round(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length)
        : 0,
      avgQci: calls && calls.length > 0
        ? Math.round(calls.reduce((sum, c) => sum + (c.qci_score || 0), 0) / calls.length * 10) / 10
        : 0,
      withTools: calls?.filter(c => c.has_tool_calls).length || 0,
      withCalendar: calls?.filter(c => c.has_calendar_booking).length || 0
    };

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/quality-calls', 200, duration, {
      total: totalCount,
      shown: calls?.length,
      offset
    });

    return NextResponse.json({
      calls: calls || [],
      total: totalCount || 0,
      shown: calls?.length || 0,
      hasMore: (offset + (calls?.length || 0)) < (totalCount || 0),
      stats
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Quality calls API error', { error: errorMessage, duration });
    logger.api('GET', '/api/quality-calls', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch quality calls',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
