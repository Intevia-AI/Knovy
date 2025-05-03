import React, { useRef, useState } from 'react';
import { Message as AIMessage } from 'ai';
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Loader2Icon, SendIcon } from "lucide-react";
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customPrompt.trim() || isLoading || !isScreenSharing) return;
    onSendMessage("custom", customPrompt);
    // Input clearing is handled by the hook now
  };

  return (
    <div className="flex flex-col h-full w-[300px] border-l border-border overflow-hidden bg-card">
      {/* <div className="flex-none p-4 border-b border-border">
        <h2 className="text-lg font-semibold">對話記錄</h2>
      </div> */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "p-3 rounded-lg text-sm border w-fit max-w-[85%] whitespace-pre-wrap",
              m.role === "user"
                ? "bg-primary ml-auto text-primary-foreground"
                : "bg-muted mr-auto text-foreground",
              (m.content.startsWith("[即時轉錄]") && !m.visible && "hidden") || m.content.includes("search web")
            )}
          >
            <Markdown>{m.content}</Markdown>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
      <div className="flex-none p-4 border-t border-border">
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
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            aria-label="Send custom prompt"
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
