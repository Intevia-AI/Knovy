import { Button } from "@/components/ui/button";
import type { ElectronSource } from "@/types";
import { useI18n } from "@/hooks/useI18n";

interface SourcePickerModalProps {
  sources: ElectronSource[];
  onSelect: (sourceId: string) => void;
  onCancel: () => void;
}

export function SourcePickerModal({
  sources,
}: SourcePickerModalProps) {
  const { t } = useI18n();

  const onSelect = (sourceId: string) => {
    window.electronAPI.send('source-picker:select', sourceId);
  };

  const onCancel = () => {
    window.electronAPI.send('source-picker:cancel');
  };


  return (
    <div className="bg-background p-4 rounded-lg shadow-lg">
      <h2 className="text-sm font-medium mb-2">{t("sourcePickerTitle")}</h2>
      <div className="max-h-60 overflow-y-auto space-y-1 p-1.5 bg-background border rounded">
        {sources.length > 0 ? (
          sources.map((source) => (
            <button
              key={source.id}
              onClick={() => onSelect(source.id)}
              className="w-full text-left p-1.5 rounded hover:bg-primary hover:text-primary-foreground transition-colors text-xs bg-muted/50 border border-border/50"
              title={`${t("sourcePickerShareSourceTooltipPrefix")} ${source.name}`}
            >
              {source.name}
            </button>
          ))
        ) : (
          <p className="text-muted-foreground text-xs text-center py-4">
            {t("sourcePickerSearching")}
          </p>
        )}
      </div>
      <div className="flex justify-end mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-xs"
        >
          {t("cancelButton")}
        </Button>
      </div>
    </div>
  );
}
