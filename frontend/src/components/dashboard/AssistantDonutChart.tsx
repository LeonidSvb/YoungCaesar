'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

interface AssistantData {
  name: string;
  total: number;
  quality: number;
}

interface AssistantDonutChartProps {
  assistantId: string | null;
  dateFrom: string;
  dateTo: string;
}

const COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#6366f1'];

export function AssistantDonutChart({
  assistantId,
  dateFrom,
  dateTo,
}: AssistantDonutChartProps) {
  const [data, setData] = useState<AssistantData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssistantData();
  }, [assistantId, dateFrom, dateTo]);

  const fetchAssistantData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assistantId && assistantId !== 'all') params.set('assistant_id', assistantId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/dashboard/assistants?${params.toString()}`);
      if (res.ok) {
        const assistantData = await res.json();
        setData(assistantData);
      }
    } catch (error) {
      console.error('Failed to fetch assistant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = data.map((item) => ({
    name: item.name,
    value: item.total,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="12px"
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Distribution by Assistant</CardTitle>
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
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => {
                  const assistant = data.find(d => d.name === name);
                  return [
                    <div key="tooltip" className="space-y-1">
                      <div>Total: {value}</div>
                      {assistant && (
                        <div className="text-green-600">
                          Quality: {assistant.quality} ({((assistant.quality / assistant.total) * 100).toFixed(0)}%)
                        </div>
                      )}
                    </div>,
                    name
                  ];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
