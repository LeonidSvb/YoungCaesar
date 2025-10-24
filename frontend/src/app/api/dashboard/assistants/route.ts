/**
 * ASSISTANTS CHART DATA ENDPOINT
 *
 * GET /api/dashboard/assistants
 *
 * Returns call distribution by assistant for Donut Chart
 *
 * Query Parameters:
 * - assistant_id: Filter by assistant (optional)
 * - date_from: Start date filter (optional, YYYY-MM-DD)
 * - date_to: End date filter (optional, YYYY-MM-DD)
 *
 * Response:
 * [
 *   { "name": "BIESSE - MS", "total": 1234, "quality": 890 },
 *   { "name": "QC Advisor", "total": 567, "quality": 234 }
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

    logger.info('GET /api/dashboard/assistants', { assistantId, dateFrom, dateTo });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('calls_enriched')
      .select('assistant_name, is_quality_call');

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
        { error: 'Failed to fetch assistants data', details: error.message },
        { status: 500 }
      );
    }

    // Group by assistant and calculate totals
    const assistantStats = new Map<string, { total: number; quality: number }>();

    calls?.forEach(call => {
      const name = call.assistant_name || 'Unknown';
      if (!assistantStats.has(name)) {
        assistantStats.set(name, { total: 0, quality: 0 });
      }
      const stats = assistantStats.get(name)!;
      stats.total++;
      if (call.is_quality_call) {
        stats.quality++;
      }
    });

    const data = Array.from(assistantStats.entries())
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        quality: stats.quality
      }))
      .sort((a, b) => b.total - a.total);

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/dashboard/assistants', 200, duration, { assistants: data.length });

    return NextResponse.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Assistants data API error', { error: errorMessage, duration });
    logger.api('GET', '/api/dashboard/assistants', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch assistants data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
