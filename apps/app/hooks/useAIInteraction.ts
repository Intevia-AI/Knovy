import { useState, useCallback, useRef, useEffect } from 'react';
import { Message as AIMessage } from 'ai';
import type { Segment } from '@/types';
import { blobToBase64 } from '@/lib/utils';

// Constants
const API_URL = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:3000/api/ai";

type AIAction = "real-time" | "answer" | "summary" | "search" | "custom" | "find-clue";

interface TranscriptionMessage extends AIMessage {
  timestamp: number;
  type: 'transcription';
}

interface AIContextData {
  text?: string;
  timestamp?: number;
}

interface UseAIInteractionProps {
  micSegments: Segment[]; // Array of completed mic segments
  systemAudioSegments: Segment[]; // Array of completed system segments
  currentMicChunksRef: React.RefObject<Blob[]>; // Ref to current mic chunks
  systemAudioChunksRef: React.RefObject<Blob[]>; // Ref to current system chunks
  micMimeType: string;
  systemAudioMimeType: string;
  isScreenSharing: boolean;
}

interface CustomMessage extends AIMessage {
  visible?: boolean;
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
  const [aiMessages, setAiMessages] = useState<CustomMessage[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const accumulatedTextRef = useRef("");
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true);

  // Log transcriptions every 10 seconds
  useEffect(() => {
    const logTranscriptions = () => {
      if (transcriptions.length > 0) {
        console.log('\n=== 轉錄對話記錄 ===');
        console.log(`總共 ${transcriptions.length} 條轉錄`);
        console.log('-------------------');
        transcriptions.forEach((t, index) => {
          const time = new Date(t.timestamp).toLocaleTimeString();
          console.log(`[${index + 1}] [${time}] ${t.content}`);
        });
        console.log('===================\n');
      }
    };

    // 立即執行一次
    logTranscriptions();

    // 設置定時器
    const interval = setInterval(logTranscriptions, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [transcriptions]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [aiMessages]);

  // Function to gather context from transcriptions
  const gatherContext = useCallback(async (): Promise<AIContextData | null> => {
    console.log("[AIInteraction] Gathering context from transcriptions...");
    
    if (transcriptions.length === 0) {
      console.log("[AIInteraction] No transcriptions available");
      return null;
    }

    // Get the last 5 transcriptions or all if less than 5
    const recentTranscriptions = transcriptions.slice(-5);
    const contextText = recentTranscriptions
      .map(t => t.content)
      .join('\n');

    console.log("[AIInteraction] Context text:", contextText);
    
    return {
      text: contextText,
      timestamp: Date.now()
    };
  }, [transcriptions]);

  // Function to send context and prompt to the AI backend
  const sendContextToAI = useCallback(async (action: AIAction, query?: string) => {
    if (isLoading || !isScreenSharing) {
      console.warn("AI request blocked: Not sharing or already loading.");
      return;
    }
    setIsLoading(true);
    console.log(`Sending AI request. Action: ${action}, Custom Query: ${query}`);

    const context = await gatherContext();

    if (!context?.text) {
      console.warn("AI request cancelled: No context gathered.");
      setAiMessages((prev) => [
        ...prev,
        {
          id: `err-no-ctx-${Date.now()}`,
          role: "assistant",
          content: "[提示] 沒有足夠的轉錄內容可供分析。",
        },
      ]);
      setIsLoading(false);
      return;
    }

    const promptMap: Record<AIAction, string> = {
      "real-time": "分析最新的轉錄內容，並識別其中提到的關鍵點、關鍵字或待辦事項。",
      answer: "根據最近的轉錄內容，回答其中最後提出的問題。",
      summary: "提供最近轉錄內容的簡明摘要。請用中文回答。",
      search: "根據最近轉錄內容中討論的主題，建議相關的搜尋關鍵字或查找相關資訊。請用中文回答。",
      "find-clue": "根據最近的轉錄內容，找出其中可能存在的線索、疑點或需要進一步探討的資訊。請用中文回答。",
      custom: query || "根據以下要求分析最近轉錄內容。請用中文回答。",
    };

    const displayPromptMap: Record<AIAction, string> = {
      "real-time": "即時分析",
      answer: "根據轉錄內容回答問題",
      summary: "根據轉錄內容產生摘要",
      search: "根據轉錄內容搜尋主題",
      "find-clue": "根據轉錄內容找尋線索",
      custom: customPrompt || "自訂請求",
    };

    const userMsgContent = action === "custom" ? customPrompt : promptMap[action];
    const displayMsgContent = action === "custom" ? customPrompt : displayPromptMap[action];

    const userMsg: CustomMessage = { id: `user-${Date.now()}`, role: "user", content: userMsgContent };
    const displayMsg: CustomMessage = { id: `disp-${userMsg.id}`, role: "user", content: displayMsgContent };

    if (action !== "real-time") {
      setAiMessages((prev) => [...prev, displayMsg]);
    }
    if (action === "custom") setCustomPrompt("");

    try {
      console.log("Sending request to AI API:", API_URL);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [userMsg], 
          data: context,
          action: action
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`AI API Error (${res.status}): ${errorText}`);
      }

      const aiResponse: CustomMessage = await res.json();
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
    gatherContext,
    customPrompt,
  ]);

  const handleTranscriptionResponse = useCallback((text: string) => {
    console.log('[Transcription] 收到轉錄文字:', text);
    
    // Create a new transcription message
    const newTranscription: TranscriptionMessage = {
      id: `transcription-${Date.now()}`,
      role: "assistant",
      content: text,
      timestamp: Date.now(),
      type: "transcription"
    };

    console.log('[Transcription] 新增轉錄訊息:', newTranscription);

    // Add to transcriptions state
    setTranscriptions(prev => {
      console.log('[Transcription] 當前轉錄數量:', prev.length);
      return [...prev, newTranscription];
    });

    // Also update the chat messages for display
    setAiMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content.startsWith("[即時轉錄]")) {
        console.log('[Transcription] 更新現有轉錄訊息');
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: lastMessage.content + text },
        ];
      } else {
        console.log('[Transcription] 新增轉錄訊息到聊天');
        return [
          ...prev,
          { id: `realtime-${Date.now()}`, role: "assistant", content: `[即時轉錄] ${text}`, visible: isSubtitleVisible },
        ];
      }
    });
  }, []);

  const handleAnswerResponse = useCallback((text: string, turnComplete: boolean = false) => {
    // Skip if the text is "NULL", contains "NULL", or is empty/whitespace
    if (!text || 
        text.trim() === "" || 
        text === "NULL" || 
        text.includes("NULL") || 
        text.trim() === "null" || 
        text.includes("null")) {
      console.log("[即時問答] 忽略無效回應:", text);
      return;
    }

    console.log('[Answer] 收到回答:', text);
    
    // 更新聊天消息，保留轉錄消息的可見性狀態
    setAiMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content.startsWith("[即時問答]")) {
        console.log('[Answer] 更新現有回答訊息');
        // 保留所有消息的 visible 狀態
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: lastMessage.content + text },
        ];
      } else {
        console.log('[Answer] 新增回答訊息到聊天');
        // 保留所有消息的 visible 狀態
        return [
          ...prev,
          { id: `answer-${Date.now()}`, role: "assistant", content: `[即時問答] ${text}` },
        ];
      }
    });
  }, []);

  const handleTranscriptionKeywords = useCallback((newKeywords: string[]) => {
    setKeywords((prev) => {
      const uniqueNewKeywords = newKeywords.filter((k) => k && !prev.includes(k));
      if (uniqueNewKeywords.length > 0) {
        return [...prev, ...uniqueNewKeywords];
      }
      return prev;
    });
  }, []);

  const handleAnswerKeywords = useCallback((newKeywords: string[]) => {
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

  // 新增函數來控制字幕可見性
  const setSubtitleVisibility = (visible: boolean) => {
    setIsSubtitleVisible(visible);
    // 更新所有轉錄訊息的可見性
    setAiMessages(prev => prev.map(msg => {
      if (msg.content.startsWith("[即時轉錄]")) {
        return { ...msg, visible };
      }
      return msg;
    }));
  };

  return {
    aiMessages,
    transcriptions,
    isLoading,
    customPrompt,
    setCustomPrompt,
    keywords,
    selectedKeyword,
    sendContextToAI,
    handleTranscriptionResponse,
    handleTranscriptionKeywords,
    handleAnswerResponse,
    handleAnswerKeywords,
    handleKeywordClick,
    messagesContainerRef,
    resetChat,
    setSubtitleVisibility,
    messages: aiMessages,
    handleSendMessage: sendContextToAI,
  };
}
