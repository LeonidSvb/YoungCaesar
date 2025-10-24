/**
 * CALL TYPES CHART DATA ENDPOINT
 *
 * GET /api/dashboard/call-types
 *
 * Returns call distribution by type for Bar Chart
 *
 * Query Parameters:
 * - assistant_id: Filter by assistant (optional)
 * - date_from: Start date filter (optional, YYYY-MM-DD)
 * - date_to: End date filter (optional, YYYY-MM-DD)
 *
 * Response:
 * [
 *   { "type": "Quality Calls", "count": 1234 },
 *   { "type": "Short Calls", "count": 567 },
 *   { "type": "With Tools", "count": 345 },
 *   { "type": "Voicemail", "count": 123 },
 *   { "type": "Errors", "count": 89 }
 * ]
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

    logger.info('GET /api/dashboard/call-types', { assistantId, dateFrom, dateTo });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('calls_enriched')
      .select('is_quality_call, is_short_call, is_voicemail, is_with_tools, is_not_started');

    if (assistantId && assistantId !== 'all') {
      query = query.eq('assistant_id', assistantId);
    }

    if (dateFrom) {
      query = query.gte('effective_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('effective_date', dateTo);
    }

    const { data: calls, error } = await query.range(0, 99999);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch call types data', details: error.message },
        { status: 500 }
      );
    }

    const qualityCount = calls?.filter(c => c.is_quality_call).length || 0;
    const shortCount = calls?.filter(c => c.is_short_call).length || 0;
    const withToolsCount = calls?.filter(c => c.is_with_tools).length || 0;
    const voicemailCount = calls?.filter(c => c.is_voicemail).length || 0;
    const errorsCount = calls?.filter(c => c.is_not_started).length || 0;

    const data = [
      { type: 'Quality Calls', count: qualityCount },
      { type: 'Short Calls', count: shortCount },
      { type: 'With Tools', count: withToolsCount },
      { type: 'Voicemail', count: voicemailCount },
      { type: 'Errors', count: errorsCount }
    ].sort((a, b) => b.count - a.count);

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/dashboard/call-types', 200, duration);

    return NextResponse.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Call types data API error', { error: errorMessage, duration });
    logger.api('GET', '/api/dashboard/call-types', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch call types data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
