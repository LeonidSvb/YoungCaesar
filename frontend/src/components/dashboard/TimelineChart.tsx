'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  excellent_calls: number;
}

interface TimelineChartProps {
  data: TimelineDataPoint[];
}

export function TimelineChart({ data }: TimelineChartProps) {
  // Transform data for recharts
  const chartData = data.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Total Calls': point.total_calls,
    'Quality (>30s)': point.quality_calls,
    'Excellent (>60s + QCI>70)': point.excellent_calls,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Volume Timeline</CardTitle>
        <p className="text-sm text-gray-600">Multi-line view: Total, Quality, and Excellent calls</p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
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

              {/* Total Calls - Gray */}
              <Line
                type="monotone"
                dataKey="Total Calls"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={{ fill: '#94a3b8', r: 3 }}
                activeDot={{ r: 5 }}
              />

              {/* Quality Calls - Green */}
              <Line
                type="monotone"
                dataKey="Quality (>30s)"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', r: 3 }}
                activeDot={{ r: 5 }}
              />

              {/* Excellent Calls - Blue */}
              <Line
                type="monotone"
                dataKey="Excellent (>60s + QCI>70)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
