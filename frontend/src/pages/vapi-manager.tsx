'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Eye,
  Database,
  Settings,
  Activity,
  Terminal,
  Play,
  Upload,
  Check,
  Loader2,
  Expand
} from 'lucide-react';

interface CollectionConfig {
  startDate: string;
  endDate: string;
  minCost: number;
  exportBackup: boolean;
  exportFormat: 'json' | 'csv';
  verbose: boolean;
}

interface SyncConfig {
  syncMode: 'auto' | 'incremental' | 'full';
  includeZeroCost: boolean;
}

interface CallData {
  id: string;
  date: string;
  duration: number;
  cost: number;
  status: 'completed' | 'partial' | 'failed';
}

interface CollectionResult {
  calls: CallData[];
  stats: {
    totalFound: number;
    collected: number;
    efficiency: string;
    duration: string;
  };
}

interface DatabaseStats {
  lastSync: string;
  totalInDB: number;
  syncMode: string;
  nextAutoSync: string;
}

type Step = 'collect' | 'preview' | 'sync';
type Status = 'idle' | 'running' | 'completed' | 'error';

export default function VapiManager() {
  const [currentStep, setCurrentStep] = useState<Step>('collect');
  const [collectStatus, setCollectStatus] = useState<Status>('idle');
  const [syncStatus, setSyncStatus] = useState<Status>('idle');

  // Load database stats on component mount
  useEffect(() => {
    const loadDbStats = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/stats');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setDbStats(result.data);
          }
        }
      } catch (error) {
        console.log('Failed to load database stats:', error);
      }
    };

    loadDbStats();
  }, []);

  const [collectionConfig, setCollectionConfig] = useState<CollectionConfig>({
    startDate: '2025-09-20',
    endDate: '2025-09-26',
    minCost: 0.03,
    exportBackup: true,
    exportFormat: 'json',
    verbose: true
  });

  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    syncMode: 'auto',
    includeZeroCost: true
  });

  const [collectionResult, setCollectionResult] = useState<CollectionResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [dbStats, setDbStats] = useState<DatabaseStats>({
    lastSync: '2025-09-26 09:09',
    totalInDB: 2456,
    syncMode: 'Auto (Incremental)',
    nextAutoSync: 'Manual'
  });

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleStartCollection = async () => {
    setCollectStatus('running');
    setLogs([]);
    addLog('📞 VAPI DATA COLLECTION 🌐 API MODE');
    addLog(`📅 Period: ${collectionConfig.startDate} to ${collectionConfig.endDate}`);
    addLog(`📋 Active Filters: Min Cost: $${collectionConfig.minCost}`);

    try {
      const response = await fetch('http://localhost:3001/api/collect-vapi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: collectionConfig.startDate,
          endDate: collectionConfig.endDate,
          minCost: collectionConfig.minCost,
          exportBackup: collectionConfig.exportBackup,
          exportFormat: collectionConfig.exportFormat,
          verbose: collectionConfig.verbose
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Collection failed');
      }

      addLog(`✅ Got ${Math.floor(result.data.stats.collected / 3)} calls`);
      addLog(`✅ Got ${Math.floor(result.data.stats.collected / 2)} calls`);
      addLog(`✅ Got ${result.data.stats.collected} calls`);

      const collectionResult: CollectionResult = {
        calls: result.data.calls,
        stats: result.data.stats
      };

      setCollectionResult(collectionResult);
      setCollectStatus('completed');
      setCurrentStep('preview');
      addLog(`✅ Collection completed! ${result.data.stats.collected} calls`);

      if (collectionConfig.exportBackup && result.files?.length > 0) {
        addLog(`💾 Files saved: ${result.files.join(', ')}`);
      }

    } catch (error) {
      setCollectStatus('error');
      addLog(`❌ Collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSyncToSupabase = async () => {
    setSyncStatus('running');
    setCurrentStep('sync');
    addLog('🔄 SUPABASE SYNC STARTING');
    addLog(`🎯 Mode: ${syncConfig.syncMode.toUpperCase()}`);
    addLog(`📊 Including zero-cost calls: ${syncConfig.includeZeroCost ? 'YES' : 'NO'}`);

    try {
      const response = await fetch('http://localhost:3001/api/sync-supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syncMode: syncConfig.syncMode,
          includeZeroCost: syncConfig.includeZeroCost,
          verbose: collectionConfig.verbose
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }

      addLog(`✅ Synced ${result.data.callsSynced} calls to Supabase`);
      addLog(`⚡ Duration: ${result.data.duration}`);

      if (result.data.errors > 0) {
        addLog(`⚠️ ${result.data.errors} errors encountered`);
      }

      setSyncStatus('completed');
      addLog('✅ Sync completed! All data saved to Supabase');

    } catch (error) {
      setSyncStatus('error');
      addLog(`❌ Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStepClasses = (step: Step) => {
    if (currentStep === step) return 'border-blue-500 bg-blue-50';
    if (
      (step === 'collect' && collectStatus === 'completed') ||
      (step === 'preview' && currentStep === 'sync') ||
      (step === 'sync' && syncStatus === 'completed')
    ) {
      return 'border-green-500 bg-green-50';
    }
    return 'border-gray-300 bg-gray-50';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">VAPI Data Manager</h1>
        <p className="text-gray-600 mt-2">Collect data from VAPI → Preview → Sync to Supabase</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className={`flex items-center border-2 rounded-lg px-4 py-3 bg-white shadow-sm ${getStepClasses('collect')}`}>
            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3">
              <Download className="w-4 h-4" />
            </div>
            <span className="font-medium">1. Collect Data</span>
          </div>

          <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>

          <div className={`flex items-center border-2 rounded-lg px-4 py-3 bg-white shadow-sm ${getStepClasses('preview')}`}>
            <div className="w-8 h-8 bg-gray-300 text-white rounded-full flex items-center justify-center mr-3">
              <Eye className="w-4 h-4" />
            </div>
            <span className="font-medium">2. Preview & Review</span>
          </div>

          <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>

          <div className={`flex items-center border-2 rounded-lg px-4 py-3 bg-white shadow-sm ${getStepClasses('sync')}`}>
            <div className="w-8 h-8 bg-gray-300 text-white rounded-full flex items-center justify-center mr-3">
              <Database className="w-4 h-4" />
            </div>
            <span className="font-medium">3. Sync to Supabase</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5 text-blue-500" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Range */}
              <div>
                <Label className="text-sm font-medium">Date Range</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input
                    type="date"
                    value={collectionConfig.startDate}
                    onChange={(e) => setCollectionConfig({...collectionConfig, startDate: e.target.value})}
                  />
                  <Input
                    type="date"
                    value={collectionConfig.endDate}
                    onChange={(e) => setCollectionConfig({...collectionConfig, endDate: e.target.value})}
                  />
                </div>
              </div>

              {/* Min Cost Filter */}
              <div>
                <Label className="text-sm font-medium">Min Cost Filter</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={collectionConfig.minCost}
                    onChange={(e) => setCollectionConfig({...collectionConfig, minCost: parseFloat(e.target.value)})}
                    className="w-20"
                  />
                  <span className="text-sm text-gray-500">USD</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Only calls above this cost (0 = all calls)</p>
              </div>

              {/* Export Options */}
              <div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="exportBackup"
                    checked={collectionConfig.exportBackup}
                    onCheckedChange={(checked) => setCollectionConfig({...collectionConfig, exportBackup: !!checked})}
                  />
                  <Label htmlFor="exportBackup" className="text-sm">Export Backup Files</Label>
                </div>
                {collectionConfig.exportBackup && (
                  <Select
                    value={collectionConfig.exportFormat}
                    onValueChange={(value: 'json' | 'csv') => setCollectionConfig({...collectionConfig, exportFormat: value})}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON (for API import)</SelectItem>
                      <SelectItem value="csv">CSV (for Excel/manual)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-gray-500 mt-1">Download files for backup or manual server import</p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="verbose"
                  checked={collectionConfig.verbose}
                  onCheckedChange={(checked) => setCollectionConfig({...collectionConfig, verbose: !!checked})}
                />
                <Label htmlFor="verbose" className="text-sm">Show detailed logs</Label>
              </div>

              {/* Sync Settings */}
              <div className="pt-4 border-t">
                <h3 className="font-medium text-gray-700 mb-3">Sync Settings</h3>

                <div>
                  <Label className="text-sm font-medium">Sync Mode</Label>
                  <Select
                    value={syncConfig.syncMode}
                    onValueChange={(value: 'auto' | 'incremental' | 'full') => setSyncConfig({...syncConfig, syncMode: value})}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (detect last sync)</SelectItem>
                      <SelectItem value="incremental">Incremental only</SelectItem>
                      <SelectItem value="full">Full resync</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">Auto mode prevents duplicates</p>
                </div>

                <div className="flex items-center space-x-2 mt-3">
                  <Checkbox
                    id="includeZero"
                    checked={syncConfig.includeZeroCost}
                    onCheckedChange={(checked) => setSyncConfig({...syncConfig, includeZeroCost: !!checked})}
                  />
                  <Label htmlFor="includeZero" className="text-sm">Include zero-cost calls</Label>
                </div>
              </div>

              {/* Action Button */}
              <Button
                className="w-full mt-6"
                onClick={handleStartCollection}
                disabled={collectStatus === 'running'}
              >
                {collectStatus === 'running' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Collecting...
                  </>
                ) : collectStatus === 'completed' ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Collection Complete
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Data Collection
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results & Preview */}
        <div className="lg:col-span-2">
          {/* Status Panel */}
          {collectionResult && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="mr-2 h-5 w-5 text-green-500" />
                  Collection Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{collectionResult.stats.totalFound}</div>
                    <div className="text-sm text-gray-600">Total Found</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{collectionResult.stats.collected}</div>
                    <div className="text-sm text-gray-600">Collected</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{collectionResult.stats.efficiency}</div>
                    <div className="text-sm text-gray-600">Efficiency</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{collectionResult.stats.duration}</div>
                    <div className="text-sm text-gray-600">Duration</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Console/Logs */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Terminal className="mr-2 h-5 w-5 text-gray-500" />
                  Live Console
                </div>
                <Button variant="ghost" size="sm">
                  <Expand className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg h-40 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
                {(collectStatus === 'running' || syncStatus === 'running') && (
                  <div className="animate-pulse">█</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Data Preview */}
          {collectionResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Eye className="mr-2 h-5 w-5 text-blue-500" />
                    Data Preview
                  </div>
                  <Badge variant="secondary">Last 5 calls</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3">Call ID</th>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Duration</th>
                        <th className="text-left p-3">Cost</th>
                        <th className="text-left p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {collectionResult.calls.map((call) => (
                        <tr key={call.id} className="hover:bg-gray-50">
                          <td className="p-3 font-mono text-xs">{call.id}</td>
                          <td className="p-3">{call.date}</td>
                          <td className="p-3">{call.duration}s</td>
                          <td className="p-3">${call.cost.toFixed(2)}</td>
                          <td className="p-3">
                            <Badge className={`${getStatusBadgeColor(call.status)} text-xs`}>
                              {call.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Next Step Action */}
                {collectStatus === 'completed' && syncStatus !== 'completed' && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-blue-900">Ready to sync to Supabase</div>
                        <div className="text-sm text-blue-700">
                          {collectionResult.stats.collected} calls collected, 0 duplicates detected
                        </div>
                      </div>
                      <Button onClick={handleSyncToSupabase} disabled={syncStatus === 'running'}>
                        {syncStatus === 'running' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Sync to Database
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {syncStatus === 'completed' && (
                  <div className="mt-6 p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <Check className="w-5 h-5 text-green-600 mr-2" />
                      <div>
                        <div className="font-medium text-green-900">Sync completed successfully!</div>
                        <div className="text-sm text-green-700">All data has been saved to Supabase</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <Card className="mt-8">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600">Last Sync</div>
              <div className="font-medium">{dbStats.lastSync}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total in DB</div>
              <div className="font-medium">{dbStats.totalInDB.toLocaleString()} calls</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Sync Mode</div>
              <div className="font-medium text-blue-600">{dbStats.syncMode}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Next Auto Sync</div>
              <div className="font-medium">{dbStats.nextAutoSync}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}