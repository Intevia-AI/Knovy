import React, { useRef, useState, useEffect } from "react";
import { Message as AIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, Sparkles, ArrowDown } from "lucide-react";
import { Markdown } from "@/components/markdown"; // Adjust path if needed
import { cn } from "@/lib/utils"; // Adjust path if needed
import { useI18n } from "@/hooks/useI18n";

interface CustomMessage extends AIMessage {
  visible?: boolean;
}

interface ChatPanelProps {
  messages: CustomMessage[];
  isLoading: boolean;
  isScreenSharing: boolean;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  onSendMessage: (action: "custom", prompt: string) => void;
  messagesContainerRef?: React.RefObject<HTMLDivElement | null>;
  isSubtitleVisible?: boolean;
}

const FloatingMenu: React.FC<{
  x: number;
  y: number;
  onAskAI: () => void;
}> = ({ x, y, onAskAI }) => {
  const { t } = useI18n();
  return (
    <div
      className="fixed z-50 bg-background border border-border/30 rounded-lg shadow-lg p-1 chat-selection-menu-container"
      style={{
        left: x - 10,
        top: y - 60,
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onAskAI}
      >
        {t("askAIButton")}
      </Button>
    </div>
  );
};

export default function ChatPanel({
  messages,
  isLoading,
  isScreenSharing,
  customPrompt,
  setCustomPrompt,
  onSendMessage,
  isSubtitleVisible,
}: ChatPanelProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState("");
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const isScrolledToBottom =
        container.scrollHeight - container.clientHeight <=
        container.scrollTop + 100;
      if (isScrolledToBottom) {
        container.scrollTop = container.scrollHeight;
      }
      setShowScrollToBottom(!isScrolledToBottom);
    }
  }, [messages]);

  const handleTextSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    const targetElement = event.target as Element;
    if (targetElement.closest('.chat-selection-menu-container')) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === "") {
      if (menuPosition) console.log("[ChatPanel] Selection cleared or empty, hiding menu.");
      setMenuPosition(null);
      setSelectedText("");
      return;
    }
    
    const range = selection.getRangeAt(0);
    const messagesDiv = messagesContainerRef.current;

    if (messagesDiv && messagesDiv.contains(range.commonAncestorContainer)) {
        const currentSelectedText = selection.toString();
        console.log(`[ChatPanel] Text selected: "${currentSelectedText}"`);
        setSelectedText(currentSelectedText);
        const rect = range.getBoundingClientRect();
        setMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
    } else {
        if (menuPosition || selectedText) console.log("[ChatPanel] Selection outside messages or invalid, clearing selection.");
        setMenuPosition(null);
        setSelectedText("");
    }
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const targetElement = event.target as Element;
      if (menuPosition && !targetElement.closest('.chat-selection-menu-container')) {
        console.log("[ChatPanel] Click outside menu, clearing selection and hiding menu.");
        setMenuPosition(null);
        setSelectedText(""); 
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuPosition]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    const handleScroll = () => {
      if (container) {
        const isScrolledToBottom =
          container.scrollHeight - container.clientHeight <=
          container.scrollTop + 10;
        setShowScrollToBottom(!isScrolledToBottom);
      }
    };

    if (container) {
      container.addEventListener("scroll", handleScroll);
      handleScroll();
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const handleAskAI = () => {
    console.log(`[ChatPanel] handleAskAI called. Current selectedText: "${selectedText}"`);
    if (selectedText.trim()) {
      console.log(`[ChatPanel] selectedText is valid, sending to AI: "${selectedText}"`);
      onSendMessage("custom", selectedText);
      setMenuPosition(null);
      setSelectedText("");
    } else {
      console.warn(`[ChatPanel] handleAskAI: selectedText is empty or whitespace. Value: "${selectedText}"`);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customPrompt.trim() || isLoading || !isScreenSharing) return;
    onSendMessage("custom", customPrompt);
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  return (
    <aside className="flex flex-col h-full overflow-y-auto shrink-0 bg-card/10 relative">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onMouseUp={handleTextSelection}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "p-3 rounded-lg text-sm border border-border/30 w-fit max-w-[100%] whitespace-pre-wrap",
              m.role === "user"
                ? "bg-primary ml-auto text-primary-foreground"
                : "bg-muted mr-auto text-foreground",
              (m.content.startsWith("[即時轉錄]") &&
                !isSubtitleVisible &&
                "hidden") ||
                m.content.includes("search web"),
            )}
          >
            <Markdown>{m.content}</Markdown>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-border/30"></div>
          </div>
        )}
      </div>
      {menuPosition && selectedText.trim() && (
        <FloatingMenu
          x={menuPosition.x}
          y={menuPosition.y}
          onAskAI={handleAskAI}
        />
      )}
      {showScrollToBottom && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-20 right-4 rounded-full h-10 w-10 border-border/50 bg-background/80 hover:bg-background"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-5 w-5" />
        </Button>
      )}

      <div className="flex-none p-2 border-t border-border/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={
              isScreenSharing ? t("chatPlaceholderSharing") : t("chatPlaceholderNotSharing")
            }
            className="flex-grow h-7 text-xs"
            disabled={isLoading || !isScreenSharing}
            aria-label="Custom prompt input"
          />
          <Button
            type="submit"
            variant="default"
            size="icon"
            disabled={isLoading || !isScreenSharing || !customPrompt.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 w-7"
            aria-label={t("sendChatButtonLabel")}

          >
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
