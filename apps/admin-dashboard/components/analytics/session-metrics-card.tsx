"use client";

import { Card, Title, Metric, Text, Flex, ProgressBar, Badge } from "@tremor/react";
import { SessionMetrics } from "@/lib/analytics/types";

interface SessionMetricsCardProps {
  data: SessionMetrics;
  title?: string;
  description?: string;
}

export function SessionMetricsCard({
  data,
  title = "Session Metrics",
  description,
}: SessionMetricsCardProps) {
  // Format duration for display
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes.toFixed(0)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Get health status color
  const getHealthColor = (rate: number) => {
    if (rate >= 90) return "green";
    if (rate >= 80) return "yellow";
    if (rate >= 70) return "orange";
    return "red";
  };

  const healthColor = getHealthColor(data.normal_exit_rate);

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <Title>{title}</Title>
          {description && <Text className="mt-1">{description}</Text>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Text>Total Sessions</Text>
            <Metric>{data.total_sessions.toLocaleString()}</Metric>
          </div>
          <div>
            <Text>Avg Duration</Text>
            <Metric>{formatDuration(data.avg_duration_minutes)}</Metric>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Flex className="justify-between">
              <Text>Session Health</Text>
              <Badge color={healthColor}>{data.normal_exit_rate.toFixed(1)}% Normal</Badge>
            </Flex>
            <ProgressBar value={data.normal_exit_rate} color={healthColor} className="mt-2" />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t">
            <div className="text-center">
              <Text className="text-xs">Normal Exits</Text>
              <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-500">
                {data.normal_exits.toLocaleString()}
              </p>
              <Text className="text-xs">
                {((data.normal_exits / data.total_sessions) * 100).toFixed(1)}%
              </Text>
            </div>
            <div className="text-center">
              <Text className="text-xs">Crashes</Text>
              <p className="mt-1 text-lg font-semibold text-red-600 dark:text-red-500">
                {data.crashes.toLocaleString()}
              </p>
              <Text className="text-xs">
                {((data.crashes / data.total_sessions) * 100).toFixed(1)}%
              </Text>
            </div>
            <div className="text-center">
              <Text className="text-xs">Timeouts</Text>
              <p className="mt-1 text-lg font-semibold text-orange-600 dark:text-orange-500">
                {data.timeouts.toLocaleString()}
              </p>
              <Text className="text-xs">
                {((data.timeouts / data.total_sessions) * 100).toFixed(1)}%
              </Text>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
