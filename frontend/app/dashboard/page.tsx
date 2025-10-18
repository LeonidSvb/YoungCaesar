'use client';

import { useState } from 'react';
import { FilterPanel } from '@/components/dashboard/FilterPanel';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { SalesFunnel } from '@/components/dashboard/SalesFunnel';
import { TimelineChart } from '@/components/dashboard/TimelineChart';
import { CallsTable } from '@/components/dashboard/CallsTable';
import { CallDetailsSidebar } from '@/components/dashboard/CallDetailsSidebar';

type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all';
type QualityFilter = 'all' | 'with_transcript' | 'with_qci' | 'quality';

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [assistantId, setAssistantId] = useState<string>('all');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Calculate date range based on timeRange
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (timeRange) {
      case 'today':
        return {
          from: today.toISOString(),
          to: now.toISOString(),
        };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          from: yesterday.toISOString(),
          to: today.toISOString(),
        };
      case '7d':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return {
          from: sevenDaysAgo.toISOString(),
          to: now.toISOString(),
        };
      case '30d':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return {
          from: thirtyDaysAgo.toISOString(),
          to: now.toISOString(),
        };
      case '90d':
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return {
          from: ninetyDaysAgo.toISOString(),
          to: now.toISOString(),
        };
      case 'all':
        return {
          from: new Date(2020, 0, 1).toISOString(),
          to: now.toISOString(),
        };
      default:
        return {
          from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          to: now.toISOString(),
        };
    }
  };

  const { from: dateFrom, to: dateTo } = getDateRange();

  const handleCallClick = (callId: string) => {
    setSelectedCallId(callId);
    setSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
    setSelectedCallId(null);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">VAPI Analytics Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Real-time call analytics and quality insights
        </p>
      </div>

      {/* Filters */}
      <FilterPanel
        onTimeRangeChange={setTimeRange}
        onAssistantChange={setAssistantId}
        onQualityFilterChange={setQualityFilter}
      />

      {/* Metrics Grid */}
      <MetricsGrid
        assistantId={assistantId === 'all' ? null : assistantId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      {/* Sales Funnel */}
      <SalesFunnel
        assistantId={assistantId === 'all' ? null : assistantId}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      {/* Timeline Chart */}
      <TimelineChart
        assistantId={assistantId === 'all' ? null : assistantId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        granularity="day"
      />

      {/* Calls Table */}
      <CallsTable
        assistantId={assistantId === 'all' ? null : assistantId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        qualityFilter={qualityFilter}
        onCallClick={handleCallClick}
      />

      {/* Call Details Sidebar */}
      <CallDetailsSidebar
        callId={selectedCallId}
        open={sidebarOpen}
        onClose={handleCloseSidebar}
      />
    </div>
  );
}
