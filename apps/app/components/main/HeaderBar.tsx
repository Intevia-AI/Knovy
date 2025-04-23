import React from 'react';
import { Button } from "@workspace/ui/components/button";
import { MinusIcon, XIcon, PinIcon, PinOffIcon } from "lucide-react";

interface HeaderBarProps {
  isAlwaysOnTop: boolean;
  toggleAlwaysOnTop: () => void;
  minimizeWindow: () => void;
  closeWindow: () => void;
}

export function HeaderBar({
  isAlwaysOnTop,
  toggleAlwaysOnTop,
  minimizeWindow,
  closeWindow,
}: HeaderBarProps) {
  return (
    <header className="fixed h-6 bg-muted overflow-hidden rounded-t-lg top-0 left-0 right-0 z-10 border-b border-border flex items-center justify-between">
      {/* Draggable Region */}
      <div
        className="flex-grow h-full"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      ></div>
      {/* Window Controls */}
      <div className="flex items-center h-full mr-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20"
          onClick={toggleAlwaysOnTop}
          aria-label={isAlwaysOnTop ? "Disable always on top" : "Enable always on top"}
          title={isAlwaysOnTop ? "取消置頂" : "視窗置頂"} // Tooltip
        >
          {isAlwaysOnTop ? (
            <PinOffIcon className="h-3 w-3" />
          ) : (
            <PinIcon className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20"
          onClick={minimizeWindow}
          aria-label="Minimize window"
           title="最小化" // Tooltip
        >
          <MinusIcon className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-sm hover:bg-destructive/80 hover:text-destructive-foreground"
          onClick={closeWindow}
          aria-label="Close window"
           title="關閉" // Tooltip
        >
          <XIcon className="h-3 w-3" />
        </Button>
      </div>
    </header>
  );
}
