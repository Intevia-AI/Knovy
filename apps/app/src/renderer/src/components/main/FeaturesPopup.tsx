import React from "react";
import { Button } from "@/components/ui/button";
import { ListCollapseIcon, CameraIcon } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { AIAction } from "@/hooks/useAIInteraction";

interface FeaturesPopupProps {
  onAiAction: (action: AIAction) => void;
  isScreenSharing: boolean;
  onShowHistory: () => void;
}

export function FeaturesPopup({ onAiAction, isScreenSharing, onShowHistory }: FeaturesPopupProps) {
  const { t } = useI18n();

  const features = [
    { action: "summary", labelKey: "aiActionSummary", icon: ListCollapseIcon },
    { action: "screenshot", labelKey: "aiActionScreenshot", icon: CameraIcon },
  ] as const;

  return (
    <div className="grid gap-2 p-2">
      <h4 className="font-medium leading-none px-2 py-1.5 text-sm">Features</h4>
      {features.map(({ action, labelKey, icon: Icon }) => (
        <Button
          key={action}
          variant="ghost"
          size="sm"
          disabled={!isScreenSharing}
          onClick={() => onAiAction(action)}
          className="w-full justify-start"
        >
          <Icon className="mr-2 h-4 w-4" />
          {t(labelKey as any)}
        </Button>
      ))}
       <Button
          variant="ghost"
          size="sm"
          onClick={onShowHistory}
          className="w-full justify-start"
        >
          <ListCollapseIcon className="mr-2 h-4 w-4" />
          View History
        </Button>
    </div>
  );
}