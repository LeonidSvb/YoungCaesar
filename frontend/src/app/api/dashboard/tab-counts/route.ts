/**
 * TAB COUNTS ENDPOINT
 *
 * GET /api/dashboard/tab-counts
 *
 * Returns counts for each call tab category
 *
 * Query Parameters:
 * - assistant_id: Filter by assistant (optional)
 * - date_from: Start date filter (optional, YYYY-MM-DD)
 * - date_to: End date filter (optional, YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const assistantId = searchParams.get('assistant_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  logger.info('GET /api/dashboard/tab-counts', { assistantId, dateFrom, dateTo });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const buildQuery = (select: string) => {
      let q = supabase.from('calls_enriched').select(select, { count: 'exact' });

      if (assistantId && assistantId !== 'all') {
        q = q.eq('assistant_id', assistantId);
      }
      if (dateFrom) {
        q = q.gte('effective_date', dateFrom);
      }
      if (dateTo) {
        q = q.lte('effective_date', dateTo);
      }

      return q;
    };

    const { count: allCount } = await buildQuery('id');
    const { count: qualityCount } = await buildQuery('id').gte('duration_seconds', 60);
    const { count: shortCount } = await buildQuery('id').gte('duration_seconds', 1).lt('duration_seconds', 60);
    const { count: toolsCount } = await buildQuery('id').eq('has_calendar_booking', true);
    const { count: voicemailCount } = await buildQuery('id').eq('is_voicemail', true);
    const { count: errorsCount } = await buildQuery('id').eq('is_not_started', true);

    const counts = {
      all: allCount || 0,
      quality: qualityCount || 0,
      short: shortCount || 0,
      tools: toolsCount || 0,
      voicemail: voicemailCount || 0,
      errors: errorsCount || 0,
    };

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/dashboard/tab-counts', 200, duration, counts);

    return NextResponse.json(counts);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Tab counts API error', { error: errorMessage, duration });
    logger.api('GET', '/api/dashboard/tab-counts', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch tab counts',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
