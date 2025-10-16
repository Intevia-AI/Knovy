"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
  Cell,
} from "recharts";
import { cn } from "@workspace/ui/lib/utils";
import { colors } from "./colors";

interface ModernBarChartProps {
  data: any[];
  bars: {
    key: string;
    label: string;
    color?: string;
    stackId?: string;
  }[];
  xAxisKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  loading?: boolean;
  formatXAxis?: (value: any) => string;
  formatYAxis?: (value: any) => string;
  formatTooltip?: (value: any) => string;
  orientation?: "horizontal" | "vertical";
  barSize?: number;
  animated?: boolean;
  gradient?: boolean;
}

const CustomTooltip = ({ active, payload, label, formatTooltip }: TooltipProps<any, any> & { formatTooltip?: (value: any) => string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
        <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded"
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

// Define gradients for bars
const BarGradient = ({ id, color }: { id: string; color: string }) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.8} />
      <stop offset="100%" stopColor={color} stopOpacity={0.3} />
    </linearGradient>
  </defs>
);

export function ModernBarChart({
  data,
  bars,
  xAxisKey,
  xAxisLabel,
  yAxisLabel,
  height = 300,
  className,
  showLegend = true,
  showGrid = true,
  loading = false,
  formatXAxis,
  formatYAxis,
  formatTooltip,
  orientation = "vertical",
  barSize,
  animated = true,
  gradient = true,
}: ModernBarChartProps) {
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

  const isHorizontal = orientation === "horizontal";

  return (
    <div className={cn("bg-white p-6 rounded-xl border border-gray-100 shadow-sm", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={isHorizontal ? "horizontal" : "vertical"}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          barGap={4}
          barCategoryGap={12}
        >
          {gradient && bars.map((bar, index) => {
            const color = bar.color || defaultColors[index % defaultColors.length]!;
            return <BarGradient key={bar.key} id={`gradient-${bar.key}`} color={color} />;
          })}

          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.border.default}
              vertical={!isHorizontal}
              horizontal={isHorizontal}
            />
          )}

          {isHorizontal ? (
            <>
              <YAxis
                type="category"
                dataKey={xAxisKey}
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12, fill: colors.neutral[500] }}
                axisLine={{ stroke: colors.border.default }}
                tickLine={false}
              />
              <XAxis
                type="number"
                tickFormatter={formatYAxis}
                tick={{ fontSize: 12, fill: colors.neutral[500] }}
                axisLine={{ stroke: colors.border.default }}
                tickLine={false}
              />
            </>
          ) : (
            <>
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
            </>
          )}

          <Tooltip
            content={<CustomTooltip formatTooltip={formatTooltip} />}
            cursor={{ fill: colors.neutral[100], opacity: 0.5 }}
          />

          {showLegend && (
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "12px",
              }}
              iconType="rect"
            />
          )}

          {bars.map((bar, index) => {
            const color = bar.color || defaultColors[index % defaultColors.length]!;
            const fillColor = gradient ? `url(#gradient-${bar.key})` : color;

            return (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                name={bar.label}
                fill={fillColor}
                stackId={bar.stackId}
                maxBarSize={barSize || 60}
                animationDuration={animated ? 800 : 0}
                radius={[4, 4, 0, 0]}
              >
                {/* Add hover effect */}
                {!gradient && data.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={color}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}