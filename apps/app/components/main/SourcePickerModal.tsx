import React from 'react';
import { Button } from "@workspace/ui/components/button";
import type { ElectronSource } from '@/types';

interface SourcePickerModalProps {
  show: boolean;
  sources: ElectronSource[];
  onSelect: (sourceId: string) => void;
  onCancel: () => void;
}

export function SourcePickerModal({ show, sources, onSelect, onCancel }: SourcePickerModalProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4 text-card-foreground">
          選擇要分享的畫面或視窗
        </h3>
        <div className="max-h-60 overflow-y-auto space-y-2 mb-4 border rounded p-2 bg-background">
          {sources.length > 0 ? (
            sources.map((source) => (
              <button
                key={source.id}
                onClick={() => onSelect(source.id)}
                className="w-full text-left p-2 rounded hover:bg-muted transition-colors text-sm"
                title={`分享 ${source.name}`} // Tooltip
              >
                {source.name}
              </button>
            ))
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">
              正在搜尋可用的分享來源...
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
