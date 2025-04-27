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
    <div className="flex flex-col h-full">
      <div
        ref={messagesContainerRef}
        className="flex-1 p-4 space-y-4 overflow-y-auto bg-muted/30"
      >
        {messages.map((m) => {
          console.log(`[ChatPanel] 渲染消息:`, {
            id: m.id,
            content: m.content,
            visible: m.visible,
            isTranscription: m.content.startsWith("[即時轉錄]"),
            shouldHide: m.content.startsWith("[即時轉錄]") && !m.visible
          });
          return (
            <div
              key={m.id}
              className={cn(
                "p-3 rounded-lg text-sm border w-fit max-w-[85%] whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary ml-auto text-primary-foreground"
                  : "bg-muted mr-auto text-foreground",
                (m.content.startsWith("[即時轉錄]") && !m.visible && "hidden") || m.content.includes("search web")  // 只有轉錄訊息才檢查 visible 屬性
              )}
            >
              <Markdown>{m.content}</Markdown>
            </div>
          );
        })}
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center justify-center text-sm text-muted-foreground p-2">
            <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
            處理中，請稍候...
          </div>
        )}
        {/* Initial State Messages */}
        {messages.length === 0 && !isLoading && !isScreenSharing && (
          <p className="text-sm text-center text-muted-foreground py-4">
            點擊「分享螢幕」以啟動 AI 助理並開始錄製。
          </p>
        )}
        {messages.length === 0 && !isLoading && isScreenSharing && (
          <p className="text-sm text-center text-muted-foreground py-4">
            錄製中... AI 分析將在處理音訊後顯示。
          </p>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-border">
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
             title="傳送" // Tooltip
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
