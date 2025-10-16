"use client";

import { useState } from "react";
import { Card } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Calculator,
  ArrowUp,
  ArrowDown,
  Info,
} from "lucide-react";
import { formatCost } from "@/lib/analytics/token-utils";

interface CostEstimationWidgetProps {
  currentCost: number;
  projectedCost: number;
  averageDailyCost: number;
  period?: "day" | "week" | "month";
  onPeriodChange?: (period: "day" | "week" | "month") => void;
  previousPeriodCost?: number;
  budget?: number;
}

export function CostEstimationWidget({
  currentCost,
  projectedCost,
  averageDailyCost,
  period = "month",
  onPeriodChange,
  previousPeriodCost,
  budget,
}: CostEstimationWidgetProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  // Calculate trend
  const trend = previousPeriodCost
    ? ((currentCost - previousPeriodCost) / previousPeriodCost) * 100
    : 0;
  const isIncreasing = trend > 0;

  // Calculate budget usage
  const budgetUsage = budget ? (currentCost / budget) * 100 : 0;
  const projectedBudgetUsage = budget ? (projectedCost / budget) * 100 : 0;

  // Period labels
  const periodLabels = {
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
  };

  const handlePeriodChange = (value: string) => {
    const newPeriod = value as "day" | "week" | "month";
    setSelectedPeriod(newPeriod);
    onPeriodChange?.(newPeriod);
  };

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800 shadow-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Cost Estimation</h3>
            <p className="text-sm text-muted-foreground">
              AI token usage costs
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Current Cost with Trend */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Current {periodLabels[selectedPeriod]} Cost
            </p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {formatCost(currentCost)}
            </p>
          </div>
          {previousPeriodCost !== undefined && (
            <div className="flex items-center gap-1">
              {isIncreasing ? (
                <ArrowUp className="w-4 h-4 text-red-500" />
              ) : (
                <ArrowDown className="w-4 h-4 text-green-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  isIncreasing ? "text-red-500" : "text-green-500"
                }`}
              >
                {Math.abs(trend).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Budget Progress */}
        {budget && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Budget Usage</span>
              <span>
                {formatCost(currentCost)} / {formatCost(budget)}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  budgetUsage > 80
                    ? "bg-red-500"
                    : budgetUsage > 60
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(budgetUsage, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Projected Cost */}
        <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">
              Projected {periodLabels[selectedPeriod]}
            </span>
          </div>
          <p className="text-xl font-semibold">{formatCost(projectedCost)}</p>
          {budget && projectedBudgetUsage > 100 && (
            <p className="text-xs text-red-500 mt-1">
              Over budget by {formatCost(projectedCost - budget)}
            </p>
          )}
        </div>

        {/* Daily Average */}
        <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Daily Average</span>
          </div>
          <p className="text-xl font-semibold">
            {formatCost(averageDailyCost)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ~{Math.round(averageDailyCost * 30)} tokens/month
          </p>
        </div>
      </div>

      {/* Cost Breakdown by Model */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium">Cost Projections</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Next Day</span>
            <Badge variant="outline">{formatCost(averageDailyCost)}</Badge>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Next Week</span>
            <Badge variant="outline">{formatCost(averageDailyCost * 7)}</Badge>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Next Month</span>
            <Badge variant="outline">{formatCost(averageDailyCost * 30)}</Badge>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Annual (projected)</span>
            <Badge variant="outline">
              {formatCost(averageDailyCost * 365)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p>
              Costs are calculated based on Google Gemini pricing. Actual costs
              may vary based on model selection and usage patterns.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}