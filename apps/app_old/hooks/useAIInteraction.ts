/**
 * @fileoverview AI Interaction Hook
 * @module useAIInteraction
 * @description React hook for managing AI interactions, transcriptions, and responses
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Message as AIMessage } from "ai";
import type { Segment } from "@/types";
import html2canvas from "html2canvas-pro";
import { useI18n } from "@/hooks/useI18n";

/**
 * @constant {string} API_URL - Endpoint URL for AI API interactions
 * @description Uses environment variable or falls back to localhost
 */
const API_URL = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:3000/api/ai";

/**
 * @typedef {string} AIAction
 * @description Types of AI interaction actions supported by the system
 */
export type AIAction =
  | "real-time"
  | "answer"
  | "summary"
  | "search"
  | "keyword_search"
  | "custom"
  | "screen"
  | "screenshot"
  | "upload";

/**
 * @interface TranscriptionMessage
 * @extends AIMessage
 * @description Message type for transcription data with timestamp
 * @property {number} timestamp - Unix timestamp when the transcription was created
 * @property {"transcription"} type - Identifies this as a transcription message
 */
interface TranscriptionMessage extends AIMessage {
  timestamp: number;
  type: "transcription";
}

/**
 * @interface AIContextData
 * @description Context data structure sent to AI for processing
 * @property {string} [text] - Text content for context
 * @property {number} [timestamp] - Unix timestamp of when the context was created
 * @property {string} [screenshot] - Base64 encoded screenshot data
 */
interface AIContextData {
  text?: string;
  timestamp?: number;
  screenshot?: string;
}

/**
 * React hook for AI interaction management
 *
 * @returns {Object} AI interaction controls and state
 * @returns {AIMessage[]} aiMessages - Array of AI conversation messages
 * @returns {function} setAiMessages - Function to update AI messages
 * @returns {TranscriptionMessage[]} transcriptions - Array of transcription messages
 * @returns {boolean} isLoading - Whether an AI request is in progress
 * @returns {string} customPrompt - Custom prompt text for AI
 * @returns {function} setCustomPrompt - Function to update custom prompt
 * @returns {string[]} keywords - Array of extracted keywords
 * @returns {string|null} selectedKeyword - Currently selected keyword
 * @returns {function} sendContextToAI - Function to send context to AI
 * @returns {function} handleTranscriptionResponse - Handler for transcription responses
 * @returns {function} handleTranscriptionKeywords - Handler for transcription keywords
 * @returns {function} handleAnswerResponse - Handler for AI answer responses
 * @returns {function} handleAnswerKeywords - Handler for AI answer keywords
 * @returns {function} handleKeywordClick - Handler for keyword click events
 * @returns {React.RefObject} messagesContainerRef - Reference to messages container
 * @returns {function} resetChat - Function to reset chat state
 * @returns {boolean} isSubtitleVisible - Whether subtitles are visible
 * @returns {function} setSubtitleVisibility - Function to toggle subtitle visibility
 * @returns {function} handleSendMessage - Alias for sendContextToAI
 * @returns {function} handleScreenshot - Handler for screenshot processing
 *
 * @example
 * ```tsx
 * const {
 *   aiMessages,
 *   isLoading,
 *   sendContextToAI,
 *   handleTranscriptionResponse
 * } = useAIInteraction();
 *
 * // Send a custom query to AI
 * const handleSendQuery = () => {
 *   sendContextToAI('custom', 'What is the capital of France?');
 * };
 *
 * // Process a transcription
 * useEffect(() => {
 *   handleTranscriptionResponse('This is a transcribed text');
 * }, []);
 * ```
 */
