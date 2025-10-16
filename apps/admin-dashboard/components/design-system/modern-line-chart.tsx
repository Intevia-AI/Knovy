"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  TooltipProps,
} from "recharts";
import { cn } from "@workspace/ui/lib/utils";
import { colors } from "./colors";

interface ModernLineChartProps {
  data: any[];
  lines: {
    key: string;
    label: string;
    color?: string;
    strokeWidth?: number;
    showArea?: boolean;
  }[];
  xAxisKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  curveType?: "linear" | "monotone" | "step";
  loading?: boolean;
  formatXAxis?: (value: any) => string;
  formatYAxis?: (value: any) => string;
  formatTooltip?: (value: any) => string;
}

const CustomTooltip = ({ active, payload, label, formatTooltip }: TooltipProps<any, any> & { formatTooltip?: (value: any) => string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
        <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">
              {formatTooltip ? formatTooltip(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function ModernLineChart({
  data,
  lines,
  xAxisKey,
  xAxisLabel,
  yAxisLabel,
  height = 300,
  className,
  showLegend = true,
  showGrid = true,
  curveType = "monotone",
  loading = false,
  formatXAxis,
  formatYAxis,
  formatTooltip,
}: ModernLineChartProps) {
  const defaultColors = [
    colors.chart.primary,
    colors.chart.secondary,
    colors.chart.tertiary,
    colors.chart.quaternary,
    colors.chart.quinary,
    colors.chart.senary,
  ];

  if (loading) {
    return (
      <div className={cn("bg-white p-6 rounded-xl border border-gray-100", className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
          <div style={{ height }} className="bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  // Determine if we should use AreaChart based on showArea flags
  const useAreaChart = lines.some(line => line.showArea);

  const ChartComponent = useAreaChart ? AreaChart : LineChart;
  const DataComponent = useAreaChart ? Area : Line;

  return (
    <div className={cn("bg-white p-6 rounded-xl border border-gray-100 shadow-sm", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.border.default}
              vertical={false}
            />
          )}
          <XAxis
            dataKey={xAxisKey}
            tickFormatter={formatXAxis}
            tick={{ fontSize: 12, fill: colors.neutral[500] }}
            axisLine={{ stroke: colors.border.default }}
            tickLine={false}
            label={
              xAxisLabel
                ? {
                    value: xAxisLabel,
                    position: "insideBottom",
                    offset: -5,
                    style: { fontSize: 12, fill: colors.neutral[600] },
                  }
                : undefined
            }
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 12, fill: colors.neutral[500] }}
            axisLine={{ stroke: colors.border.default }}
            tickLine={false}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12, fill: colors.neutral[600] },
                  }
                : undefined
            }
          />
          <Tooltip
            content={<CustomTooltip formatTooltip={formatTooltip} />}
            cursor={{ stroke: colors.border.hover, strokeWidth: 1 }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "12px",
              }}
              iconType="line"
            />
          )}
          {lines.map((line, index) => {
            const color = line.color || defaultColors[index % defaultColors.length];

            if (useAreaChart) {
              return (
                <Area
                  key={line.key}
                  type={curveType}
                  dataKey={line.key}
                  name={line.label}
                  stroke={color}
                  strokeWidth={line.strokeWidth || 2}
                  fill={line.showArea ? color : "transparent"}
                  fillOpacity={line.showArea ? 0.1 : 0}
                  activeDot={{ r: 4, fill: color }}
                />
              );
            }

            return (
              <Line
                key={line.key}
                type={curveType}
                dataKey={line.key}
                name={line.label}
                stroke={color}
                strokeWidth={line.strokeWidth || 2}
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}