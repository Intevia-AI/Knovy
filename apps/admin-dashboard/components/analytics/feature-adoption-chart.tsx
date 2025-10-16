"use client";

import { Card, Title, BarChart, Text, Metric, Flex } from "@tremor/react";
import { FeatureAdoptionData } from "@/lib/analytics/types";

interface FeatureAdoptionChartProps {
  data: FeatureAdoptionData[];
  title?: string;
  description?: string;
}

export function FeatureAdoptionChart({
  data,
  title = "Feature Adoption",
  description,
}: FeatureAdoptionChartProps) {
  // Sort by total uses and take top 10
  const sortedData = [...data]
    .sort((a, b) => b.total_uses - a.total_uses)
    .slice(0, 10)
    .map((item) => ({
      feature: item.feature_name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      "Total Uses": item.total_uses,
      "Unique Users": item.unique_users,
      "Success Rate": Number((item.success_rate * 100).toFixed(1)),
    }));

  // Calculate totals
  const totalUsers = data.reduce((sum, item) => Math.max(sum, item.unique_users), 0);
  const totalFeatures = data.length;

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <Title>{title}</Title>
          {description && <Text className="mt-1">{description}</Text>}
        </div>

        <Flex className="gap-6">
          <div>
            <Text>Total Features</Text>
            <Metric>{totalFeatures}</Metric>
          </div>
          <div>
            <Text>Active Users</Text>
            <Metric>{totalUsers.toLocaleString()}</Metric>
          </div>
        </Flex>
      </div>

      <BarChart
        className="mt-6 h-72"
        data={sortedData}
        index="feature"
        categories={["Total Uses", "Unique Users"]}
        colors={["blue", "cyan"]}
        yAxisWidth={60}
        showAnimation={true}
        showGridLines={false}
      />
    </Card>
  );
}
