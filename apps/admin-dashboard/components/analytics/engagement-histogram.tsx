'use client';

import { Card, Title, BarChart, Text, Badge, Flex } from '@tremor/react';
import { EngagementScoreData } from '@/lib/analytics/types';

interface EngagementHistogramProps {
  data: EngagementScoreData[];
  title?: string;
  description?: string;
}

export function EngagementHistogram({
  data,
  title = 'User Engagement Distribution',
  description
}: EngagementHistogramProps) {
  // Create histogram bins (0-20, 21-40, 41-60, 61-80, 81-100)
  const bins = [
    { range: '0-20', label: 'Very Low', count: 0, color: 'red' },
    { range: '21-40', label: 'Low', count: 0, color: 'orange' },
    { range: '41-60', label: 'Medium', count: 0, color: 'yellow' },
    { range: '61-80', label: 'High', count: 0, color: 'blue' },
    { range: '81-100', label: 'Very High', count: 0, color: 'green' }
  ];

  // Count users in each bin
  data.forEach(user => {
    const score = user.engagement_score;
    if (score <= 20) bins[0]!.count++;
    else if (score <= 40) bins[1]!.count++;
    else if (score <= 60) bins[2]!.count++;
    else if (score <= 80) bins[3]!.count++;
    else bins[4]!.count++;
  });

  const chartData = bins.map(bin => ({
    'Engagement Level': bin.label,
    'User Count': bin.count
  }));

  // Calculate average engagement score
  const avgScore = data.length > 0
    ? data.reduce((sum, user) => sum + user.engagement_score, 0) / data.length
    : 0;

  // Get engagement level label
  const getEngagementLevel = (score: number) => {
    if (score <= 20) return { label: 'Very Low', color: 'red' };
    if (score <= 40) return { label: 'Low', color: 'orange' };
    if (score <= 60) return { label: 'Medium', color: 'yellow' };
    if (score <= 80) return { label: 'High', color: 'blue' };
    return { label: 'Very High', color: 'green' };
  };

  const avgLevel = getEngagementLevel(avgScore);

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <Title>{title}</Title>
          {description && <Text className="mt-1">{description}</Text>}
        </div>

        <Flex className="gap-4">
          <div>
            <Text>Average Score</Text>
            <p className="mt-1 text-2xl font-semibold">
              {avgScore.toFixed(1)}
            </p>
          </div>
          <div className="flex items-end">
            <Badge color={avgLevel.color as any}>
              {avgLevel.label}
            </Badge>
          </div>
        </Flex>
      </div>

      <BarChart
        className="mt-6 h-72"
        data={chartData}
        index="Engagement Level"
        categories={['User Count']}
        colors={['indigo']}
        showAnimation={true}
        showGridLines={false}
      />

      <div className="mt-4 grid grid-cols-5 gap-2">
        {bins.map((bin) => (
          <div key={bin.range} className="text-center">
            <Badge color={bin.color as any} size="xs">
              {bin.label}
            </Badge>
            <Text className="mt-1 text-xs">{bin.range}</Text>
            <Text className="font-semibold">{bin.count}</Text>
          </div>
        ))}
      </div>
    </Card>
  );
}