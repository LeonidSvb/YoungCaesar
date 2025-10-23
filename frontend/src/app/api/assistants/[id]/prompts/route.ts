/**
 * PROMPT VERSIONS COMPARISON ENDPOINT
 *
 * GET /api/assistants/[id]/prompts
 *
 * Returns all prompt versions for an assistant with performance metrics
 *
 * Query Parameters:
 * - include_content: Include full prompt text (optional, default: false)
 *
 * Response:
 * {
 *   "assistant_id": "...",
 *   "assistant_name": "BIESSE - MS",
 *   "versions": [
 *     {
 *       "version_number": 2,
 *       "changed_at": "2025-10-16T10:00:00.000Z",
 *       "prompt": "...", // if include_content=true
 *       "metrics": {
 *         "total_calls": 156,
 *         "quality_calls": 42,
 *         "quality_rate": 26.9,
 *         "avg_qci": 35.2,
 *         "avg_duration": 78,
 *         "avg_cost": 0.18
 *       }
 *     },
 *     {
 *       "version_number": 1,
 *       "changed_at": "2025-10-10T08:30:00.000Z",
 *       "metrics": {
 *         "total_calls": 243,
 *         "quality_calls": 31,
 *         "quality_rate": 12.8,
 *         "avg_qci": 28.1,
 *         "avg_duration": 65,
 *         "avg_cost": 0.15
 *       }
 *     }
 *   ],
 *   "comparison": {
 *     "latest_vs_previous": {
 *       "quality_rate_change": "+14.1%",
 *       "avg_qci_change": "+7.1",
 *       "improvement": true
 *     }
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

interface PromptVersion {
  version_number: number;
  changed_at: string;
  prompt?: string;
  metrics: {
    total_calls: number;
    quality_calls: number;
    quality_rate: number;
    avg_qci: number | null;
    avg_duration: number | null;
    avg_cost: number | null;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: assistantId } = await params;
    const { searchParams } = new URL(request.url);
    const includeContent = searchParams.get('include_content') === 'true';

    logger.info(`GET /api/assistants/${assistantId}/prompts`, { assistantId, includeContent });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: assistant, error: assistantError } = await supabase
      .from('vapi_assistants')
      .select('name')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      logger.warn(`Assistant not found: ${assistantId}`);
      return NextResponse.json(
        { error: 'Assistant not found' },
        { status: 404 }
      );
    }

    const selectFields = includeContent
      ? 'version_number, changed_at, prompt'
      : 'version_number, changed_at';

    const { data: promptVersions, error: versionsError } = await supabase
      .from('vapi_assistant_prompt_history')
      .select(selectFields)
      .eq('assistant_id', assistantId)
      .order('version_number', { ascending: false });

    if (versionsError) {
      logger.error('Failed to fetch prompt versions', versionsError);
      return NextResponse.json(
        { error: 'Failed to fetch prompt versions' },
        { status: 500 }
      );
    }

    const versions: PromptVersion[] = [];
    const typedVersions = promptVersions as unknown as Array<{ version_number: number; changed_at: string; prompt?: string }>;

    for (const version of typedVersions || []) {
      const nextVersionDate = typedVersions?.find(v => v.version_number === version.version_number + 1)?.changed_at;

      let query = supabase
        .from('vapi_calls_raw')
        .select('duration_seconds, cost')
        .eq('assistant_id', assistantId)
        .gte('started_at', version.changed_at);

      if (nextVersionDate) {
        query = query.lt('started_at', nextVersionDate);
      }

      const { data: calls } = await query;

      const qualityCallsData = calls?.filter(c => (c.duration_seconds || 0) >= 60) || [];

      const qciQuery = supabase
        .from('qci_scores')
        .select('total_score')
        .in('call_id', calls?.map(c => (c as Record<string, unknown>).id as string) || []);

      const { data: qciScores } = await qciQuery;

      const totalCalls = calls?.length || 0;
      const qualityCalls = qualityCallsData.length;
      const qualityRate = totalCalls > 0 ? Math.round((qualityCalls / totalCalls) * 1000) / 10 : 0;

      const avgQci = qciScores && qciScores.length > 0
        ? Math.round((qciScores.reduce((sum, s) => sum + (s.total_score || 0), 0) / qciScores.length) * 10) / 10
        : null;

      const avgDuration = calls && calls.length > 0
        ? Math.round(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length)
        : null;

      const avgCost = calls && calls.length > 0
        ? Math.round((calls.reduce((sum, c) => sum + (c.cost || 0), 0) / calls.length) * 1000) / 1000
        : null;

      versions.push({
        version_number: version.version_number,
        changed_at: version.changed_at,
        ...(includeContent && { prompt: version.prompt }),
        metrics: {
          total_calls: totalCalls,
          quality_calls: qualityCalls,
          quality_rate: qualityRate,
          avg_qci: avgQci,
          avg_duration: avgDuration,
          avg_cost: avgCost
        }
      });
    }

    const comparison = versions.length >= 2 ? {
      latest_vs_previous: {
        quality_rate_change: versions[0].metrics.quality_rate - versions[1].metrics.quality_rate,
        avg_qci_change: versions[0].metrics.avg_qci && versions[1].metrics.avg_qci
          ? Math.round((versions[0].metrics.avg_qci - versions[1].metrics.avg_qci) * 10) / 10
          : null,
        improvement: versions[0].metrics.quality_rate > versions[1].metrics.quality_rate &&
                     ((versions[0].metrics.avg_qci || 0) > (versions[1].metrics.avg_qci || 0))
      }
    } : null;

    const duration = Date.now() - startTime;
    logger.api('GET', `/api/assistants/${assistantId}/prompts`, 200, duration, { versionsCount: versions.length });

    return NextResponse.json({
      assistant_id: assistantId,
      assistant_name: assistant.name,
      versions,
      comparison
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Prompt versions API error', { error: errorMessage, duration });
    logger.api('GET', '/api/assistants/[id]/prompts', 500, duration);

    return NextResponse.json(
      {
        error: 'Failed to fetch prompt versions',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
