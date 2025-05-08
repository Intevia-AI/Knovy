import { useState, useCallback, useRef, useEffect } from "react";
import { Message as AIMessage } from "ai";
import type { Segment } from "@/types";
import html2canvas from "html2canvas-pro";

// Constants
const API_URL =
  process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:3000/api/ai";

type AIAction =
  | "real-time"
  | "answer"
  | "summary"
  | "search"
  | "custom"
  | "find-clue"
  | "screen";

interface TranscriptionMessage extends AIMessage {
  timestamp: number;
  type: "transcription";
}

interface AIContextData {
  text?: string;
  timestamp?: number;
  screenshot?: string;
}

export function useAIInteraction() {
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const accumulatedTextRef = useRef("");
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true);

  // Log transcriptions every 10 seconds
  // useEffect(() => {
  //   const logTranscriptions = () => {
  //     if (transcriptions.length > 0) {
  //       console.log("\n=== 轉錄對話記錄 ===");
  //       console.log(`總共 ${transcriptions.length} 條轉錄`);
  //       console.log("-------------------");
  //       transcriptions.forEach((t, index) => {
  //         const time = new Date(t.timestamp).toLocaleTimeString();
  //         console.log(`[${index + 1}] [${time}] ${t.content}`);
  //       });
  //       console.log("===================\n");
  //     }
  //   };

  //   // 立即執行一次
  //   logTranscriptions();

  //   // 設置定時器
  //   const interval = setInterval(logTranscriptions, 10000);

  //   return () => {
  //     clearInterval(interval);
  //   };
  // }, [transcriptions]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [aiMessages]);

  // Function to gather context from transcriptions
  const gatherContext = useCallback(
    async (action?: AIAction): Promise<AIContextData | null> => {
      console.log("[AIInteraction] Gathering context from transcriptions...");
      console.log("[AIInteraction] Current transcriptions:", transcriptions);

      // 即使沒有轉錄內容，也返回一個空的 context
      if (transcriptions.length === 0) {
        console.log(
          "[AIInteraction] No transcriptions available, using empty context",
        );
        return {
          text: "",
          timestamp: Date.now(),
        };
      }

      // 如果是回答問題或摘要，使用所有轉錄內容
      const contextTranscriptions =
        action === "answer" || action === "summary"
          ? transcriptions // 使用所有轉錄
          : transcriptions.slice(-5); // 其他動作使用最近的 5 條轉錄

      console.log(
        "[AIInteraction] Selected transcriptions for context:",
        contextTranscriptions,
      );

      const contextText = contextTranscriptions
        .map((t) => t.content)
        .join("\n");

      console.log("[AIInteraction] Context text:", contextText);

      return {
        text: contextText,
        timestamp: Date.now(),
      };
    },
    [transcriptions],
  );

  // Function to send context and prompt to the AI backend
  const sendContextToAI = useCallback(
    async (action: AIAction, query?: string, screenshot?: string, language?: string) => {
      setIsLoading(true);
      console.log(
        `Sending AI request. Action: ${action}, Custom Query: ${query}, Language: ${language}, Screenshot: ${screenshot}`,
      );

      let context: AIContextData;
      let finalUserMsgContent: string;
      let finalDisplayMsgContent: string;

      // Define base prompt templates
      const basePromptMap = {
        "real-time":
          "分析最新的轉錄內容，並識別其中提到的關鍵點、關鍵字或待辦事項。",
        answer_template:
          "附上的轉錄內容是一個會議全部的對話，請根據整個會議的對話，詳細回答最後提出的問題: ", // append context.text
        summary_template: "根據以下的轉錄內容，提供簡明摘要: ", // append context.text
        search_template:
          "Please search the web for the following query, and answer the question directly and answer in Chinese: ", // append query
        findclue_template:
          "根據以下的轉錄內容，找出其中可能存在的線索、疑點或需要進一步探討的資訊：\n\n", // append context.text
        custom_template:
          '請針對以下文字內容進行分析或回答：\n\n"{{query_text}}"',
        screen_template:
          "請你分析截圖，並回答以下問題：\n\n{{query_text}}",
      };

      const baseDisplayPromptMap: Record<AIAction, string> = {
        "real-time": "即時分析",
        answer: "根據轉錄內容回答出現或是潛在的問題，請針對最後出現的問題回答",
        summary: "根據轉錄內容產生摘要",
        search: "搜尋請求", // Will be overridden by query
        "find-clue": "根據轉錄內容找尋線索",
        custom: "自訂請求", // Will be overridden by query
        screen: "截圖分析", // Will be overridden
      };

      if (action === "custom") {
        if (!query) {
          console.warn(
            "AI request 'custom' action cancelled: No query provided.",
          );
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-query-${Date.now()}`,
              role: "assistant",
              content: "[提示] 沒有提供查詢內容。",
            },
          ]);
          setIsLoading(false);
          return;
        }
        context = {
          text: query, // For "custom", the query (selectedText or input prompt) is the primary context
          timestamp: Date.now(),
        };
        finalUserMsgContent = basePromptMap.custom_template.replace(
          "{{query_text}}",
          query,
        );
        finalDisplayMsgContent = query; // Display the actual selected text or custom prompt
        console.log(
          "[AIInteraction] Custom action. Context text (from query):",
          context.text,
        );
      } else if (action === "screen") {
        context = {
          text: query || "", // Query here is the instruction for the screenshot
          screenshot: screenshot || "",
          timestamp: Date.now(),
        };
        finalUserMsgContent = basePromptMap.screen_template.replace(
          "{{query_text}}",
          query || "這張截圖",
        );
        finalDisplayMsgContent = `截圖分析: ${query || "目前畫面"}`;
        console.log(
          "[AIInteraction] Screen action. Query:",
          query,
        );
      } else if (action === "search") {
        if (!query) {
          console.warn(
            "AI request 'search' action cancelled: No query provided.",
          );
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-query-search-${Date.now()}`,
              role: "assistant",
              content: "[提示] 沒有提供搜尋關鍵字。",
            },
          ]);
          setIsLoading(false);
          return;
        }
        context = {
          text: query, // For "search", the query is the primary context
          timestamp: Date.now(),
        };
        finalUserMsgContent = basePromptMap.search_template + query;
        finalDisplayMsgContent = `搜尋: ${query}`;
        console.log(
          "[AIInteraction] Search action. Context text (from query):",
          context.text,
        );
      } else {
        // For "answer", "summary", "find-clue", "real-time"
        const gatheredContext = await gatherContext(action);
        if (!gatheredContext?.text && action !== "real-time") {
          console.warn(
            "AI request cancelled: No context gathered for action:",
            action,
          );
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
        context = gatheredContext || { text: "", timestamp: Date.now() };

        switch (action) {
          case "answer":
            finalUserMsgContent = basePromptMap.answer_template + context.text;
            break;
          case "summary":
            finalUserMsgContent = basePromptMap.summary_template + context.text;
            break;
          case "find-clue":
            finalUserMsgContent =
              basePromptMap.findclue_template + context.text;
            break;
          case "real-time":
            finalUserMsgContent = basePromptMap["real-time"];
            break;
          default:
            finalUserMsgContent = "";
            console.error(
              "Unhandled AI action for prompt construction:",
              action,
            );
        }
        finalDisplayMsgContent = baseDisplayPromptMap[action];
        console.log(
          "[AIInteraction] Context-based action. Context text:",

          context.text,
        );
      }

      console.log("[AIInteraction] Final context for AI:", context);
      console.log(
        "[AIInteraction] Final user message for API:",
        finalUserMsgContent,
      );
      console.log(
        "[AIInteraction] Final display message for chat:",
        finalDisplayMsgContent,
      );

      const userMsg: AIMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: finalUserMsgContent,
      };
      const displayMsg: AIMessage = {
        id: `disp-${userMsg.id}`,
        role: "user",
        content: finalDisplayMsgContent,
      };

      if (action !== "real-time") {
        setAiMessages((prev) => [...prev, displayMsg]);
      }

      try {
        console.log("Sending request to AI API:", API_URL);
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [userMsg],
            action: action,
            data: {
              text: context.text,
              timestamp: context.timestamp,
              screenshot: context.screenshot,
            },
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`AI API Error (${res.status}): ${errorText}`);
        }

        const aiResponse: AIMessage = await res.json();
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
    },
    [gatherContext, customPrompt],
  );

  const handleTranscriptionResponse = useCallback((text: string) => {
    console.log("[Transcription] 收到轉錄文字:", text);

    // Create a new transcription message
    const newTranscription: TranscriptionMessage = {
      id: `transcription-${Date.now()}`,
      role: "assistant",
      content: text,
      timestamp: Date.now(),
      type: "transcription",
    };

    console.log("[Transcription] 新增轉錄訊息:", newTranscription);

    // Add to transcriptions state
    setTranscriptions((prev) => {
      console.log("[Transcription] 當前轉錄數量:", prev.length);
      return [...prev, newTranscription];
    });

    // Also update the chat messages for display
    setAiMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (
        lastMessage?.role === "assistant" &&
        lastMessage.content.startsWith("[即時轉錄]")
      ) {
        console.log("[Transcription] 更新現有轉錄訊息");
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: lastMessage.content + text },
        ];
      } else {
        console.log("[Transcription] 新增轉錄訊息到聊天");
        return [
          ...prev,
          {
            id: `realtime-${Date.now()}`,
            role: "assistant",
            content: `[即時轉錄] ${text}`,
          },
        ];
      }
    });
  }, []);

  const handleAnswerResponse = useCallback(
    (text: string, turnComplete: boolean = false) => {
      // Skip if the text is "NULL", contains "NULL", or is empty/whitespace
      if (
        !text ||
        text.trim() === "" ||
        text === "NULL" ||
        text.includes("NULL") ||
        text.trim() === "null" ||
        text.includes("null")
      ) {
        console.log("[即時問答] 忽略無效回應:", text);
        return;
      }

      console.log("[Answer] 收到回答:", text, accumulatedTextRef.current);

      // 累積文本
      if (text !== "search web") {
        accumulatedTextRef.current += text;
        console.log("[Answer] 累積文本:", accumulatedTextRef.current);
      }

      if (text === "search web" && accumulatedTextRef.current === "") {
        console.log("[Answer] 忽略 search web 消息");
        return;
      }

      // 只有在收到完整句子時才處理 web search 請求
      if (turnComplete) {
        console.log("[Answer] 收到完整句子，檢查是否需要處理");

        // 檢查是否包含 [WEB] 標記
        if (accumulatedTextRef.current.includes("[WEB]")) {
          console.log("[Answer] 檢測到網路搜尋請求");
          // 提取搜尋查詢
          const searchQuery = accumulatedTextRef.current
            .replace("[WEB]", "")
            .trim();
          // 發送搜尋請求
          sendContextToAI("search", searchQuery);
          // 重置累積文本
          accumulatedTextRef.current = "";
          return;
        }

        if (accumulatedTextRef.current.includes("[SCREEN]")) {
          console.log("[Answer] 檢測到截圖請求");
          // 提取搜尋查詢
          const searchQuery = accumulatedTextRef.current
            .replace("[SCREEN]", "")
            .trim();

          // 使用 html2canvas 獲取截圖
          html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            scale: 1,
            logging: false,
            backgroundColor: "#ffffff", // 設置背景色
            ignoreElements: (element) => {
              // 忽略可能導致問題的元素
              return (
                element.tagName === "VIDEO" ||
                element.tagName === "CANVAS" ||
                element.tagName === "IFRAME"
              );
            },
            onclone: (clonedDoc) => {
              // 在克隆的文檔中處理樣式
              const style = clonedDoc.createElement("style");
              style.textContent = `
              * {
                color: #000000 !important;
                background-color: #ffffff !important;
              }
            `;
              clonedDoc.head.appendChild(style);
            },
          })
            .then((canvas) => {
              // 轉換為 base64
              const imageData = canvas.toDataURL("image/jpeg", 0.8);
              const b64Data = imageData.split(",")[1];
              const screenshot = b64Data;
              // 發送搜尋請求，包含截圖
              sendContextToAI("screen", searchQuery, screenshot);
            })
            .catch((error) => {
              console.error("截圖失敗:", error);
              // 如果截圖失敗，仍然發送搜尋請求
              sendContextToAI("screen", searchQuery);
            });

          // 重置累積文本
          accumulatedTextRef.current = "";
          return;
        }

        // 更新聊天消息
        setAiMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (
            lastMessage?.role === "assistant" &&
            lastMessage.content.startsWith("[即時問答]")
          ) {
            console.log("[Answer] 更新現有回答訊息");
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: lastMessage.content + accumulatedTextRef.current,
              },
            ];
          } else {
            console.log("[Answer] 新增回答訊息到聊天");
            return [
              ...prev,
              {
                id: `answer-${Date.now()}`,
                role: "assistant",
                content: `[即時問答] ${accumulatedTextRef.current}`,
              },
            ];
          }
        });
        // 重置累積文本
        accumulatedTextRef.current = "";
      }
    },
    [],
  );

  const handleTranscriptionKeywords = useCallback((newKeywords: string[]) => {
    setKeywords((prev) => {
      const uniqueNewKeywords = newKeywords.filter(
        (k) => k && !prev.includes(k),
      );
      if (uniqueNewKeywords.length > 0) {
        return [...prev, ...uniqueNewKeywords];
      }
      return prev;
    });
  }, []);

  const handleAnswerKeywords = useCallback((newKeywords: string[]) => {
    setKeywords((prev) => {
      const uniqueNewKeywords = newKeywords.filter(
        (k) => k && !prev.includes(k),
      );
      if (uniqueNewKeywords.length > 0) {
        return [...prev, ...uniqueNewKeywords];
      }
      return prev;
    });
  }, []);

  const handleKeywordClick = useCallback(
    async (keyword: string, language?: string) => {
      if (isLoading) return;
      setSelectedKeyword(keyword);
      setIsLoading(true);

      try {
        // 最多重試5次
        let retries = 0;
        const maxRetries = 5;
        let lastError = null;

        // 獲取最後兩句轉錄內容作為上下文
        const contextText = transcriptions
          .slice(-2)
          .map((t) => t.content)
          .join("\n");

        while (retries < maxRetries) {
          try {
            // 使用 search 動作，並加入轉錄內容作為上下文
            await sendContextToAI(
              "search",
              `請一定要用${language}這個語言來回答，不要講多餘的話，只有單純的名詞解釋，連第一句對於請求的回覆也不要，請用簡單易懂的方式解釋這個專業術語，不超過50字：${keyword}\n\n上下文：\n${contextText}`,
            );
            return; // 如果成功，直接返回
          } catch (error) {
            lastError = error;
            retries++;
            if (retries < maxRetries) {
              // 等待一段時間後重試，等待時間隨重試次數增加
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * retries),
              );
            }
          }
        }

        // 如果所有重試都失敗了
        throw lastError;
      } catch (error) {
        console.error(`[錯誤] 無法取得 ${keyword} 的解釋:`, error);
        // 顯示更友好的錯誤訊息
        const errorMessage =
          error instanceof Error
            ? error.message.includes("overloaded")
              ? "模型服務器暫時過載，請稍後再試"
              : error.message
            : "發生未知錯誤，請稍後再試";

        setAiMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `[錯誤] 無法取得 "${keyword}" 的解釋: ${errorMessage}`,
          },
        ]);
      } finally {
        setIsLoading(false);
        setSelectedKeyword(null);
      }
    },
    [isLoading, sendContextToAI, transcriptions],
  );

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
  };

  return {
    aiMessages,
    setAiMessages,
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
    isSubtitleVisible,
    setSubtitleVisibility,
    handleSendMessage: sendContextToAI,
  };
}
