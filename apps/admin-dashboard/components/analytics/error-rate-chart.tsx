"use client";

import { Card, Title, LineChart, Text, Badge, Flex, List, ListItem } from "@tremor/react";
import { ErrorData } from "@/lib/analytics/types";

interface ErrorRateChartProps {
  data: ErrorData[];
  timeSeriesData?: Array<{
    date: string;
    error_rate: number;
  }>;
  title?: string;
  description?: string;
}

export function ErrorRateChart({
  data,
  timeSeriesData,
  title = "Error Monitoring",
  description,
}: ErrorRateChartProps) {
  // Sort errors by count
  const topErrors = [...data].sort((a, b) => b.error_count - a.error_count).slice(0, 5);

  // Calculate overall error rate
  const totalErrors = data.reduce((sum, item) => sum + item.error_count, 0);
  const avgErrorRate =
    data.length > 0 ? data.reduce((sum, item) => sum + item.error_percentage, 0) / data.length : 0;

  // Format time series data if available
  const formattedTimeData =
    timeSeriesData?.map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      "Error Rate (%)": Number((item.error_rate * 100).toFixed(2)),
    })) || [];

  // Get error severity badge color
  const getSeverityColor = (rate: number) => {
    if (rate < 1) return "green";
    if (rate < 5) return "yellow";
    if (rate < 10) return "orange";
    return "red";
  };

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <Title>{title}</Title>
          {description && <Text className="mt-1">{description}</Text>}
        </div>

        <Flex className="gap-6">
          <div>
            <Text>Total Errors</Text>
            <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-500">
              {totalErrors.toLocaleString()}
            </p>
          </div>
          <div>
            <Text>Avg Error Rate</Text>
            <p className="mt-1 text-2xl font-semibold">{avgErrorRate.toFixed(2)}%</p>
          </div>
          <div className="flex items-end">
            <Badge color={getSeverityColor(avgErrorRate)}>
              {avgErrorRate < 1
                ? "Healthy"
                : avgErrorRate < 5
                  ? "Warning"
                  : avgErrorRate < 10
                    ? "Critical"
                    : "Severe"}
            </Badge>
          </div>
        </Flex>
      </div>

      {formattedTimeData.length > 0 ? (
        <LineChart
          className="mt-6 h-48"
          data={formattedTimeData}
          index="date"
          categories={["Error Rate (%)"]}
          colors={["red"]}
          showAnimation={true}
          showGridLines={false}
          yAxisWidth={50}
        />
      ) : null}

      <div className="mt-6">
        <Text className="font-medium">Top Errors</Text>
        <List className="mt-2">
          {topErrors.map((error, index) => (
            <ListItem key={index}>
              <Flex className="justify-between">
                <div className="flex-1">
                  <Text className="font-medium">{error.feature_name.replace(/_/g, " ")}</Text>
                  {error.error_type && (
                    <Text className="text-xs text-tremor-content dark:text-dark-tremor-content">
                      {error.error_type}
                    </Text>
                  )}
                </div>
                <div className="text-right">
                  <Badge color="red" size="xs">
                    {error.error_count} errors
                  </Badge>
                  <Text className="mt-1 text-xs">{error.affected_users} users affected</Text>
                </div>
              </Flex>
            </ListItem>
          ))}
        </List>
      </div>
    </Card>
  );
}
