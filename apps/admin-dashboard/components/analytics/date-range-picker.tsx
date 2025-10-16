"use client";

import { useState, useCallback } from "react";
import { DateRangePicker, DateRangePickerValue } from "@tremor/react";
import { DateRange } from "@/lib/analytics/types";

interface DateRangePickerProps {
  onChange: (range: DateRange) => void;
  defaultValue?: DateRange;
  className?: string;
}

export function AnalyticsDateRangePicker({
  onChange,
  defaultValue,
  className,
}: DateRangePickerProps) {
  const [value, setValue] = useState<DateRangePickerValue>({
    from: defaultValue?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: defaultValue?.to || new Date(),
  });

  const handleChange = useCallback(
    (newValue: DateRangePickerValue) => {
      setValue(newValue);
      if (newValue.from && newValue.to) {
        onChange({
          from: newValue.from,
          to: newValue.to,
        });
      }
    },
    [onChange],
  );

  // Preset ranges
  const presetRanges = [
    {
      label: "Last 7 days",
      getValue: () => ({
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        to: new Date(),
      }),
    },
    {
      label: "Last 14 days",
      getValue: () => ({
        from: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        to: new Date(),
      }),
    },
    {
      label: "Last 30 days",
      getValue: () => ({
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date(),
      }),
    },
    {
      label: "Last 90 days",
      getValue: () => ({
        from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        to: new Date(),
      }),
    },
    {
      label: "This month",
      getValue: () => {
        const now = new Date();
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1),
          to: now,
        };
      },
    },
    {
      label: "Last month",
      getValue: () => {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return {
          from: lastMonth,
          to: new Date(now.getFullYear(), now.getMonth(), 0),
        };
      },
    },
  ];

  return (
    <div className={className}>
      <DateRangePicker
        value={value}
        onValueChange={handleChange}
        placeholder="Select date range"
        enableYearNavigation={true}
        minDate={new Date(2024, 0, 1)} // Jan 1, 2024
        maxDate={new Date()}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {presetRanges.map((range) => (
          <button
            key={range.label}
            onClick={() => handleChange(range.getValue())}
            className="text-xs px-2 py-1 rounded-md bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle
                     hover:bg-tremor-background-muted dark:hover:bg-dark-tremor-background-muted
                     text-tremor-content dark:text-dark-tremor-content transition-colors"
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
}
