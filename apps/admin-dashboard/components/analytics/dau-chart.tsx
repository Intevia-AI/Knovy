"use client";

import { Card, Title, AreaChart, Text } from "@tremor/react";
import { DauData } from "@/lib/analytics/types";

interface DauChartProps {
  data: DauData[];
  title?: string;
  description?: string;
}

export function DauChart({ data, title = "Daily Active Users", description }: DauChartProps) {
  // Format data for display
  const formattedData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    "Active Users": item.dau,
  }));

  // Calculate trend
  const currentValue = data[data.length - 1]?.dau || 0;
  const previousValue = data[data.length - 2]?.dau || 0;
  const percentChange =
    previousValue > 0 ? (((currentValue - previousValue) / previousValue) * 100).toFixed(1) : "0";
  const isPositive = currentValue >= previousValue;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <Title>{title}</Title>
          {description && <Text className="mt-1">{description}</Text>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            {currentValue.toLocaleString()}
          </p>
          <p
            className={`text-sm ${
              isPositive
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-red-600 dark:text-red-500"
            }`}
          >
            {isPositive ? "↑" : "↓"} {Math.abs(Number(percentChange))}%
          </p>
        </div>
      </div>

      <AreaChart
        className="mt-6 h-72"
        data={formattedData}
        index="date"
        categories={["Active Users"]}
        colors={["indigo"]}
        showAnimation={true}
        showGridLines={false}
      />
    </Card>
  );
}
