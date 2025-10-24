'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Call {
  id: string;
  transcript: string;
  created_at: string;
  qci_analyses?: {
    total_score: number;
    dynamics_score: number;
    objections_score: number;
    brand_score: number;
    outcome_score: number;
  }[];
}

interface AnalyzedCallsListProps {
  callIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function AnalyzedCallsList({ callIds, isOpen, onClose }: AnalyzedCallsListProps) {
  const supabase = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  useEffect(() => {
    if (isOpen && callIds.length > 0) {
      fetchCalls();
    }
  }, [isOpen, callIds]);

  async function fetchCalls() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vapi_calls_raw')
        .select(`
          id,
          transcript,
          created_at,
          qci_analyses (
            total_score,
            dynamics_score,
            objections_score,
            brand_score,
            outcome_score
          )
        `)
        .in('id', callIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCalls(data || []);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Analyzed Calls ({callIds.length})</DialogTitle>
            <DialogDescription>
              List of calls analyzed in this run
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {calls.map((call) => {
                  const qci = call.qci_analyses?.[0];
                  return (
                    <Card
                      key={call.id}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setSelectedCall(call)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-mono">
                            {call.id.substring(0, 12)}...
                          </CardTitle>
                          {qci && (
                            <Badge className={getScoreBadgeColor(qci.total_score)}>
                              QCI: {qci.total_score}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {qci && (
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Dynamics</div>
                              <div className="font-medium">{qci.dynamics_score}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Objections</div>
                              <div className="font-medium">{qci.objections_score}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Brand</div>
                              <div className="font-medium">{qci.brand_score}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Outcome</div>
                              <div className="font-medium">{qci.outcome_score}</div>
                            </div>
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {call.transcript.substring(0, 150)}...
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {selectedCall && (
        <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Call Details</DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {selectedCall.id}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {selectedCall.qci_analyses?.[0] && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">QCI Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Total Score</div>
                          <div className="text-2xl font-bold">
                            {selectedCall.qci_analyses[0].total_score}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Dynamics:</span>
                            <span className="font-medium">
                              {selectedCall.qci_analyses[0].dynamics_score}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Objections:</span>
                            <span className="font-medium">
                              {selectedCall.qci_analyses[0].objections_score}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Brand:</span>
                            <span className="font-medium">
                              {selectedCall.qci_analyses[0].brand_score}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Outcome:</span>
                            <span className="font-medium">
                              {selectedCall.qci_analyses[0].outcome_score}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Transcript</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm whitespace-pre-wrap">
                      {selectedCall.transcript}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
