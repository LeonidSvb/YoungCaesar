'use client';

import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/MetricCard';

interface DashboardMetrics {
  totalCalls: number;
  qualityCalls: number;
  engagedCalls: number;
  analyzedCalls: number;
  avgDuration: number;
  avgQCI: number;
  qualityRate: number;
  totalAssistants: number;
}

interface MetricsGridProps {
  assistantId: string | null;
  dateFrom: string;
  dateTo: string;
}

export function MetricsGrid({ assistantId, dateFrom, dateTo }: MetricsGridProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [assistantId, dateFrom, dateTo]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assistantId && assistantId !== 'all') params.set('assistant_id', assistantId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/dashboard/metrics?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <MetricCard
        title="Total Calls"
        value={metrics.totalCalls}
        format="number"
        subtitle="All calls in period"
      />

      <MetricCard
        title="Quality Rate"
        value={metrics.qualityRate}
        format="percentage"
        subtitle={`${metrics.qualityCalls} calls >30s`}
      />

      <MetricCard
        title="Avg Duration"
        value={metrics.avgDuration}
        format="duration"
        subtitle="Average call length"
      />

      <MetricCard
        title="Avg QCI Score"
        value={metrics.avgQCI}
        format="number"
        subtitle="Quality Call Index"
      />

      <MetricCard
        title="Engaged Calls"
        value={metrics.engagedCalls}
        format="number"
        subtitle=">60s duration"
      />

      <MetricCard
        title="Active Assistants"
        value={metrics.totalAssistants}
        format="number"
        subtitle="AI assistants in use"
      />
    </div>
  );
}