export function useAIInteraction() {
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const accumulatedTextRef = useRef("");
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true);
  const { t, language = "en-US" } = useI18n();
  const currentLanguage = language as "en-US" | "zh-TW" | "ja-JP";

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    const handleNewSession = async () => {
      if (window.electronAPI) {
        const newSession = {
          id: `session-${Date.now()}`,
          started_at: Date.now(),
          status: "active",
        };
        const { id } = await window.electronAPI.createSession(newSession);
        setCurrentSessionId(id);
      }
    };

    handleNewSession();
  }, []);
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [aiMessages]);

  // Function to gather context from transcriptions
  const gatherContext = useCallback(
    async (action?: AIAction): Promise<AIContextData | null> => {
      console.log("[AIInteraction] Gathering context from transcriptions...");
      console.log("[AIInteraction] Current transcriptions:", transcriptions);

      // 即使沒有轉錄內容，也返回一個空的 context
      if (transcriptions.length === 0) {
        console.log("[AIInteraction] No transcriptions available, using empty context");
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

      console.log("[AIInteraction] Selected transcriptions for context:", contextTranscriptions);

      const contextText = contextTranscriptions.map((t) => t.content).join("\n");

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
        "real-time": {
          "en-US":
            "Analyze the latest transcription content and identify key points, keywords, or action items mentioned.",
          "zh-TW": "分析最新的轉錄內容，並識別其中提到的關鍵點、關鍵字或待辦事項。",
          "ja-JP":
            "最新の文字起こし内容を分析し、言及された重要なポイント、キーワード、またはアクションアイテムを特定してください。",
        },
        answer_template: {
          "en-US":
            "Based on the attached transcription of the entire meeting, please provide a detailed answer to the last question asked: ",
          "zh-TW":
            "附上的轉錄內容是一個會議全部的對話，請根據整個會議的對話，詳細回答最後提出的問題: ",
          "ja-JP":
            "添付された会議全体の文字起こしに基づいて、最後に質問された内容について詳細に回答してください: ",
        },
        summary_template: {
          "en-US": "Please provide a concise summary based on the following transcription: ",
          "zh-TW": "根據以下的轉錄內容，提供簡明摘要: ",
          "ja-JP": "以下の文字起こしに基づいて、簡潔な要約を提供してください: ",
        },
        search_template: {
          "en-US":
            "Please search the web for the following query, and answer the question directly: ",
          "zh-TW": "請搜尋以下查詢，並直接回答問題: ",
          "ja-JP": "以下のクエリを検索し、質問に直接回答してください: ",
        },
        keyword_search_template: {
          "en-US":
            "Please search the web for the following query, and answer the question directly: ",
          "zh-TW": "請搜尋以下查詢，並直接回答問題: ",
          "ja-JP": "以下のクエリを検索し、質問に直接回答してください: ",
        },
        custom_template: {
          "en-US": 'Please analyze or answer the following text:\n\n"{{query_text}}"',
          "zh-TW": '請針對以下文字內容進行分析或回答：\n\n"{{query_text}}"',
          "ja-JP": '以下のテキストを分析または回答してください：\n\n"{{query_text}}"',
        },
        screen_template: {
          "en-US":
            "Please analyze the screenshot and answer the following question:\n\n{{query_text}}",
          "zh-TW": "請你分析截圖，並回答以下問題：\n\n{{query_text}}",
          "ja-JP": "スクリーンショットを分析し、以下の質問に回答してください：\n\n{{query_text}}",
        },
      } as const;

      const baseDisplayPromptMap = {
        "real-time": {
          "en-US": "Real-time Analysis",
          "zh-TW": "即時分析",
          "ja-JP": "リアルタイム分析",
        },
        answer: {
          "en-US": "Answer based on transcription",
          "zh-TW": "根據轉錄內容回答出現或是潛在的問題，請針對最後出現的問題回答",
          "ja-JP": "文字起こしに基づいて回答",
        },
        summary: {
          "en-US": "Generate summary from transcription",
          "zh-TW": "根據轉錄內容產生摘要",
          "ja-JP": "文字起こしから要約を生成",
        },
        search: {
          "en-US": "Search request",
          "zh-TW": "搜尋請求",
          "ja-JP": "検索リクエスト",
        },
        keyword_search: {
          "en-US": "Keyword search",
          "zh-TW": "關鍵字搜尋",
          "ja-JP": "キーワード検索",
        },
        custom: {
          "en-US": "Custom request",
          "zh-TW": "自訂請求",
          "ja-JP": "カスタムリクエスト",
        },
        screen: {
          "en-US": "Screenshot analysis",
          "zh-TW": "截圖分析",
          "ja-JP": "スクリーンショット分析",
        },
        screenshot: {
          "en-US": "Screenshot",
          "zh-TW": "截圖",
          "ja-JP": "スクリーンショット",
        },
        upload: {
          "en-US": "Upload File",
          "zh-TW": "上傳檔案",
          "ja-JP": "ファイルアップロード",
        },
      } as const;

      const currentAction = action as AIAction;

      if (action === "custom") {
        if (!query) {
          console.warn("AI request 'custom' action cancelled: No query provided.");
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-query-${Date.now()}`,
              role: "assistant",
              content: t("noQueryProvided"),
            },
          ]);
          setIsLoading(false);
          return;
        }
        context = {
          text: query,
          timestamp: Date.now(),
        };
        finalUserMsgContent = basePromptMap.custom_template[currentLanguage].replace(
          "{{query_text}}",
          query,
        );
        finalDisplayMsgContent = query;
        console.log("[AIInteraction] Custom action. Context text (from query):", context.text);
      } else if (action === "screen") {
        context = {
          text: query || "",
          screenshot: screenshot || "",
          timestamp: Date.now(),
        };
        finalUserMsgContent = basePromptMap.screen_template[currentLanguage].replace(
          "{{query_text}}",
          query || t("currentScreen"),
        );
        finalDisplayMsgContent = `${t("screenshotAnalysis")}: ${query || t("currentScreen")}`;
        console.log("[AIInteraction] Screen action. Query:", query);
      } else if (action === "search") {
        if (!query) {
          console.warn("AI request 'search' action cancelled: No query provided.");
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-query-search-${Date.now()}`,
              role: "assistant",
              content: t("noSearchQueryProvided"),
            },
          ]);
          setIsLoading(false);
          return;
        }
        context = {
          text: query,
          timestamp: Date.now(),
        };
        finalUserMsgContent = basePromptMap.search_template[currentLanguage] + query;
        finalDisplayMsgContent = `${t("search")}: ${query}`;
        console.log("[AIInteraction] Search action. Context text (from query):", context.text);
      } else if (action === "keyword_search") {
        if (!query) {
          console.warn("AI request 'keyword_search' action cancelled: No query provided.");
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-query-keyword_search-${Date.now()}`,
              role: "assistant",
              content: t("noQueryProvided"),
            },
          ]);
          setIsLoading(false);
          return;
        }
        const gatheredContext = await gatherContext(action);
        context = {
          text: `請一定要用${currentLanguage}這個語言來回答，不要講多餘的話，只有單純的名詞解釋，連第一句對於請求的回覆也不要，請用簡單易懂的方式解釋這個專業術語，不超過50字：${query}\n\n上下文：\n${gatheredContext?.text}`,
          timestamp: Date.now(),
        };
        finalUserMsgContent = basePromptMap.keyword_search_template[currentLanguage] + query;
        finalDisplayMsgContent = baseDisplayPromptMap.keyword_search[currentLanguage];
        console.log(
          "[AIInteraction] Keyword search action. Context text (from query):",
          context.text,
        );
      } else {
        const gatheredContext = await gatherContext(action);
        if (!gatheredContext?.text && action !== "real-time") {
          console.warn("AI request cancelled: No context gathered for action:", action);
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-ctx-${Date.now()}`,
              role: "assistant",
              content: t("insufficientTranscription"),
            },
          ]);
          setIsLoading(false);
          return;
        }
        context = gatheredContext || { text: "", timestamp: Date.now() };

        switch (action) {
          case "answer":
            finalUserMsgContent = basePromptMap.answer_template[currentLanguage] + context.text;
            break;
          case "summary":
            finalUserMsgContent = basePromptMap.summary_template[currentLanguage] + context.text;
            break;
          case "real-time":
            finalUserMsgContent = basePromptMap["real-time"][currentLanguage];
            break;
          default:
            finalUserMsgContent = "";
            console.error("Unhandled AI action for prompt construction:", action);
        }
        finalDisplayMsgContent = baseDisplayPromptMap[currentAction][currentLanguage];
        console.log(
          "[AIInteraction] Context-based action. Context text:",

          context.text,
        );
      }

      console.log("[AIInteraction] Final context for AI:", context);
      console.log("[AIInteraction] Final user message for API:", finalUserMsgContent);
      console.log("[AIInteraction] Final display message for chat:", finalDisplayMsgContent);

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
    [gatherContext, customPrompt, t, language],
  );

  const handleTranscriptionResponse = useCallback(
    async (text: string) => {
      if (!currentSessionId) return;

      const newTranscription: TranscriptionMessage = {
        id: `transcription-${Date.now()}`,
        role: "assistant",
        content: text,
        timestamp: Date.now(),
        type: "transcription",
      };

      if (window.electronAPI) {
        await window.electronAPI.addTranscript({
          id: newTranscription.id,
          session_id: currentSessionId,
          timestamp: newTranscription.timestamp,
          content: newTranscription.content,
        });
      }

      setTranscriptions((prev) => [...prev, newTranscription]);

      setAiMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === "assistant" && lastMessage.content.startsWith("[即時轉錄]")) {
          return [...prev.slice(0, -1), { ...lastMessage, content: lastMessage.content + text }];
        } else {
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
    },
    [currentSessionId],
  );

  const handleAnswerResponse = useCallback((text: string, turnComplete: boolean = false) => {
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
        const searchQuery = accumulatedTextRef.current.replace("[WEB]", "").trim();
        // 發送搜尋請求
        sendContextToAI("search", searchQuery);
        // 重置累積文本
        accumulatedTextRef.current = "";
        return;
      }

      if (accumulatedTextRef.current.includes("[SCREEN]")) {
        console.log("[Answer] 檢測到截圖請求");
        // 提取搜尋查詢
        const searchQuery = accumulatedTextRef.current.replace("[SCREEN]", "").trim();

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
        if (lastMessage?.role === "assistant" && lastMessage.content.startsWith("[即時問答]")) {
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

  const handleKeywordClick = useCallback(
    async (keyword: string, language?: string) => {
      if (isLoading) return;
      setSelectedKeyword(keyword);

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
            await sendContextToAI("keyword_search", keyword);
            return; // 如果成功，直接返回
          } catch (error) {
            lastError = error;
            retries++;
            if (retries < maxRetries) {
              // 等待一段時間後重試，等待時間隨重試次數增加
              await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
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

  const handleScreenshot = useCallback(
    async (screenshotPath: string) => {
      console.log("[AIInteraction] handleScreenshot called with path:", screenshotPath);
      // 強制只用相對路徑
      let relativePath = screenshotPath.startsWith("/screenshots/")
        ? screenshotPath
        : `/screenshots/${screenshotPath.split("/screenshots/").pop()}`;
      console.log("[AIInteraction] Using relative path for fetch:", relativePath);
      try {
        const response = await fetch(relativePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch screenshot: ${response.statusText}`);
        }
        const blob = await response.blob();

        // 將 blob 轉換為 base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);

        reader.onloadend = () => {
          const base64data = reader.result as string;
          // 保持完整的 data URL 格式
          const base64Image = base64data;

          // 根據當前語言設置問題
          let question = "";
          switch (currentLanguage) {
            case "zh-TW":
              question = "請分析這張截圖的內容，並提供詳細的描述。";
              break;
            case "ja-JP":
              question = "このスクリーンショットの内容を分析し、詳細な説明を提供してください。";
              break;
            default:
              question =
                "Please analyze the content of this screenshot and provide a detailed description.";
          }

          console.log("[AIInteraction] Sending screenshot to AI with question:", question);
          console.log("[AIInteraction] Image data format:", base64Image.substring(0, 50) + "...");
          sendContextToAI("screen", question, base64Image);
        };

        reader.onerror = () => {
          console.error("[AIInteraction] Error reading screenshot file");
          throw new Error("Failed to read screenshot file");
        };
      } catch (error) {
        console.error("[AIInteraction] Error processing screenshot:", error);
        setAiMessages((prev) => [
          ...prev,
          {
            id: `err-screenshot-${Date.now()}`,
            role: "assistant",
            content: `[錯誤] 無法處理截圖: ${error instanceof Error ? error.message : String(error)}`,
          },
        ]);
      }
    },
    [sendContextToAI, currentLanguage, setAiMessages],
  );

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
    handleScreenshot,
  };
}
