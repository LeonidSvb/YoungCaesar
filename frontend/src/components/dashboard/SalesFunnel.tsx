'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

interface FunnelStage {
  name: string;
  count: number;
  rate: number;
}

interface SalesFunnelData {
  stages: FunnelStage[];
}

interface SalesFunnelProps {
  assistantId: string | null;
  dateFrom: string;
  dateTo: string;
}

export function SalesFunnel({
  assistantId,
  dateFrom,
  dateTo,
}: SalesFunnelProps) {
  const [data, setData] = useState<SalesFunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFunnel() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (assistantId && assistantId !== 'all') params.set('assistant_id', assistantId);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);

        const res = await fetch(`/api/dashboard/funnel?${params.toString()}`);
        if (res.ok) {
          const funnel = await res.json();
          setData(funnel);
        }
      } catch (error) {
        console.error('Failed to fetch sales funnel:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFunnel();
  }, [assistantId, dateFrom, dateTo]);

  if (loading) {
    return (
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Funnel</h2>
        <div className="flex items-center justify-between gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-24 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || !data.stages) {
    return (
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Funnel</h2>
        <p className="text-sm text-gray-500 text-center">No data available</p>
      </Card>
    );
  }

  // Calculate conversion rates between stages
  const getConversionRate = (currentIndex: number) => {
    if (currentIndex === 0) return 100;
    const previousStage = data.stages[currentIndex - 1];
    const currentStage = data.stages[currentIndex];
    if (previousStage.count === 0) return 0;
    return ((currentStage.count / previousStage.count) * 100).toFixed(1);
  };

  const stageColors = [
    { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900', badge: 'text-blue-600' },
    { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-900', badge: 'text-purple-600' },
    { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-900', badge: 'text-green-600' },
    { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-900', badge: 'text-emerald-600' },
  ];

  return (
    <Card className="p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Funnel</h2>

      {/* Horizontal Funnel */}
      <div className="flex items-center justify-between gap-3">
        {data.stages.map((stage, index) => (
          <div key={index} className="flex items-center flex-1">
            {/* Stage Box */}
            <div
              className={`flex-1 ${stageColors[index].bg} border-2 ${stageColors[index].border} rounded-lg p-4 text-center`}
            >
              <div className={`text-xs font-medium ${stageColors[index].badge} mb-1`}>
                {stage.name}
              </div>
              <div className={`text-2xl font-bold ${stageColors[index].text}`}>
                {stage.count.toLocaleString()}
              </div>
              <div className={`text-xs ${stageColors[index].badge} mt-1`}>
                {stage.rate.toFixed(1)}%
              </div>
            </div>

            {/* Arrow (if not last stage) */}
            {index < data.stages.length - 1 && (
              <div className="flex flex-col items-center -mx-2">
                <ChevronRight className="w-6 h-6 text-gray-400" />
                <div className="text-xs font-bold text-gray-700 mt-1">
                  {getConversionRate(index + 1)}%
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Overall Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-gray-500">Overall Conversion</div>
            <div className="font-bold text-gray-900">
              {data.stages[3]?.rate.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-gray-500">Engaged Rate</div>
            <div className="font-bold text-gray-900">
              {data.stages[2]?.rate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-gray-500">Meeting Success</div>
            <div className="font-bold text-gray-900">
              {getConversionRate(3)}%
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
