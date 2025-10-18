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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const callId = params.id;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch call with assistant info
    const { data: call, error: callError } = await supabase
      .from('vapi_calls_raw')
      .select(`
        *,
        assistant:vapi_assistants!vapi_calls_raw_assistant_id_fkey(name)
      `)
      .eq('id', callId)
      .single();

    if (callError) {
      console.error('Supabase query error:', callError);
      return NextResponse.json(
        { error: 'Call not found', details: callError.message },
        { status: 404 }
      );
    }

    // Fetch QCI analysis if exists
    const { data: qci } = await supabase
      .from('qci_analyses')
      .select('*')
      .eq('call_id', callId)
      .single();

    // Build response
    const response = {
      id: call.id,
      started_at: call.started_at,
      ended_at: call.ended_at,
      duration_seconds: call.duration_seconds,
      cost: call.cost,
      status: call.status,
      ended_reason: call.ended_reason,
      customer_phone_number: call.customer_phone_number,
      transcript: call.transcript,
      recording_url: call.recording_url,
      vapi_success_evaluation: call.vapi_success_evaluation,
      assistant: call.assistant,
      qci: qci || null,
      raw_json: call.raw_json
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Call details API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch call details',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
