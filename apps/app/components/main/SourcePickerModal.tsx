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
      <div className="bg-card p-3 rounded-lg shadow-xl max-w-xs w-full">
        <h3 className="text-sm font-semibold mb-2 text-card-foreground">
          選擇分享來源
        </h3>
        <div className="max-h-40 overflow-y-auto space-y-1 mb-2 border rounded p-1.5 bg-background">
          {sources.length > 0 ? (
            sources.map((source) => (
              <button
                key={source.id}
                onClick={() => onSelect(source.id)}
                className="w-full text-left p-1.5 rounded hover:bg-primary hover:text-primary-foreground transition-colors text-xs bg-muted/50 border border-border/50"
                title={`分享 ${source.name}`}
              >
                {source.name}
              </button>
            ))
          ) : (
            <p className="text-muted-foreground text-xs text-center py-2">
              正在搜尋可用的分享來源...
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCancel} 
            className="text-xs bg-muted/50 hover:bg-muted/80"
          >
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
