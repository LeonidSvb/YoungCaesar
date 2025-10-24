'use client';

import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/MetricCard';

interface DashboardMetrics {
  totalCalls: number;
  qualityCalls: number;
  withTools: number;
  avgQCI: number;
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Total Calls"
        value={metrics.totalCalls}
        format="number"
        subtitle="All calls in period"
      />

      <MetricCard
        title="Quality Calls"
        value={metrics.qualityCalls}
        format="number"
        subtitle="≥60s duration"
      />

      <MetricCard
        title="With Tools"
        value={metrics.withTools}
        format="number"
        subtitle="Calendar bookings"
      />

      <MetricCard
        title="Avg QCI Score"
        value={metrics.avgQCI}
        format="number"
        subtitle="Quality Call Index"
      />
    </div>
  );
}
