import React from "react";
import { Button } from "@workspace/ui/components/button";
import {
  MinusIcon,
  XIcon,
  PinIcon,
  PinOffIcon,
  SunIcon,
  MoonIcon,
  Maximize,
  Minimize,
  Rows,
  Columns,
  LogInIcon,
  LogOutIcon,
  Loader2,
} from "lucide-react";

import { useI18n } from "@/hooks/useI18n";
import { Logo } from "../logo.js";
import { useAuth } from "@/context/AuthContext";

interface HeaderBarProps {
  isAlwaysOnTop: boolean;
  toggleAlwaysOnTop: () => void;
  minimizeWindow: () => void;
  closeWindow: () => void;
  layoutDirection: "horizontal" | "vertical";
  toggleLayoutDirection: () => void;
}

export function HeaderBar({
  isAlwaysOnTop,
  toggleAlwaysOnTop,
  minimizeWindow,
  closeWindow,
  layoutDirection,
  toggleLayoutDirection,
}: HeaderBarProps) {
  const { t } = useI18n();
  const { user, session, isLoading, signInWithProvider, signOut } = useAuth();

  const handleLogin = async () => {
    await signInWithProvider("google");
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header className="fixed h-7 bg-muted/10 overflow-hidden rounded-t-lg top-0 left-0 right-0 z-10 border-b border-border/30 flex items-center justify-between">
      {/* Draggable Region */}
      <div
        className="flex-grow h-full pl-2 flex items-center"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="text-xs font-medium">
          Intevia AI
        </span>
      </div>
      {/* Auth Controls - Placed before window controls for now */}
      <div className="flex items-center h-full mr-1 space-x-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {isLoading ? (
          <Button variant="ghost" size="icon" className="h-5 w-5 rounded-sm animate-spin" disabled>
            <Loader2 size={12} />
          </Button>
        ) : user ? (
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20"
            title="Logout"
          >
            <LogOutIcon size={12} />
          </Button>
        ) : (
          <Button
            onClick={handleLogin}
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20"
            title="Login with Google"
          >
            <LogInIcon size={12} />
          </Button>
        )}
      </div>
      {/* Separator - Optional visually */}
      {/* <div className="h-4 w-px bg-border/50 mx-1"></div> */}
      {/* Window Controls */}
      <div
        className="flex items-center h-full mr-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Button
          onClick={toggleLayoutDirection}
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20"
          title={layoutDirection === "vertical" ? "Switch to Horizontal Layout" : "Switch to Vertical Layout"}
        >
          {layoutDirection === "vertical" ? (
            <Columns size={12} />
          ) : (
            <Rows size={12} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20"
          onClick={toggleAlwaysOnTop}
          aria-label={
            isAlwaysOnTop ? t("unpinWindowTooltip") : t("pinWindowTooltip")
          }
          title={
            isAlwaysOnTop ? t("unpinWindowTooltip") : t("pinWindowTooltip")
          }
        >
          {isAlwaysOnTop ? (
            <PinOffIcon size={12} />
          ) : (
            <PinIcon size={12} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20"
          onClick={minimizeWindow}
          aria-label="Minimize window"
          title={t("minimizeWindowTooltip")}
        >
          <MinusIcon size={12} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-sm hover:bg-destructive/80 hover:text-destructive-foreground"
          onClick={closeWindow}
          aria-label="Close window"
          title={t("closeWindowTooltip")}
        >
          <XIcon size={12} />
        </Button>
      </div>
    </header>
  );
}
