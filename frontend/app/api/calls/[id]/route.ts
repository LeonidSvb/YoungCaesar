/**
 * CALL DETAILS ENDPOINT
 *
 * GET /api/calls/[id]
 *
 * Returns detailed information about a single call including:
 * - Call metadata
 * - Transcript
 * - Recording URL
 * - QCI analysis (if available)
 * - Assistant information
 *
 * Path Parameters:
 * - id: Call ID
 *
 * Response:
 * {
 *   "id": "...",
 *   "started_at": "2025-10-16 02:45:54",
 *   "duration_seconds": 60,
 *   "cost": 0.214,
 *   "transcript": "...",
 *   "recording_url": "https://...",
 *   "assistant": { "name": "BIESSE - MS" },
 *   "qci": { "total_score": 45, ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: callId } = await params;

    logger.info(`GET /api/calls/${callId}`, { callId });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Use get_call_details SQL function
    const { data, error } = await supabase.rpc('get_call_details', {
      p_call_id: callId
    });

    if (error) {
      logger.error(`Supabase RPC error in /api/calls/${callId}`, error);
      return NextResponse.json(
        { error: 'Call not found', details: error.message },
        { status: 404 }
      );
    }

    if (!data) {
      logger.warn(`Call not found: ${callId}`);
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    const duration = Date.now() - startTime;
    logger.api('GET', `/api/calls/${callId}`, 200, duration);

    return NextResponse.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Call details API error', { error: errorMessage, duration });
    logger.api('GET', '/api/calls/[id]', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch call details',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
