'use client';

import { useState } from 'react';
import { FilterPanel } from '@/components/dashboard/FilterPanel';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { TimelineChart } from '@/components/dashboard/TimelineChart';
import { AssistantDonutChart } from '@/components/dashboard/AssistantDonutChart';
import { CallTypesBarChart } from '@/components/dashboard/CallTypesBarChart';
import { CallsTable } from '@/components/dashboard/CallsTable';
import { CallDetailsSidebar } from '@/components/dashboard/CallDetailsSidebar';
import { Button } from '@/components/ui/button';

type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all' | 'custom';
type CallTab = 'all' | 'quality' | 'short' | 'tools' | 'voicemail' | 'errors';

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [assistantId, setAssistantId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<CallTab>('all');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | null>(null);

  // Handle time range changes with custom date support
  const handleTimeRangeChange = (range: TimeRange, custom?: { from: Date; to: Date }) => {
    setTimeRange(range);
    if (range === 'custom' && custom) {
      setCustomDateRange(custom);
    } else {
      setCustomDateRange(null);
    }
  };

  // Calculate date range based on timeRange
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Use custom date range if selected
    if (timeRange === 'custom' && customDateRange) {
      return {
        from: customDateRange.from.toISOString(),
        to: customDateRange.to.toISOString(),
      };
    }

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

  const tabs: { value: CallTab; label: string; icon: string }[] = [
    { value: 'all', label: 'All Calls', icon: '📋' },
    { value: 'quality', label: 'Quality ≥60s', icon: '✅' },
    { value: 'short', label: 'Short 1-59s', icon: '⏱️' },
    { value: 'tools', label: 'With Tools', icon: '🛠️' },
    { value: 'voicemail', label: 'Voicemail', icon: '📞' },
    { value: 'errors', label: 'Errors', icon: '❌' },
  ];

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
        onTimeRangeChange={handleTimeRangeChange}
        onAssistantChange={setAssistantId}
      />

      {/* Metrics Grid */}
      <MetricsGrid
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

      {/* Assistant & Call Types Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AssistantDonutChart
          assistantId={assistantId === 'all' ? null : assistantId}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
        <CallTypesBarChart
          assistantId={assistantId === 'all' ? null : assistantId}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </div>

      {/* Call Type Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-200">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              variant="ghost"
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.value
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Calls Table */}
      <CallsTable
        assistantId={assistantId === 'all' ? null : assistantId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        stageFilter={activeTab}
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
