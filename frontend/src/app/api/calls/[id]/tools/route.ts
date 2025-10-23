/**
 * TOOL INVOCATIONS ENDPOINT
 *
 * GET /api/calls/[id]/tools
 *
 * Returns all tool invocations for a call with HTTP response codes
 *
 * Response:
 * {
 *   "call_id": "...",
 *   "tools": [
 *     {
 *       "tool_name": "bookAppointment",
 *       "timestamp": "2025-10-16T14:23:45.000Z",
 *       "http_code": 200,
 *       "success": true,
 *       "response": {...},
 *       "error": null
 *     }
 *   ],
 *   "summary": {
 *     "total_invocations": 3,
 *     "successful": 2,
 *     "failed": 1,
 *     "by_status_code": { "200": 2, "400": 1 }
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

interface ToolInvocation {
  tool_name: string;
  timestamp: string;
  http_code: number | null;
  success: boolean;
  response: Record<string, unknown>;
  error: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: callId } = await params;

    logger.info(`GET /api/calls/${callId}/tools`, { callId });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: call, error } = await supabase
      .from('vapi_calls_raw')
      .select('raw_json, started_at')
      .eq('id', callId)
      .single();

    if (error || !call) {
      logger.warn(`Call not found: ${callId}`);
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    const tools: ToolInvocation[] = [];
    const messages = call.raw_json?.artifact?.messages || [];

    for (const message of messages) {
      if (message.toolCalls && message.toolCalls.length > 0) {
        for (const toolCall of message.toolCalls) {
          const toolName = toolCall.function?.name || 'unknown';
          const timestamp = message.time || call.started_at;

          let httpCode: number | null = null;
          let success = false;
          let response = null;
          let errorMsg: string | null = null;

          if (toolCall.result) {
            response = toolCall.result;

            if (typeof toolCall.result === 'object') {
              httpCode = toolCall.result.statusCode || toolCall.result.status || null;

              if (httpCode) {
                success = httpCode >= 200 && httpCode < 300;
              } else if (toolCall.result.success !== undefined) {
                success = toolCall.result.success;
                httpCode = success ? 200 : 400;
              }

              if (toolCall.result.error) {
                errorMsg = typeof toolCall.result.error === 'string'
                  ? toolCall.result.error
                  : JSON.stringify(toolCall.result.error);
              }
            } else if (typeof toolCall.result === 'string') {
              try {
                const parsed = JSON.parse(toolCall.result);
                httpCode = parsed.statusCode || parsed.status || null;
                success = httpCode ? (httpCode >= 200 && httpCode < 300) : false;
                errorMsg = parsed.error || null;
              } catch {
                success = !toolCall.result.toLowerCase().includes('error');
                httpCode = success ? 200 : 400;
              }
            }
          }

          tools.push({
            tool_name: toolName,
            timestamp,
            http_code: httpCode,
            success,
            response,
            error: errorMsg
          });
        }
      }
    }

    const summary = {
      total_invocations: tools.length,
      successful: tools.filter(t => t.success).length,
      failed: tools.filter(t => !t.success).length,
      by_status_code: tools.reduce((acc, t) => {
        if (t.http_code) {
          acc[t.http_code] = (acc[t.http_code] || 0) + 1;
        }
        return acc;
      }, {} as Record<number, number>)
    };

    const duration = Date.now() - startTime;
    logger.api('GET', `/api/calls/${callId}/tools`, 200, duration, { toolsCount: tools.length });

    return NextResponse.json({
      call_id: callId,
      tools,
      summary
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Tools API error', { error: errorMessage, duration });
    logger.api('GET', '/api/calls/[id]/tools', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch tool invocations',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
