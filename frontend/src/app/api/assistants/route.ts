/**
 * ASSISTANTS ENDPOINT
 *
 * GET /api/assistants
 *
 * Returns list of assistants with call statistics, sorted by call volume
 *
 * Query Parameters:
 * - date_from: Start date filter for call counts (optional, YYYY-MM-DD)
 * - date_to: End date filter for call counts (optional, YYYY-MM-DD)
 *
 * Response:
 * [
 *   {
 *     "assistant_id": "...",
 *     "assistant_name": "BIESSE - MS",
 *     "total_calls": 3967,
 *     "quality_calls": 520,
 *     "quality_rate": 13.1,
 *     "avg_qci": 24.5,
 *     "avg_duration": 48
 *   }
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    logger.info('GET /api/assistants', { dateFrom, dateTo });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.rpc('get_assistant_breakdown', {
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null
    });

    if (error) {
      logger.error('Supabase RPC error in /api/assistants', error);
      return NextResponse.json(
        { error: 'Failed to fetch assistants', details: error.message },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/assistants', 200, duration, { assistantsCount: data?.length || 0 });

    // Already sorted by total_calls DESC in the RPC function
    return NextResponse.json(data || []);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Assistants API error', { error: errorMessage, duration });
    logger.api('GET', '/api/assistants', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch assistants',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
