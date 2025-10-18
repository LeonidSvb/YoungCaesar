import { MetricCard } from '@/components/MetricCard';

interface DashboardMetrics {
  totalCalls: number;
  qualityCalls: number;
  excellentCalls: number;
  avgDuration: number;
  avgQCI: number;
  qualityRate: number;
  totalAssistants: number;
}

interface MetricsGridProps {
  metrics: DashboardMetrics | null;
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
        title="Excellent Calls"
        value={metrics.excellentCalls}
        format="number"
        subtitle=">60s + QCI>70"
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
