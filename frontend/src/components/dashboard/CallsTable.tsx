'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown } from 'lucide-react';

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
  qualityFilter?: string;
  onCallClick?: (callId: string) => void;
}

type SortOption = 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc' | 'qci-desc' | 'qci-asc' | 'cost-desc' | 'cost-asc';

export function CallsTable({
  assistantId,
  dateFrom,
  dateTo,
  qualityFilter = 'all',
  onCallClick,
}: CallsTableProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadCalls(true);
  }, [assistantId, dateFrom, dateTo, qualityFilter]);

  useEffect(() => {
    applySorting();
  }, [sortBy, allCalls]);

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
      params.set('quality_filter', qualityFilter);
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
    const sorted = [...allCalls];

    switch (sortBy) {
      case 'date-desc':
        sorted.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        break;
      case 'date-asc':
        sorted.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
        break;
      case 'duration-desc':
        sorted.sort((a, b) => b.duration_seconds - a.duration_seconds);
        break;
      case 'duration-asc':
        sorted.sort((a, b) => a.duration_seconds - b.duration_seconds);
        break;
      case 'qci-desc':
        sorted.sort((a, b) => (b.qci_score || 0) - (a.qci_score || 0));
        break;
      case 'qci-asc':
        sorted.sort((a, b) => (a.qci_score || 0) - (b.qci_score || 0));
        break;
      case 'cost-desc':
        sorted.sort((a, b) => b.cost - a.cost);
        break;
      case 'cost-asc':
        sorted.sort((a, b) => a.cost - b.cost);
        break;
    }

    setCalls(sorted);
  };

  const handleLoadMore = () => {
    loadCalls(false);
  };

  const getSortDescription = () => {
    switch (sortBy) {
      case 'date-desc': return 'Sorted by date (newest first)';
      case 'date-asc': return 'Sorted by date (oldest first)';
      case 'duration-desc': return 'Sorted by duration (longest first)';
      case 'duration-asc': return 'Sorted by duration (shortest first)';
      case 'qci-desc': return 'Sorted by QCI score (highest first)';
      case 'qci-asc': return 'Sorted by QCI score (lowest first)';
      case 'cost-desc': return 'Sorted by cost (highest first)';
      case 'cost-asc': return 'Sorted by cost (lowest first)';
      default: return 'Sorted by date (newest first)';
    }
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
              {getSortDescription()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sort by:</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Date (newest first)</SelectItem>
                <SelectItem value="date-asc">Date (oldest first)</SelectItem>
                <SelectItem value="duration-desc">Duration (longest first)</SelectItem>
                <SelectItem value="duration-asc">Duration (shortest first)</SelectItem>
                <SelectItem value="qci-desc">QCI Score (highest first)</SelectItem>
                <SelectItem value="qci-asc">QCI Score (lowest first)</SelectItem>
                <SelectItem value="cost-desc">Cost (highest first)</SelectItem>
                <SelectItem value="cost-asc">Cost (lowest first)</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
