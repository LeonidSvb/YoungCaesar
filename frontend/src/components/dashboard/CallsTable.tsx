'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';

interface Call {
  id: string;
  started_at: string;
  duration_seconds: number;
  assistant_name: string;
  customer_number: string;
  qci_score: number | null;
  has_transcript: boolean;
  has_qci: boolean;
  status: string;
  quality: 'excellent' | 'good' | 'average' | 'poor';
  cost: number;
}

export function CallsTable() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadCalls();
  }, [filter]);

  const loadCalls = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.rpc('get_calls_list', {
      p_assistant_id: null,
      p_date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      p_date_to: new Date().toISOString(),
      p_quality_filter: filter,
      p_limit: 50,
      p_offset: 0,
    });

    if (!error && data) {
      setCalls(data);
    }
    setLoading(false);
  };

  const getQualityBadgeColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'bg-blue-100 text-blue-800';
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'average':
        return 'bg-yellow-100 text-yellow-800';
      case 'poor':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Calls</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Last 7 days - {calls.length} calls shown
            </p>
          </div>

          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter calls" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Calls</SelectItem>
              <SelectItem value="quality">Quality Only ({'>'}30s)</SelectItem>
              <SelectItem value="excellent">Excellent Only</SelectItem>
              <SelectItem value="with_qci">With QCI Analysis</SelectItem>
              <SelectItem value="with_transcript">With Transcript</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No calls found for selected filter</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Time</th>
                  <th className="text-left p-3 font-medium text-gray-600">Duration</th>
                  <th className="text-left p-3 font-medium text-gray-600">Assistant</th>
                  <th className="text-left p-3 font-medium text-gray-600">Phone</th>
                  <th className="text-left p-3 font-medium text-gray-600">QCI</th>
                  <th className="text-left p-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 text-gray-900">
                      {new Date(call.started_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3 text-gray-900">{call.duration_seconds}s</td>
                    <td className="p-3 text-gray-900">{call.assistant_name || 'Unknown'}</td>
                    <td className="p-3 font-mono text-xs text-gray-600">
                      {call.customer_number || 'N/A'}
                    </td>
                    <td className="p-3">
                      {call.qci_score ? (
                        <span className="font-medium">{call.qci_score.toFixed(0)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Badge className={getQualityBadgeColor(call.quality)}>
                          {call.quality}
                        </Badge>
                        {call.has_qci && (
                          <Badge variant="outline" className="text-xs">
                            QCI
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
