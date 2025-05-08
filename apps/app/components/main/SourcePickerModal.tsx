import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog";
import type { ElectronSource } from "@/types";
import { useI18n } from "@/hooks/useI18n";

interface SourcePickerModalProps {
  show: boolean;
  sources: ElectronSource[];
  onSelect: (sourceId: string) => void;
  onCancel: () => void;
}

export function SourcePickerModal({
  show,
  sources,
  onSelect,
  onCancel,
}: SourcePickerModalProps) {
  const { t } = useI18n();

  return (
    <Dialog open={show} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t("sourcePickerTitle")}
          </DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-xs"
          >
            {t("cancelButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
