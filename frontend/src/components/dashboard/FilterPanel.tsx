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
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all' | 'custom';

interface FilterPanelProps {
  onTimeRangeChange: (range: TimeRange, customRange?: { from: Date; to: Date }) => void;
  onAssistantChange: (assistantId: string) => void;
}

export function FilterPanel({
  onTimeRangeChange,
  onAssistantChange,
}: FilterPanelProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30d');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleTimeRangeClick = (range: TimeRange) => {
    setSelectedTimeRange(range);
    if (range !== 'custom') {
      setDateRange(undefined);
      onTimeRangeChange(range);
    }
  };

  const handleCustomDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      setSelectedTimeRange('custom');
      onTimeRangeChange('custom', { from: range.from, to: range.to });
      setIsCalendarOpen(false);
    }
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
    <Card className="p-3 mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Time Range Filter */}
        <div className="flex-1 min-w-[300px]">
          <Label className="block text-xs font-medium text-gray-600 mb-1.5">
            Time Period
          </Label>
          <div className="flex gap-1.5">
            {timeRanges.map((range) => (
              <Button
                key={range.value}
                variant={selectedTimeRange === range.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimeRangeClick(range.value)}
                className={`text-xs h-7 px-2.5 ${
                  selectedTimeRange === range.value
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                {range.label}
              </Button>
            ))}

            {/* Custom Date Picker */}
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedTimeRange === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  className={`text-xs h-7 px-2.5 ${
                    selectedTimeRange === 'custom'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, 'dd.MM')} - ${format(dateRange.to, 'dd.MM')}`
                    : 'Custom'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleCustomDateSelect}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Assistant Filter */}
        <div className="w-52">
          <Label className="block text-xs font-medium text-gray-600 mb-1.5">
            Assistant
          </Label>
          <Select defaultValue="all" onValueChange={onAssistantChange}>
            <SelectTrigger className="h-7 text-xs">
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
      </div>
    </Card>
  );
}
