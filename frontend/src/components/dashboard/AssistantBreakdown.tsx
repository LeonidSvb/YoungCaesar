'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AssistantStats {
  assistant_id: string;
  assistant_name: string;
  total_calls: number;
  quality_calls: number;
  quality_rate: number;
  avg_qci: number;
  avg_duration: number;
}

interface AssistantBreakdownProps {
  assistants: AssistantStats[];
}

export function AssistantBreakdown({ assistants }: AssistantBreakdownProps) {
  if (assistants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assistant Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No assistant data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assistant Performance</CardTitle>
        <p className="text-sm text-gray-600">Click on an assistant to filter dashboard</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assistants.map((assistant) => (
            <div
              key={assistant.assistant_id}
              className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">
                  {assistant.assistant_name}
                </h3>
                <Badge
                  variant={assistant.quality_rate >= 70 ? 'default' : 'secondary'}
                >
                  {assistant.quality_rate.toFixed(0)}%
                </Badge>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Total Calls:</span>
                  <span className="font-medium">{assistant.total_calls}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Avg QCI:</span>
                  <span className="font-medium">{assistant.avg_qci?.toFixed(1) || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Avg Duration:</span>
                  <span className="font-medium">{assistant.avg_duration?.toFixed(0)}s</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
