import React, { useRef, useState, useEffect } from "react";
import { Message as AIMessage } from "ai";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { ArrowUpRight } from "lucide-react";
import { Markdown } from "@/components/markdown"; // Adjust path if needed
import { cn } from "@workspace/ui/lib/utils"; // Adjust path if needed

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
}

export default function ChatPanel({
  messages,
  isLoading,
  isScreenSharing,
  customPrompt,
  setCustomPrompt,
  onSendMessage,
}: ChatPanelProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const isScrolledToBottom =
        container.scrollHeight - container.clientHeight <=
        container.scrollTop + 100; // Add a threshold
      if (isScrolledToBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customPrompt.trim() || isLoading || !isScreenSharing) return;
    onSendMessage("custom", customPrompt);
    // Input clearing is handled by the hook now
  };

  return (
    <aside className="flex flex-col h-full overflow-y-auto shrink-0 bg-card/10">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "p-3 rounded-lg text-sm border border-border/30 w-fit max-w-[100%] whitespace-pre-wrap",
              m.role === "user"
                ? "bg-primary ml-auto text-primary-foreground"
                : "bg-muted mr-auto text-foreground",
              (m.content.startsWith("[即時轉錄]") && !m.visible && "hidden") ||
                m.content.includes("search web")
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
      <div className="flex-none p-4 border-t border-border/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={
              isScreenSharing ? "輸入自訂提示或問題…" : "請先開始分享螢幕"
            }
            className="flex-grow"
            disabled={isLoading || !isScreenSharing}
            aria-label="Custom prompt input"
          />
          <Button
            type="submit"
            variant="default"
            size="icon"
            disabled={isLoading || !isScreenSharing || !customPrompt.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-9"
            aria-label="Send custom prompt"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
