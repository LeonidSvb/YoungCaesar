'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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

interface CallsTableProps {
  assistantId: string | null;
  dateFrom: string;
  dateTo: string;
  stageFilter?: string;
  onCallClick?: (callId: string) => void;
}

type SortField = 'date' | 'duration' | 'qci' | 'cost';
type SortDirection = 'asc' | 'desc' | null;

export function CallsTable({
  assistantId,
  dateFrom,
  dateTo,
  stageFilter = 'all',
  onCallClick,
}: CallsTableProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadCalls(true);
  }, [assistantId, dateFrom, dateTo, stageFilter]);

  useEffect(() => {
    applySorting();
  }, [sortField, sortDirection, allCalls]);

  const loadCalls = async (reset: boolean = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      if (assistantId && assistantId !== 'all') params.set('assistant_id', assistantId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (stageFilter && stageFilter !== 'all') params.set('stage_filter', stageFilter);
      params.set('limit', '50');
      params.set('offset', reset ? '0' : offset.toString());

      const res = await fetch(`/api/calls?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();

        if (reset) {
          setAllCalls(data.calls || []);
          setOffset(data.shown || 0);
        } else {
          setAllCalls(prev => [...prev, ...(data.calls || [])]);
          setOffset(prev => prev + (data.shown || 0));
        }

        setTotal(data.total || 0);
        setHasMore(data.hasMore || false);
      }
    } catch (error) {
      console.error('Failed to fetch calls:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const applySorting = () => {
    if (!sortDirection) {
      setCalls([...allCalls]);
      return;
    }

    const sorted = [...allCalls];
    const multiplier = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortField) {
        case 'date':
          aVal = new Date(a.started_at).getTime();
          bVal = new Date(b.started_at).getTime();
          break;
        case 'duration':
          aVal = a.duration_seconds;
          bVal = b.duration_seconds;
          break;
        case 'qci':
          aVal = a.qci_score || 0;
          bVal = b.qci_score || 0;
          break;
        case 'cost':
          aVal = a.cost;
          bVal = b.cost;
          break;
        default:
          return 0;
      }

      return (aVal - bVal) * multiplier;
    });

    setCalls(sorted);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortDirection(null);
        setSortField('date');
      } else {
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleLoadMore = () => {
    loadCalls(false);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field || !sortDirection) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-blue-600" />
    ) : (
      <ArrowDown className="w-4 h-4 text-blue-600" />
    );
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
    <Card data-calls-table>
      <CardHeader>
        <CardTitle>Recent Calls</CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Click on column headers to sort
        </p>
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
                  <th
                    className="text-left p-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Time</span>
                      {getSortIcon('date')}
                    </div>
                  </th>
                  <th
                    className="text-left p-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('duration')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Duration</span>
                      {getSortIcon('duration')}
                    </div>
                  </th>
                  <th className="text-left p-3 font-medium text-gray-600">Assistant</th>
                  <th className="text-left p-3 font-medium text-gray-600">Phone</th>
                  <th
                    className="text-left p-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('qci')}
                  >
                    <div className="flex items-center gap-2">
                      <span>QCI</span>
                      {getSortIcon('qci')}
                    </div>
                  </th>
                  <th className="text-left p-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calls.map((call) => (
                  <tr
                    key={call.id}
                    onClick={() => onCallClick?.(call.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 text-gray-900">
                      {new Date(call.started_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
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
                        {call.quality && (
                          <Badge className={getQualityBadgeColor(call.quality)}>
                            {call.quality}
                          </Badge>
                        )}
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

        {/* Pagination Controls */}
        {!loading && calls.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{offset}</span> of{' '}
              <span className="font-medium">{total.toLocaleString()}</span> calls
            </div>
            {hasMore && (
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2"
              >
                <span>{loadingMore ? 'Loading...' : 'Load 50 More'}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
