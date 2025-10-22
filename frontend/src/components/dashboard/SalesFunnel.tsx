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
  onStageClick?: (stageName: string) => void;
}

export function SalesFunnel({
  assistantId,
  dateFrom,
  dateTo,
  onStageClick,
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
        <div className="flex items-center justify-between gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
    { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-900', badge: 'text-red-600' },
    { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-900', badge: 'text-green-600' },
    { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-900', badge: 'text-orange-600' },
    { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-900', badge: 'text-emerald-600' },
    { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-900', badge: 'text-purple-600' },
  ];

  return (
    <Card className="p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Funnel</h2>

      {/* Horizontal Funnel */}
      <div className="flex items-center justify-between gap-2">
        {data.stages.map((stage, index) => (
          <div key={index} className="flex items-center flex-1">
            {/* Stage Box */}
            <div
              onClick={() => onStageClick?.(stage.name)}
              className={`flex-1 ${stageColors[index].bg} border-2 ${stageColors[index].border} rounded-lg p-3 text-center min-w-0 transition-all ${
                onStageClick ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''
              }`}
            >
              <div className={`text-[10px] font-medium ${stageColors[index].badge} mb-1 truncate`}>
                {stage.name}
              </div>
              <div className={`text-xl font-bold ${stageColors[index].text}`}>
                {stage.count.toLocaleString()}
              </div>
              <div className={`text-[10px] ${stageColors[index].badge} mt-1`}>
                {stage.rate.toFixed(1)}%
              </div>
            </div>

            {/* Arrow (if not last stage) */}
            {index < data.stages.length - 1 && (
              <div className="flex flex-col items-center -mx-1 flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <div className="text-[9px] font-bold text-gray-700 mt-0.5">
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
            <div className="text-gray-500">Error Rate</div>
            <div className="font-bold text-red-600">
              {data.stages[1]?.rate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-gray-500">Quality Rate</div>
            <div className="font-bold text-emerald-600">
              {data.stages[4]?.rate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-gray-500">Tools Used</div>
            <div className="font-bold text-purple-600">
              {data.stages[5]?.rate.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
