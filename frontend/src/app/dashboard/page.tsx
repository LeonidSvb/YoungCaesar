import { createClient } from '@/lib/supabase/server';
import { MetricCard } from '@/components/MetricCard';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { TimelineChart } from '@/components/dashboard/TimelineChart';
import { AssistantBreakdown } from '@/components/dashboard/AssistantBreakdown';
import { CallsTable } from '@/components/dashboard/CallsTable';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch dashboard metrics
  const { data: metrics, error: metricsError } = await supabase.rpc(
    'get_dashboard_metrics',
    {
      p_assistant_id: null,
      p_date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      p_date_to: new Date().toISOString(),
    }
  );

  // Fetch timeline data
  const { data: timeline, error: timelineError } = await supabase.rpc(
    'get_timeline_data',
    {
      p_assistant_id: null,
      p_date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      p_date_to: new Date().toISOString(),
      p_granularity: 'day',
    }
  );

  // Fetch assistant breakdown
  const { data: assistants, error: assistantsError } = await supabase.rpc(
    'get_assistant_breakdown',
    {
      p_date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      p_date_to: new Date().toISOString(),
    }
  );

  if (metricsError || timelineError || assistantsError) {
    return (
      <div className="p-6">
        <div className="text-red-600">
          Error loading dashboard data. Please check your Supabase connection.
        </div>
        <pre className="mt-4 text-xs bg-gray-100 p-4 rounded">
          {JSON.stringify({ metricsError, timelineError, assistantsError }, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Last 7 days analytics</p>
      </div>

      {/* Metrics Grid */}
      <MetricsGrid metrics={metrics} />

      {/* Timeline Chart */}
      <div className="mt-8">
        <TimelineChart data={timeline || []} />
      </div>

      {/* Assistant Breakdown */}
      <div className="mt-8">
        <AssistantBreakdown assistants={assistants || []} />
      </div>

      {/* Calls Table */}
      <div className="mt-8">
        <CallsTable />
      </div>
    </div>
  );
}
