'use client';

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryInspectorProps {
  tab: string;
  assistantId: string | null;
  dateFrom: string;
  dateTo: string;
  count?: number;
}

export function QueryInspector({
  tab,
  assistantId,
  dateFrom,
  dateTo,
  count,
}: QueryInspectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getTabInfo = () => {
    const baseTable = 'calls_enriched';
    const conditions: string[] = [];
    let description = '';

    conditions.push(`effective_date >= '${new Date(dateFrom).toISOString().split('T')[0]}'`);
    conditions.push(`effective_date <= '${new Date(dateTo).toISOString().split('T')[0]}'`);

    if (assistantId) {
      conditions.push(`assistant_id = '${assistantId}'`);
    }

    switch (tab) {
      case 'all':
        description = 'All calls in selected period';
        break;
      case 'quality':
        description = 'Calls with duration >= 60 seconds';
        conditions.push('duration_seconds >= 60');
        break;
      case 'short':
        description = 'Short calls (1-59 seconds)';
        conditions.push('duration_seconds >= 1');
        conditions.push('duration_seconds < 60');
        break;
      case 'tools':
        description = 'Calls with calendar booking';
        conditions.push('has_calendar_booking = true');
        break;
      case 'voicemail':
        description = 'Calls that went to voicemail';
        conditions.push('is_voicemail = true');
        break;
      case 'errors':
        description = 'Calls with errors (not started)';
        conditions.push('is_not_started = true');
        break;
    }

    const sqlQuery = `SELECT *
FROM ${baseTable}
WHERE ${conditions.join('\n  AND ')}
ORDER BY effective_date DESC
LIMIT 50`;

    return { description, sqlQuery, conditions };
  };

  const info = getTabInfo();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-gray-100"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-1">
              Filter Description
            </div>
            <div className="text-sm text-gray-600">{info.description}</div>
          </div>

          {count !== undefined && (
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-1">
                Record Count
              </div>
              <div className="text-sm text-gray-600">
                {count.toLocaleString()} calls
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-gray-900 mb-1">
              SQL Query (Supabase)
            </div>
            <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
              <pre className="whitespace-pre-wrap">{info.sqlQuery}</pre>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-900 mb-1">
              Active Filters
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">
                <span className="font-medium">Period:</span>{' '}
                {new Date(dateFrom).toLocaleDateString()} -{' '}
                {new Date(dateTo).toLocaleDateString()}
              </div>
              {assistantId && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Assistant ID:</span> {assistantId.substring(0, 8)}...
                </div>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
