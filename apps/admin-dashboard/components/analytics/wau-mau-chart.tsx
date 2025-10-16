'use client';

import { Card, Title, LineChart, Text, Flex, Metric, Badge } from '@tremor/react';
import { WauData, MauData } from '@/lib/analytics/types';

interface WauMauChartProps {
  wauData?: WauData[];
  mauData?: MauData[];
  title?: string;
  description?: string;
  mode?: 'weekly' | 'monthly';
}

export function WauMauChart({
  wauData,
  mauData,
  title = 'Active Users Trend',
  description,
  mode = 'weekly'
}: WauMauChartProps) {
  // Prepare chart data based on mode
  const chartData = mode === 'weekly' && wauData
    ? wauData.map(item => ({
        period: new Date(item.week).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        'Weekly Active Users': item.wau
      }))
    : mauData?.map(item => ({
        period: new Date(item.month + '-01').toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric'
        }),
        'Monthly Active Users': item.mau
      })) || [];

  // Get latest value and calculate trend
  const currentValue = mode === 'weekly'
    ? (wauData?.[wauData.length - 1]?.wau || 0)
    : (mauData?.[mauData.length - 1]?.mau || 0);
  const previousValue = mode === 'weekly'
    ? (wauData?.[wauData.length - 2]?.wau || 0)
    : (mauData?.[mauData.length - 2]?.mau || 0);
  const percentChange = previousValue > 0
    ? ((currentValue - previousValue) / previousValue * 100).toFixed(1)
    : '0';
  const isPositive = currentValue >= previousValue;

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <Title>{title}</Title>
          {description && <Text className="mt-1">{description}</Text>}
        </div>

        <Flex className="gap-6">
          <div>
            <Text>{mode === 'weekly' ? 'Current WAU' : 'Current MAU'}</Text>
            <Metric>{currentValue.toLocaleString()}</Metric>
          </div>
          <div className="flex items-end">
            <Badge color={isPositive ? 'green' : 'red'}>
              {isPositive ? '↑' : '↓'} {Math.abs(Number(percentChange))}%
            </Badge>
          </div>
        </Flex>
      </div>

      <LineChart
        className="mt-6 h-72"
        data={chartData}
        index="period"
        categories={[mode === 'weekly' ? 'Weekly Active Users' : 'Monthly Active Users']}
        colors={['violet']}
        showAnimation={true}
        showGridLines={false}
        yAxisWidth={60}
      />
    </Card>
  );
}