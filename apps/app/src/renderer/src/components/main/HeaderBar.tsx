import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  MicIcon,
  SettingsIcon,
  PinIcon,
  PinOffIcon,
  MinusIcon,
  XIcon,
  Rows,
  MonitorIcon,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface HeaderBarProps {
  isAlwaysOnTop: boolean;
  toggleAlwaysOnTop: () => void;
  minimizeWindow: () => void;
  closeWindow: () => void;
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
  onToggleTranscriptionWindow: () => void;
  isTranscriptionWindowVisible: boolean;
}

export function HeaderBar({
  isAlwaysOnTop,
  toggleAlwaysOnTop,
  minimizeWindow,
  closeWindow,
  isScreenSharing,
  onToggleScreenShare,
  onToggleTranscriptionWindow,
  isTranscriptionWindowVisible
}: HeaderBarProps) {
  const { t } = useI18n();
  const [isFeaturesVisible, setIsFeaturesVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isScreenPreviewVisible, setIsScreenPreviewVisible] = useState(false);
  const [mainBounds, setMainBounds] = useState<DOMRect | null>(null);

  useEffect(() => {
    const fetchBounds = async () => {
      if (window.electronAPI) {
        const bounds = await window.electronAPI.getMainWindowBounds();
        setMainBounds(bounds);
      }
    };
    fetchBounds();
  }, []);

  const handleToggleFeatures = () => {
    console.log('Toggling features popover');
    if (isFeaturesVisible) {
      window.electronAPI.send('popover:close', 'features');
    } else {
      if (mainBounds) {
        window.electronAPI.invoke('popover:create', { 
          id: 'features', 
          width: 200, 
          height: 200, 
          x: mainBounds.x + Math.round((mainBounds.width - 200) / 2),
          y: mainBounds.y + mainBounds.height + 8,
          hash: 'features' 
        });
      }
    }
    setIsFeaturesVisible(!isFeaturesVisible);
  }
  const handleToggleSettings = () => {
    console.log('Toggling settings popover');
    if (isSettingsVisible) {
      window.electronAPI.send('popover:close', 'settings');
    } else {
      if (mainBounds) {
        window.electronAPI.invoke('popover:create', { 
          id: 'settings', 
          width: 280, 
          height: 300, 
          x: mainBounds.x + Math.round((mainBounds.width - 280) / 2),
          y: mainBounds.y + mainBounds.height + 8,
          hash: 'settings' 
        });
      }
    }
    setIsSettingsVisible(!isSettingsVisible);
  }
  const handleToggleScreenPreview = () => {
    console.log('Toggling screen preview popover');
    if (isScreenPreviewVisible) {
      window.electronAPI.send('popover:close', 'screen-preview');
    } else {
      if (mainBounds) {
        window.electronAPI.invoke('popover:create', { 
          id: 'screen-preview', 
          width: 480, 
          height: 300, 
          x: mainBounds.x + Math.round((mainBounds.width - 480) / 2),
          y: mainBounds.y + mainBounds.height + 8,
          hash: 'screen-preview' 
        });
      }
    }
    setIsScreenPreviewVisible(!isScreenPreviewVisible);
  }

  return (
    <header 
      className="flex items-center justify-between p-1 bg-muted/10 rounded-full w-full h-full"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Button
          variant={isScreenPreviewVisible ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={handleToggleScreenPreview}
        >
          <MonitorIcon className="h-4 w-4" />
        </Button>
        <Button
          variant={isScreenSharing ? "destructive" : "default"}
          size="sm"
          onClick={onToggleScreenShare}
          className="h-8 rounded-full px-4 text-xs"
        >
          <MicIcon className="h-3 w-3 mr-1" />
          {isScreenSharing ? "Stop" : "Listen"}
        </Button>

        {isScreenSharing && (
          <Button
            variant={isTranscriptionWindowVisible ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleTranscriptionWindow}
            className="h-8 rounded-full px-4 text-xs"
          >
            Transcriptions
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Button variant={isFeaturesVisible ? "secondary" : "ghost"} size="icon" className="h-8 w-8 rounded-full" onClick={handleToggleFeatures}>
          <Rows className="h-4 w-4" />
        </Button>
        <Button variant={isSettingsVisible ? "secondary" : "ghost"} size="icon" className="h-8 w-8 rounded-full" onClick={handleToggleSettings}>
          <SettingsIcon className="h-4 w-4" />
        </Button>

        {/* Window Controls */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={toggleAlwaysOnTop}
          title={isAlwaysOnTop ? t("unpinWindowTooltip") : t("pinWindowTooltip")}
        >
          {isAlwaysOnTop ? <PinOffIcon size={14} /> : <PinIcon size={14} />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={minimizeWindow}
          title={t("minimizeWindowTooltip")}
        >
          <MinusIcon size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-destructive/80"
          onClick={closeWindow}
          title={t("closeWindowTooltip")}
        >
          <XIcon size={14} />
        </Button>
      </div>
    </header>
  );
}