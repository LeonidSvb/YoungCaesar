'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all';
type QualityFilter = 'all' | 'with_transcript' | 'with_qci' | 'quality';

interface FilterPanelProps {
  onTimeRangeChange: (range: TimeRange) => void;
  onAssistantChange: (assistantId: string) => void;
  onQualityFilterChange: (filter: QualityFilter) => void;
}

export function FilterPanel({
  onTimeRangeChange,
  onAssistantChange,
  onQualityFilterChange,
}: FilterPanelProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30d');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');

  const handleTimeRangeClick = (range: TimeRange) => {
    setSelectedTimeRange(range);
    onTimeRangeChange(range);
  };

  const handleQualityFilterChange = (value: QualityFilter) => {
    setQualityFilter(value);
    onQualityFilterChange(value);
  };

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: 'all', label: 'All' },
  ];

  return (
    <Card className="p-4 mb-6">
      <div className="flex flex-wrap gap-4">
        {/* Time Range Filter */}
        <div className="flex-1 min-w-[200px]">
          <Label className="block text-sm font-medium text-gray-700 mb-2">
            Time Range
          </Label>
          <div className="flex gap-2">
            {timeRanges.map((range) => (
              <Button
                key={range.value}
                variant={selectedTimeRange === range.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimeRangeClick(range.value)}
                className={
                  selectedTimeRange === range.value
                    ? 'bg-blue-50 border-blue-500 text-blue-700 hover:bg-blue-100'
                    : ''
                }
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Assistant Filter */}
        <div className="w-64">
          <Label className="block text-sm font-medium text-gray-700 mb-2">
            Assistant
          </Label>
          <Select defaultValue="all" onValueChange={onAssistantChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select assistant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assistants</SelectItem>
              <SelectItem value="35cd1a47-714b-4436-9a19-34d7f2d00b56">
                BIESSE - MS
              </SelectItem>
              <SelectItem value="10f76383-3a83-428e-b70a-8e96d0ef0e54">
                QC Advisor
              </SelectItem>
              <SelectItem value="8a51eae6-a29e-45c7-bea9-32c6d871e1bd">
                Alex1
              </SelectItem>
              <SelectItem value="0eddf4db-e6cc-4b00-9e38-8f2e0ea77bc4">
                YC Assistant | HOT
              </SelectItem>
              <SelectItem value="8cd7551f-4e98-40fa-bb29-8bc79ae94a61">
                Riley
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quality Filter */}
        <div className="flex items-end">
          <div className="space-y-1">
            <Label className="block text-sm font-medium text-gray-700">
              Call Filter
            </Label>
            <RadioGroup
              value={qualityFilter}
              onValueChange={handleQualityFilterChange}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="filter-all" />
                <Label htmlFor="filter-all" className="text-sm font-normal cursor-pointer">
                  All Calls
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="quality" id="filter-quality" />
                <Label htmlFor="filter-quality" className="text-sm font-normal cursor-pointer">
                  &gt;30s
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="with_transcript" id="filter-transcript" />
                <Label htmlFor="filter-transcript" className="text-sm font-normal cursor-pointer">
                  Has Transcript
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="with_qci" id="filter-qci" />
                <Label htmlFor="filter-qci" className="text-sm font-normal cursor-pointer">
                  Has QCI
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>
    </Card>
  );
}
