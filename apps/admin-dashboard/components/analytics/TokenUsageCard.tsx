"use client";

import { Card } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Progress } from "@workspace/ui/components/progress";
import {
  Cpu,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Zap,
  MessageSquare,
  FileText,
  AlertCircle
} from "lucide-react";
import { formatTokenCount, formatCost } from "@/lib/analytics/token-utils";
import type { UserTokenSummary } from "@/lib/analytics/token-utils";

interface TokenUsageCardProps {
  summary: UserTokenSummary;
  userName?: string;
  period?: string;
  showDetails?: boolean;
}

export function TokenUsageCard({
  summary,
  userName,
  period = "Last 30 days",
  showDetails = true
}: TokenUsageCardProps) {
  // Calculate percentages for visualization
  const inputPercentage = summary.totalTokens > 0
    ? (summary.totalInputTokens / summary.totalTokens) * 100
    : 0;

  // Get top model
  const topModel = Array.from(summary.modelBreakdown.entries())
    .sort((a, b) => b[1].tokens.total - a[1].tokens.total)[0];

  // Get top feature
  const topFeature = Array.from(summary.featureBreakdown.entries())
    .sort((a, b) => b[1].total - a[1].total)[0];

  return (
    <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-500" />
            Token Usage
          </h3>
          {userName && (
            <p className="text-sm text-muted-foreground mt-1">{userName}</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          {period}
        </Badge>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Total Tokens */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Tokens</span>
            <Zap className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">{formatTokenCount(summary.totalTokens)}</p>
          <div className="flex gap-2 text-xs">
            <span className="text-muted-foreground">Input:</span>
            <span className="font-medium">{formatTokenCount(summary.totalInputTokens)}</span>
          </div>
        </div>

        {/* Total Cost */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Cost</span>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{formatCost(summary.totalCost)}</p>
          <div className="flex gap-2 text-xs">
            <span className="text-muted-foreground">Output:</span>
            <span className="font-medium">{formatTokenCount(summary.totalOutputTokens)}</span>
          </div>
        </div>
      </div>

      {/* Token Distribution Bar */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Input ({Math.round(inputPercentage)}%)</span>
          <span>Output ({Math.round(100 - inputPercentage)}%)</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          <div
            className="bg-blue-500 transition-all duration-300"
            style={{ width: `${inputPercentage}%` }}
          />
          <div
            className="bg-purple-500 transition-all duration-300"
            style={{ width: `${100 - inputPercentage}%` }}
          />
        </div>
      </div>

      {showDetails && (
        <>
          {/* Model Breakdown */}
          {summary.modelBreakdown.size > 0 && (
            <div className="space-y-3 mb-6">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Model Usage
              </h4>
              <div className="space-y-2">
                {Array.from(summary.modelBreakdown.entries())
                  .sort((a, b) => b[1].tokens.total - a[1].tokens.total)
                  .slice(0, 3)
                  .map(([model, metrics]) => (
                    <div key={model} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {model}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTokenCount(metrics.tokens.total)} tokens
                        </span>
                      </div>
                      <span className="text-xs font-medium">
                        {formatCost(metrics.totalCost)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Feature Breakdown */}
          {summary.featureBreakdown.size > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Feature Usage
              </h4>
              <div className="space-y-2">
                {Array.from(summary.featureBreakdown.entries())
                  .sort((a, b) => b[1].total - a[1].total)
                  .slice(0, 3)
                  .map(([feature, tokens]) => {
                    const percentage = (tokens.total / summary.totalTokens) * 100;
                    return (
                      <div key={feature} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{feature}</span>
                          <span className="font-medium">{formatTokenCount(tokens.total)}</span>
                        </div>
                        <Progress value={percentage} className="h-1" />
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Alert for high usage */}
          {summary.totalCost > 10 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-yellow-600 dark:text-yellow-400">
                    High token usage detected
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Consider optimizing prompts or caching responses to reduce costs.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}