"use client";

import { useState } from "react";
import { Button } from "@tremor/react";
import { Download, FileDown, CheckCircle } from "lucide-react";

interface ExportButtonProps {
  data: any;
  filename?: string;
  format?: "json" | "csv";
  className?: string;
}

export function ExportButton({
  data,
  filename = "analytics-export",
  format = "json",
  className,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) return "";

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(",");

    // Convert data rows
    const csvRows = data.map((row) => {
      return headers
        .map((header) => {
          const value = row[header];
          // Escape commas and quotes in values
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? "";
        })
        .join(",");
    });

    return [csvHeaders, ...csvRows].join("\n");
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      let content: string;
      let mimeType: string;
      let fileExtension: string;

      if (format === "csv") {
        content = Array.isArray(data) ? convertToCSV(data) : convertToCSV([data]);
        mimeType = "text/csv";
        fileExtension = "csv";
      } else {
        content = JSON.stringify(data, null, 2);
        mimeType = "application/json";
        fileExtension = "json";
      }

      // Create blob and download link
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}-${new Date().toISOString().split("T")[0]}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting || !data}
      size="xs"
      variant="secondary"
      className={className}
    >
      {exported ? (
        <>
          <CheckCircle className="w-4 h-4 mr-1" />
          Exported
        </>
      ) : isExporting ? (
        <>
          <FileDown className="w-4 h-4 mr-1 animate-pulse" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-1" />
          Export {format.toUpperCase()}
        </>
      )}
    </Button>
  );
}
