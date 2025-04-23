import { useState, useCallback, useRef, useEffect } from 'react';
import { Message } from 'ai';
import type { Segment, AIContextData } from '@/types';
import { blobToBase64 } from '@/lib/utils';

// Constants
const API_URL = "http://localhost:3001/api/ai";
const CONTEXT_WINDOW_MS = 30_000; // How far back to look for audio context

type AIAction = "real-time" | "answer" | "summary" | "search" | "custom" | "find-clue";

interface UseAIInteractionProps {
  micSegments: Segment[];
  systemAudioSegments: Segment[];
  micMimeType: string;
  systemAudioMimeType: string;
  isScreenSharing: boolean;
  trimAudio: (blobsBase64: { data: string; mimeType: string }[]) => Promise<string>; // From useElectron
}

export function useAIInteraction({
  micSegments,
  systemAudioSegments,
  micMimeType,
  systemAudioMimeType,
  isScreenSharing,
  trimAudio,
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

  // Function to gather context from recent audio segments
  const gatherContext = useCallback(async (): Promise<AIContextData | null> => {
    const now = Date.now();
    const recentMicSegments = micSegments.filter(seg => now - seg.timestamp <= CONTEXT_WINDOW_MS);
    const recentSystemSegments = systemAudioSegments.filter(seg => now - seg.timestamp <= CONTEXT_WINDOW_MS);

    if (recentMicSegments.length === 0 && recentSystemSegments.length === 0) {
        console.log("No recent audio segments found for context.");
        return null;
    }

    const audioInputs: AIContextData['audioInputs'] = [];

    // Process Mic Audio
    if (recentMicSegments.length > 0 && micMimeType) {
        console.log(`Processing ${recentMicSegments.length} recent mic segments...`);
        const blobsBase64 = await Promise.all(
            recentMicSegments.map(async ({ blob }) => {
                const dataUrl = await blobToBase64(blob);
                const data = dataUrl.split(',')[1] || dataUrl;
                return { data, mimeType: micMimeType };
            })
        );
        try {
            const trimmed = await trimAudio(blobsBase64); // Use Electron for trimming/concatenation
            if (trimmed) {
                audioInputs.push({ data: trimmed, mimeType: micMimeType, label: 'microphone_last_30s' });
                console.log("Added trimmed mic audio to context.");
            } else {
                 console.warn("Mic audio trimming resulted in empty data.");
            }
        } catch (error) {
             console.error("Error trimming mic audio via Electron:", error);
        }
    }

    // Process System Audio
    if (recentSystemSegments.length > 0 && systemAudioMimeType) {
        console.log(`Processing ${recentSystemSegments.length} recent system audio segments...`);
         // System audio segments might already be concatenated blobs from the recorder interval
         // Assuming the last segment is the most relevant concatenation for the window
         const latestSystemSegment = recentSystemSegments[recentSystemSegments.length - 1];
         if (latestSystemSegment) {
             try {
                 const dataUrl = await blobToBase64(latestSystemSegment.blob);
                 const data = dataUrl.split(',')[1] || dataUrl;
                 // System audio might not need trimming if segments are managed correctly
                 audioInputs.push({ data, mimeType: systemAudioMimeType, label: 'system_audio_last_segment' });
                 console.log("Added latest system audio segment to context.");
             } catch (error) {
                 console.error("Error processing system audio segment:", error);
             }
         }
        // If trimming/concatenation is needed for system audio as well:
        /*
        const blobsBase64 = await Promise.all(
            recentSystemSegments.map(async ({ blob }) => {
                const dataUrl = await blobToBase64(blob);
                const data = dataUrl.split(',')[1] || dataUrl;
                return { data, mimeType: systemAudioMimeType };
            })
        );
         try {
            const trimmed = await trimAudio(blobsBase64); // Use Electron for trimming/concatenation
            if (trimmed) {
                audioInputs.push({ data: trimmed, mimeType: systemAudioMimeType, label: 'system_audio_last_30s' });
                 console.log("Added trimmed system audio to context.");
            } else {
                 console.warn("System audio trimming resulted in empty data.");
            }
         } catch (error) {
             console.error("Error trimming system audio via Electron:", error);
         }
        */
    }


    return { audioInputs: audioInputs.length > 0 ? audioInputs : undefined };
  }, [micSegments, systemAudioSegments, micMimeType, systemAudioMimeType, trimAudio]);


  // Function to send context and prompt to the AI backend
  const sendContextToAI = useCallback(async (action: AIAction, query?: string) => {
    if (isLoading || !isScreenSharing) {
        console.warn("AI request blocked: Not sharing or already loading.");
        return;
    }
    setIsLoading(true);
    console.log(`Sending AI request. Action: ${action}, Custom Query: ${query}`);

    const context = await gatherContext();

    if (!context?.audioInputs || context.audioInputs.length === 0) {
      console.warn("AI request cancelled: No context gathered.");
      // Optionally add a user-facing message
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

    // Add user's request to chat (except for real-time which might be too frequent)
    if (action !== "real-time") {
      setAiMessages((prev) => [...prev, displayMsg]);
    }
    if (action === "custom") setCustomPrompt(""); // Clear input after sending custom prompt

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
    gatherContext,
    customPrompt, // Include customPrompt dependency
    // No need to depend directly on segments/mimetypes here as gatherContext handles them
  ]);

  // Handler for real-time text responses (e.g., from transcription)
   const handleTextResponse = useCallback((text: string) => {
    setAiMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      // Append to existing real-time message or create a new one
      if (lastMessage?.role === "assistant" && lastMessage.content.startsWith("[即時轉錄]")) {
        // Debounce or throttle this update if it becomes too frequent
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
  }, []); // No dependencies needed if it only manipulates state based on args

  // Handler for newly detected keywords
  const handleKeywords = useCallback((newKeywords: string[]) => {
    setKeywords((prev) => {
      const uniqueNewKeywords = newKeywords.filter((k) => k && !prev.includes(k)); // Add check for non-empty keywords
      if (uniqueNewKeywords.length > 0) {
        return [...prev, ...uniqueNewKeywords];
      }
      return prev; // Return previous state if no new unique keywords
    });
  }, []); // No dependencies needed

  // Handler for clicking a keyword to get an explanation
  const handleKeywordClick = useCallback(async (keyword: string) => {
    if (!keyword || isLoading) return; // Prevent empty or concurrent requests

    setSelectedKeyword(keyword);
    setIsLoading(true);
    console.log(`Fetching explanation for keyword: ${keyword}`);

    // Add user intent message
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
          data: {}, // No audio context needed for simple explanation
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
      setSelectedKeyword(null); // Clear selected keyword after attempt
       console.log(`Keyword explanation fetch finished for: ${keyword}`);
    }
  }, [isLoading]); // Depends on isLoading state

  // Function to clear chat messages and keywords
  const resetChat = useCallback(() => {
      setAiMessages([]);
      setKeywords([]);
      setCustomPrompt("");
      setIsLoading(false); // Ensure loading state is reset
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
    handleTextResponse, // For RealTimeAnalysis component
    handleKeywords,     // For RealTimeAnalysis component
    handleKeywordClick,
    messagesContainerRef,
    resetChat, // Expose reset function
  };
}
