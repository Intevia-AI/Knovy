import { useState, useCallback, useRef, useEffect } from 'react';
import { Message } from 'ai';
import type { Segment, AIContextData } from '@/types';
import { blobToBase64 } from '@/lib/utils';

// Constants
const API_URL = "http://localhost:3001/api/ai";

type AIAction = "real-time" | "answer" | "summary" | "search" | "custom" | "find-clue";

interface UseAIInteractionProps {
  micSegments: Segment[]; // Array of completed mic segments
  systemAudioSegments: Segment[]; // Array of completed system segments
  currentMicChunksRef: React.RefObject<Blob[]>; // Ref to current mic chunks
  systemAudioChunksRef: React.RefObject<Blob[]>; // Ref to current system chunks
  micMimeType: string;
  systemAudioMimeType: string;
  isScreenSharing: boolean;
}

export function useAIInteraction({
  micSegments,
  systemAudioSegments,
  currentMicChunksRef,
  systemAudioChunksRef,
  micMimeType,
  systemAudioMimeType,
  isScreenSharing,
}: UseAIInteractionProps) {
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [aiMessages]);

  // Function to gather context from recent audio segments AND current chunks
  const gatherContext = useCallback(async (): Promise<AIContextData | null> => {
    console.log("[AIInteraction] Gathering context...");

    const audioInputs: AIContextData['audioInputs'] = [];

    // --- Process Mic Audio ---
    const currentMicChunks = currentMicChunksRef.current ?? [];
    const lastMicSegment = micSegments.length > 0 ? micSegments[micSegments.length - 1] : null;

    let micBlobToProcess: Blob | null = null;
    let micLabel = "";

    // Prioritize current chunks if they exist
    if (currentMicChunks.length > 0) {
      try {
        micBlobToProcess = new Blob(currentMicChunks, { type: micMimeType });
        micLabel = "mic-current";
        console.log(`[AIInteraction] Using current mic chunks, size: ${micBlobToProcess?.size}`);
      } catch (error) {
        console.error("[AIInteraction] Error creating blob from current mic chunks:", error);
        micBlobToProcess = null;
      }
    }

    // If no current chunks, use the last completed segment
    if (!micBlobToProcess && lastMicSegment) {
      micBlobToProcess = lastMicSegment.blob;
      micLabel = "mic-last-segment";
      console.log(`[AIInteraction] Using last completed mic segment, size: ${micBlobToProcess?.size}`);
    }

    // Convert selected mic blob to base64
    if (micBlobToProcess && micBlobToProcess.size > 0 && micMimeType) {
      try {
        const dataUrl = await blobToBase64(micBlobToProcess);
        const data = dataUrl.split(',')[1] || dataUrl;
        audioInputs.push({ data, mimeType: micMimeType, label: micLabel });
        console.log(`[AIInteraction] Added ${micLabel} (${data.length} base64 chars) to context.`);
      } catch (error) {
        console.error(`[AIInteraction] Error processing mic blob (${micLabel}):`, error);
      }
    } else {
      console.log("[AIInteraction] No valid mic audio data found for context.");
    }

    // --- Process System Audio ---
    const currentSystemChunks = systemAudioChunksRef.current ?? [];
    const lastSystemSegment = systemAudioSegments.length > 0 ? systemAudioSegments[systemAudioSegments.length - 1] : null;

    let systemBlobToProcess: Blob | null = null;
    let systemLabel = "";

    // Prioritize current chunks
    if (currentSystemChunks.length > 0) {
      try {
        systemBlobToProcess = new Blob(currentSystemChunks, { type: systemAudioMimeType });
        systemLabel = "system-current";
        console.log(`[AIInteraction] Using current system chunks, size: ${systemBlobToProcess?.size}`);
      } catch (error) {
        console.error("[AIInteraction] Error creating blob from current system chunks:", error);
        systemBlobToProcess = null;
      }
    }

    // Fallback to last completed segment
    if (!systemBlobToProcess && lastSystemSegment) {
      systemBlobToProcess = lastSystemSegment.blob;
      systemLabel = "system-last-segment";
      console.log(`[AIInteraction] Using last completed system segment, size: ${systemBlobToProcess?.size}`);
    }

    // Convert selected system blob to base64
    if (systemBlobToProcess && systemBlobToProcess.size > 0 && systemAudioMimeType) {
      try {
        const dataUrl = await blobToBase64(systemBlobToProcess);
        const data = dataUrl.split(',')[1] || dataUrl;
        audioInputs.push({ data, mimeType: systemAudioMimeType, label: systemLabel });
        console.log(`[AIInteraction] Added ${systemLabel} (${data.length} base64 chars) to context.`);
      } catch (error) {
        console.error(`[AIInteraction] Error processing system blob (${systemLabel}):`, error);
      }
    } else {
      console.log("[AIInteraction] No valid system audio data found for context.");
    }

    // --- Return Context ---
    if (audioInputs.length === 0) {
      console.warn("[AIInteraction] No audio inputs gathered for context.");
      return null;
    }

    return { audioInputs };
  }, [
    micSegments,
    systemAudioSegments,
    currentMicChunksRef,
    systemAudioChunksRef,
    micMimeType,
    systemAudioMimeType,
  ]); // Dependencies updated

  // Function to send context and prompt to the AI backend
  const sendContextToAI = useCallback(async (action: AIAction, query?: string) => {
    if (isLoading || !isScreenSharing) {
      console.warn("AI request blocked: Not sharing or already loading.");
      return;
    }
    setIsLoading(true);
    console.log(`Sending AI request. Action: ${action}, Custom Query: ${query}`);

    const context = await gatherContext(); // Calls the updated gatherContext

    if (!context?.audioInputs || context.audioInputs.length === 0) {
      console.warn("AI request cancelled: No context gathered.");
      setAiMessages((prev) => [
        ...prev,
        {
          id: `err-no-ctx-${Date.now()}`,
          role: "assistant",
          content: "[提示] 沒有足夠的近期音訊可供分析。",
        },
      ]);
      setIsLoading(false);
      return;
    }

    const promptMap: Record<AIAction, string> = {
      "real-time": "轉錄最新的語音內容，並識別其中提到的關鍵點、關鍵字或待辦事項。",
      answer: "根據最近音訊中的對話內容，回答音訊中最後提出的問題。區分麥克風和系統音訊來源。有必要請上網查詢。",
      summary: "提供最近音訊片段中捕捉到的對話內容的簡明摘要（區分麥克風和系統音訊）。請用中文回答。",
      search: "根據最近音訊片段中討論的主題，建議相關的搜尋關鍵字或查找相關資訊（區分麥克風和系統音訊）。請用中文回答。",
      "find-clue": "根據最近的音訊內容，找出其中可能存在的線索、疑點或需要進一步探討的資訊（區分麥克風和系統音訊）。請用中文回答。",
      custom: query || "根據以下要求分析最近音訊片段中捕捉到的對話內容。請用中文回答。",
    };

    const displayPromptMap: Record<AIAction, string> = {
      "real-time": "即時轉錄",
      answer: "根據語音內容回答問題",
      summary: "根據過去語音內容產生摘要",
      search: "根據語音內容搜尋主題",
      "find-clue": "根據語音內容找尋線索",
      custom: customPrompt || "自訂請求",
    };

    const userMsgContent = action === "custom" ? customPrompt : promptMap[action];
    const displayMsgContent = action === "custom" ? customPrompt : displayPromptMap[action];

    const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: userMsgContent };
    const displayMsg: Message = { id: `disp-${userMsg.id}`, role: "user", content: displayMsgContent };

    if (action !== "real-time") {
      setAiMessages((prev) => [...prev, displayMsg]);
    }
    if (action === "custom") setCustomPrompt("");

    try {
      console.log("Sending request to AI API:", API_URL);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [userMsg], data: context }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`AI API Error (${res.status}): ${errorText}`);
      }

      const aiResponse: Message = await res.json();
      console.log("Received AI response:", aiResponse);
      setAiMessages((prev) => [
        ...prev,
        {
          id: aiResponse.id || `ai-${Date.now()}`,
          role: "assistant",
          content: aiResponse.content || "[AI 回應為空]",
        },
      ]);
    } catch (e: unknown) {
      console.error("AI request failed:", e);
      setAiMessages((prev) => [
        ...prev,
        {
          id: `err-ai-${Date.now()}`,
          role: "assistant",
          content: `[AI 錯誤] 無法處理您的請求: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      console.log("AI request finished.");
    }
  }, [
    isLoading,
    isScreenSharing,
    gatherContext, // Depends on the updated gatherContext
    customPrompt,
  ]);

  const handleTextResponse = useCallback((text: string) => {
    setAiMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content.startsWith("[即時轉錄]")) {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: lastMessage.content + text },
        ];
      } else {
        return [
          ...prev,
          { id: `realtime-${Date.now()}`, role: "assistant", content: `[即時轉錄] ${text}` },
        ];
      }
    });
  }, []);

  const handleKeywords = useCallback((newKeywords: string[]) => {
    setKeywords((prev) => {
      const uniqueNewKeywords = newKeywords.filter((k) => k && !prev.includes(k));
      if (uniqueNewKeywords.length > 0) {
        return [...prev, ...uniqueNewKeywords];
      }
      return prev;
    });
  }, []);

  const handleKeywordClick = useCallback(async (keyword: string) => {
    if (!keyword || isLoading) return;

    setSelectedKeyword(keyword);
    setIsLoading(true);
    console.log(`Fetching explanation for keyword: ${keyword}`);

    setAiMessages((prev) => [
      ...prev,
      { id: `user-kw-${Date.now()}`, role: "user", content: `解釋: ${keyword}` },
    ]);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `請用簡單易懂的方式解釋這個專業術語：${keyword}` }],
          data: {}, // No audio context needed
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Keyword Explanation Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const explanation = data.content || "[無法取得解釋]";

      setAiMessages((prev) => [
        ...prev,
        { id: `explanation-${Date.now()}`, role: "assistant", content: `[${keyword} 的解釋] ${explanation}` },
      ]);
    } catch (error) {
      console.error("取得關鍵字解釋時發生錯誤:", error);
      setAiMessages((prev) => [
        ...prev,
        { id: `err-explanation-${Date.now()}`, role: "assistant", content: `[錯誤] 無法取得 ${keyword} 的解釋: ${error instanceof Error ? error.message : String(error)}` },
      ]);
    } finally {
      setIsLoading(false);
      setSelectedKeyword(null);
      console.log(`Keyword explanation fetch finished for: ${keyword}`);
    }
  }, [isLoading]);

  const resetChat = useCallback(() => {
    setAiMessages([]);
    setKeywords([]);
    setCustomPrompt("");
    setIsLoading(false);
    setSelectedKeyword(null);
    console.log("Chat and keywords reset.");
  }, []);

  return {
    aiMessages,
    isLoading,
    customPrompt,
    setCustomPrompt,
    keywords,
    selectedKeyword,
    sendContextToAI,
    handleTextResponse,
    handleKeywords,
    handleKeywordClick,
    messagesContainerRef,
    resetChat,
  };
}
