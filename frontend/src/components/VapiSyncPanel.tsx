'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  timestamp: string;
}

export function VapiSyncPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [syncOptions, setSyncOptions] = useState({
    includeAllCalls: true,
    forceFullSync: false,
    startDate: '2025-01-01',
    endDate: new Date().toISOString().split('T')[0],
    minCost: 0
  });

  const triggerSync = async (options: any = {}) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...syncOptions, ...options }),
      });

      const data: SyncResult = await response.json();
      setResult(data);

    } catch (error) {
      setResult({
        success: false,
        message: 'Network error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (duration: string) => {
    return duration || 'Unknown';
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔄 VAPI ↔ Supabase Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Sync Options */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={syncOptions.startDate}
              onChange={(e) => setSyncOptions({ ...syncOptions, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={syncOptions.endDate}
              onChange={(e) => setSyncOptions({ ...syncOptions, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={syncOptions.includeAllCalls}
              onChange={(e) => setSyncOptions({ ...syncOptions, includeAllCalls: e.target.checked })}
              className="mr-2"
            />
            Include ALL calls (even 0-second)
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={syncOptions.forceFullSync}
              onChange={(e) => setSyncOptions({ ...syncOptions, forceFullSync: e.target.checked })}
              className="mr-2"
            />
            Force full resync
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            onClick={() => triggerSync()}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? '⏳ Syncing...' : '🚀 Start Sync'}
          </Button>

          <Button
            onClick={() => triggerSync({ forceFullSync: false })}
            disabled={isLoading}
            variant="outline"
          >
            📊 Incremental Only
          </Button>

          <Button
            onClick={() => triggerSync({ forceFullSync: true })}
            disabled={isLoading}
            variant="outline"
          >
            🔄 Full Resync
          </Button>
        </div>

        {/* Progress Indicator */}
        {isLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-blue-700">Synchronizing VAPI data to Supabase...</span>
            </div>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className={`border rounded-lg p-4 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`font-semibold ${getStatusColor(result.success)}`}>
                {result.success ? '✅ Success' : '❌ Failed'}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(result.timestamp).toLocaleString()}
              </span>
            </div>

            <p className="mb-3">{result.message}</p>

            {result.success && result.data && (
              <div className="bg-white rounded border p-3">
                <h4 className="font-medium mb-2">📊 Sync Statistics:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>📞 VAPI calls fetched: <strong>{result.data.stats?.vapi_calls_fetched || 0}</strong></div>
                  <div>💾 Supabase calls synced: <strong>{result.data.stats?.supabase_calls_synced || 0}</strong></div>
                  <div>❌ Errors: <strong>{result.data.stats?.errors || 0}</strong></div>
                  <div>⏱️ Duration: <strong>{formatDuration(result.data.duration)}</strong></div>
                  <div className="col-span-2">✅ Success rate: <strong>{result.data.stats?.success_rate || 0}%</strong></div>
                </div>
              </div>
            )}

            {!result.success && result.error && (
              <div className="bg-white rounded border p-3">
                <h4 className="font-medium text-red-600 mb-2">Error Details:</h4>
                <code className="text-sm text-red-700 block">{result.error}</code>
              </div>
            )}
          </div>
        )}

        {/* Usage Instructions */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm">
          <h4 className="font-medium mb-2">💡 Usage Tips:</h4>
          <ul className="space-y-1 text-gray-600">
            <li>• <strong>Incremental:</strong> Only syncs new calls since last sync</li>
            <li>• <strong>Full Resync:</strong> Re-syncs all calls in date range</li>
            <li>• <strong>Include ALL calls:</strong> Even 0-second technical failures</li>
            <li>• Sync typically takes 1-3 minutes for 1000+ calls</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default VapiSyncPanel;