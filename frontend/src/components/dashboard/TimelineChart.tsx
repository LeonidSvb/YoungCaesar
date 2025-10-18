'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TimelineDataPoint {
  date: string;
  total_calls: number;
  quality_calls: number;
  engaged_calls: number;
  analyzed_calls: number;
}

interface TimelineChartProps {
  assistantId: string | null;
  dateFrom: string;
  dateTo: string;
  granularity?: 'day' | 'week' | 'month';
}

export function TimelineChart({
  assistantId,
  dateFrom,
  dateTo,
  granularity = 'day',
}: TimelineChartProps) {
  const [data, setData] = useState<TimelineDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCalls, setShowAllCalls] = useState(true);
  const [showAnalyzed, setShowAnalyzed] = useState(true);
  const [showQuality, setShowQuality] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, [assistantId, dateFrom, dateTo, granularity]);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assistantId && assistantId !== 'all') params.set('assistant_id', assistantId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('granularity', granularity);

      const res = await fetch(`/api/dashboard/chart?${params.toString()}`);
      if (res.ok) {
        const chartData = await res.json();
        setData(chartData);
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Transform data for recharts
  const chartData = data.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    'All Calls': point.total_calls,
    Analyzed: point.analyzed_calls,
    'Quality (>30s)': point.quality_calls,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Call Volume Analytics</CardTitle>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allCalls"
                checked={showAllCalls}
                onCheckedChange={(checked) => setShowAllCalls(checked as boolean)}
              />
              <Label
                htmlFor="allCalls"
                className="flex items-center cursor-pointer font-normal"
              >
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-1.5"></span>
                All Calls
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="analyzed"
                checked={showAnalyzed}
                onCheckedChange={(checked) => setShowAnalyzed(checked as boolean)}
              />
              <Label
                htmlFor="analyzed"
                className="flex items-center cursor-pointer font-normal"
              >
                <span className="w-3 h-3 bg-purple-500 rounded-full mr-1.5"></span>
                Analyzed
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="quality"
                checked={showQuality}
                onCheckedChange={(checked) => setShowQuality(checked as boolean)}
              />
              <Label
                htmlFor="quality"
                className="flex items-center cursor-pointer font-normal"
              >
                <span className="w-3 h-3 bg-green-500 rounded-full mr-1.5"></span>
                Quality ({'>'}30s)
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="w-full h-full bg-gray-100 animate-pulse rounded-lg" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No data available for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="line"
              />

              {/* All Calls - Blue */}
              {showAllCalls && (
                <Line
                  type="monotone"
                  dataKey="All Calls"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}

              {/* Analyzed - Purple */}
              {showAnalyzed && (
                <Line
                  type="monotone"
                  dataKey="Analyzed"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ fill: '#a855f7', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}

              {/* Quality Calls - Green */}
              {showQuality && (
                <Line
                  type="monotone"
                  dataKey="Quality (>30s)"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
