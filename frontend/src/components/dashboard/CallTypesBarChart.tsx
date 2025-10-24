'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface CallTypeData {
  type: string;
  count: number;
}

interface CallTypesBarChartProps {
  assistantId: string | null;
  dateFrom: string;
  dateTo: string;
}

const COLORS: { [key: string]: string } = {
  'Quality Calls': '#22c55e',
  'Short Calls': '#f59e0b',
  'With Tools': '#3b82f6',
  'Voicemail': '#a855f7',
  'Errors': '#ef4444',
};

export function CallTypesBarChart({
  assistantId,
  dateFrom,
  dateTo,
}: CallTypesBarChartProps) {
  const [data, setData] = useState<CallTypeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCallTypesData();
  }, [assistantId, dateFrom, dateTo]);

  const fetchCallTypesData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assistantId && assistantId !== 'all') params.set('assistant_id', assistantId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/dashboard/call-types?${params.toString()}`);
      if (res.ok) {
        const callTypesData = await res.json();
        setData(callTypesData);
      }
    } catch (error) {
      console.error('Failed to fetch call types data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Types Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="w-full h-full bg-gray-100 animate-pulse rounded-lg" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No data available for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis
                type="category"
                dataKey="type"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`${value} calls`, 'Count']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.type] || '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
