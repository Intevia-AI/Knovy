"use client";

import React from "react";
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

interface ModernMetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  subtitle?: string;
  className?: string;
  loading?: boolean;
  sparkline?: number[];
}

export function ModernMetricCard({
  title,
  value,
  change,
  changeLabel,
  trend,
  icon,
  subtitle,
  className,
  loading = false,
  sparkline,
}: ModernMetricCardProps) {
  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="w-4 h-4" />;
    if (trend === "down") return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (trend === "up") return "text-green-600 bg-green-50";
    if (trend === "down") return "text-red-600 bg-red-50";
    return "text-gray-600 bg-gray-50";
  };

  const getChangeIcon = () => {
    if (!change) return null;
    if (change > 0) return <ArrowUp className="w-3 h-3" />;
    if (change < 0) return <ArrowDown className="w-3 h-3" />;
    return null;
  };

  const getChangeColor = () => {
    if (!change) return "text-gray-500";
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-500";
  };

  if (loading) {
    return (
      <div className={cn(
        "relative p-6 bg-white rounded-xl border border-gray-100",
        "shadow-sm hover:shadow-md transition-all duration-200",
        className
      )}>
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-8 bg-gray-200 rounded w-32"></div>
          <div className="h-3 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative p-6 bg-white rounded-xl border border-gray-100",
      "shadow-sm hover:shadow-md transition-all duration-200",
      "hover:border-blue-200 group cursor-pointer",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {trend && (
          <div className={cn("p-1.5 rounded-lg", getTrendColor())}>
            {getTrendIcon()}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-3xl font-bold text-gray-900 tracking-tight">
          {value}
        </p>
      </div>

      {/* Change */}
      {change !== undefined && (
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1", getChangeColor())}>
            {getChangeIcon()}
            <span className="text-sm font-medium">
              {Math.abs(change).toFixed(1)}%
            </span>
          </div>
          {changeLabel && (
            <span className="text-sm text-gray-500">{changeLabel}</span>
          )}
        </div>
      )}

      {/* Mini Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <svg className="w-full h-8" viewBox="0 0 100 32">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-blue-500"
              points={sparkline
                .map((value, index) => {
                  const x = (index / (sparkline.length - 1)) * 100;
                  const y = 32 - (value / Math.max(...sparkline)) * 32;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          </svg>
        </div>
      )}

      {/* Hover effect gradient */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
    </div>
  );
}