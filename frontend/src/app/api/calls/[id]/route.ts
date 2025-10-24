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

    // Query calls_enriched view for call details
    const { data: callData, error } = await supabase
      .from('calls_enriched')
      .select('*')
      .eq('id', callId)
      .single();

    if (error) {
      logger.error(`Supabase query error in /api/calls/${callId}`, error);
      return NextResponse.json(
        { error: 'Call not found', details: error.message },
        { status: 404 }
      );
    }

    if (!callData) {
      logger.warn(`Call not found: ${callId}`);
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Format response to match frontend expectations
    const data = {
      id: callData.id,
      started_at: callData.started_at,
      ended_at: callData.ended_at,
      duration_seconds: callData.duration_seconds,
      cost: callData.cost,
      status: callData.status,
      ended_reason: callData.ended_reason,
      transcript: callData.transcript,
      recording_url: callData.recording_url,
      has_transcript: callData.has_transcript,
      has_recording: callData.has_recording,
      has_qci: callData.has_qci,
      assistant: {
        id: callData.assistant_id,
        name: callData.assistant_name
      },
      customer: {
        id: callData.customer_id,
        phone_number: callData.customer_phone_number
      },
      quality: callData.qci_score && callData.qci_score > 70 ? 'excellent' :
               callData.qci_score && callData.qci_score > 50 ? 'good' :
               callData.qci_score ? 'average' : 'poor',
      qci: callData.has_qci ? {
        total_score: callData.qci_score,
        dynamics_score: callData.dynamics_score,
        objections_score: callData.objections_score,
        brand_score: callData.brand_score,
        outcome_score: callData.outcome_score,
        coaching_tips: callData.coaching_tips,
        key_issues: callData.key_issues,
        recommendations: callData.recommendations,
        call_classification: callData.call_classification
      } : null
    };

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
