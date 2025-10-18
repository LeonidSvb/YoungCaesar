import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  format?: 'number' | 'currency' | 'percentage' | 'duration';
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  format = 'number',
  className = '',
}: MetricCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'currency':
        return `$${val.toFixed(2)}`;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'duration':
        return `${val}s`;
      case 'number':
      default:
        return val.toLocaleString();
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-xs font-medium text-gray-600">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="text-xl font-bold">{formatValue(value)}</div>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
