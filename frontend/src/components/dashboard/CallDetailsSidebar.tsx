'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface CallDetails {
  id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  cost: number;
  status: string;
  ended_reason: string;
  assistant: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    phone_number: string;
  };
  quality: string;
  transcript: string;
  has_transcript: boolean;
  recording_url: string;
  has_recording: boolean;
  qci: {
    total_score: number;
    dynamics_score: number;
    objections_score: number;
    brand_score: number;
    outcome_score: number;
    coaching_tips: string;
    key_issues: string;
    recommendations: string;
    call_classification: string;
  } | null;
  has_qci: boolean;
}

interface CallDetailsSidebarProps {
  callId: string | null;
  open: boolean;
  onClose: () => void;
}

export function CallDetailsSidebar({
  callId,
  open,
  onClose,
}: CallDetailsSidebarProps) {
  const [details, setDetails] = useState<CallDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [qciOpen, setQciOpen] = useState(true);
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);

  useEffect(() => {
    if (callId && open) {
      fetchCallDetails();
    }
  }, [callId, open]);

  const fetchCallDetails = async () => {
    if (!callId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/calls/${callId}`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch call details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const parseTranscript = (transcript: string) => {
    if (!transcript) return [];

    const lines = transcript.split('\n');
    return lines.map((line) => {
      const match = line.match(/^(User|AI):\s*(.+)$/);
      if (match) {
        return { speaker: match[1], text: match[2] };
      }
      return { speaker: 'System', text: line };
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-96 overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Call Details</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : details ? (
          <div className="space-y-6">
            {/* Audio Player */}
            {details.has_recording && details.recording_url && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Audio Recording
                </div>
                <audio controls className="w-full">
                  <source src={details.recording_url} type="audio/wav" />
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}

            {/* Transcript */}
            {details.has_transcript && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Transcript
                </div>
                <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto text-sm">
                  <div className="space-y-2">
                    {parseTranscript(details.transcript).map((line, idx) => (
                      <div key={idx}>
                        <span
                          className={
                            line.speaker === 'User'
                              ? 'font-medium text-blue-600'
                              : line.speaker === 'AI'
                              ? 'font-medium text-purple-600'
                              : 'text-gray-500'
                          }
                        >
                          {line.speaker}:
                        </span>{' '}
                        <span className="text-gray-700">{line.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* QCI Analysis */}
            {details.has_qci && details.qci && (
              <Collapsible open={qciOpen} onOpenChange={setQciOpen}>
                <CollapsibleTrigger className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                  <span>📊 QCI Analysis</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      qciOpen ? 'rotate-180' : ''
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-center mb-4">
                      <div className="text-3xl font-bold text-blue-600">
                        {details.qci.total_score}/100
                      </div>
                      <div className="text-xs text-gray-500">Total Score</div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Dynamics:</span>
                        <span className="font-medium">
                          {details.qci.dynamics_score}/30
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Objections:</span>
                        <span className="font-medium">
                          {details.qci.objections_score}/20
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Brand:</span>
                        <span className="font-medium">
                          {details.qci.brand_score}/20
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Outcome:</span>
                        <span className="font-medium">
                          {details.qci.outcome_score}/30
                        </span>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Coaching Tips */}
            {details.has_qci && details.qci?.coaching_tips && (
              <Collapsible open={coachingOpen} onOpenChange={setCoachingOpen}>
                <CollapsibleTrigger className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                  <span>💡 Coaching Tips</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      coachingOpen ? 'rotate-180' : ''
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {details.qci.coaching_tips}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Metadata */}
            <Collapsible open={metadataOpen} onOpenChange={setMetadataOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                <span>ℹ️ Metadata</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    metadataOpen ? 'rotate-180' : ''
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium">
                        {formatDuration(details.duration_seconds)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost:</span>
                      <span className="font-medium">
                        ${details.cost.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Started:</span>
                      <span className="font-medium">
                        {formatDate(details.started_at)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Assistant:</span>
                      <span className="font-medium">
                        {details.assistant.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium font-mono text-xs">
                        {details.customer.phone_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Call ID:</span>
                      <span className="font-medium font-mono text-xs">
                        {details.id.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">
            No call details available
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
