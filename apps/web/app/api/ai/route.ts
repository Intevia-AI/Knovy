import { google } from "@ai-sdk/google";
import { generateText, UserContent, Message, CoreMessage } from "ai";
import { NextResponse } from "next/server";

// Updated: Expect label in MediaFile
interface MediaFile {
  data: string;
  mimeType: string;
  label: string;
}
interface AIRequestBody {
  audioInputs?: MediaFile[];
}
interface CompleteRequest {
  messages: Message[];
  data?: AIRequestBody;
}

export async function POST(req: Request) {
  try {
    const raw: CompleteRequest = await req.json();
    const { messages = [], data = {} } = raw;

    // Build user content parts with labels
    const parts: UserContent = [];
    if (data.audioInputs && data.audioInputs.length > 0) {
      // Group by label for clarity in the prompt
      const groupedAudio = data.audioInputs.reduce(
        (acc, audio) => {
          acc[audio.label] = acc[audio.label] || [];
          acc[audio.label]?.push(audio);
          return acc;
        },
        {} as Record<string, MediaFile[]>,
      );

      // Add labeled audio parts
      for (const label in groupedAudio) {
        // More descriptive labels for the AI
        let descriptiveLabel = label;
        if (label.startsWith("microphone")) {
          descriptiveLabel = "麥克風音訊";
        } else if (label.startsWith("system")) {
          descriptiveLabel = "系統音訊";
        }
        if (label.endsWith("-last")) {
          descriptiveLabel += " (最近片段)";
        } else if (label.endsWith("-current")) {
          descriptiveLabel += " (當前錄音)";
        }

        parts.push({
          type: "text",
          text: `\n--- ${descriptiveLabel} ---`,
        });
        groupedAudio[label]?.forEach((audioInput) => {
          parts.push({
            type: "file",
            data: audioInput.data,
            mimeType: audioInput.mimeType,
          });
        });
      }
    }

    // If no media, just forward text messages
    const formatted: CoreMessage[] = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Merge media into the last user message or create new
    const lastIdx = formatted
      .map((m, i) => (m.role === "user" ? i : -1))
      .filter((i) => i !== -1)
      .pop();
    if (parts.length) {
      if (lastIdx !== undefined) {
        const last = formatted[lastIdx] as CoreMessage & { content: any };
        // Ensure existing content is treated as text if it's not already an array
        const existingContent = Array.isArray(last.content)
          ? last.content
          : typeof last.content === "string" && last.content.trim() !== "" // Handle empty string case
            ? [{ type: "text", text: last.content }]
            : []; // If content is null/undefined/empty, start fresh
        // Prepend audio parts to existing text content
        last.content = [...parts, ...existingContent];
      } else {
        // If no user message exists, create one with the audio
        formatted.push({ role: "user", content: parts });
      }
    }

    // Ensure there's some content to send
    if (
      !formatted.some(
        (m) =>
          m.content &&
          (Array.isArray(m.content)
            ? m.content.length > 0
            : String(m.content).trim() !== ""),
      )
    ) {
      console.warn("AI API: No input content after formatting.");
      return NextResponse.json({ error: "No input content" }, { status: 400 });
    }

    // Define the system prompt in Traditional Chinese with examples
    const systemPrompt = `你是一個專業的 AI 助理。你的任務是分析使用者提供的文字訊息以及從不同來源（麥克風、系統音訊）捕捉到的音訊內容。請專注於理解音訊中的對話、討論或呈現的內容，而不是音訊檔案本身。根據使用者的要求（例如：回答問題、產生摘要、搜尋主題、執行特定指令），針對音訊中的 *對話內容* 提供精確且有用的回應。請務必使用 **繁體中文** 回答。如果音訊來源（麥克風 vs 系統）與分析內容相關，請在回應中適當地區分或整合這些資訊。

**範例：**

1.  **使用者請求：** "剛剛麥克風提到下週會議的日期是什麼時候？"
    **你的理想回應（基於音訊內容）：** "根據麥克風的錄音內容，下週的會議安排在星期三下午兩點。" (直接回答問題，指出資訊來源)

2.  **使用者請求：** "總結一下系統音訊中關於新專案目標的討論。"
    **你的理想回應（基於音訊內容）：** "系統音訊的討論中提到，新專案的主要目標是提高使用者參與度 15%，並在第三季推出 Beta 版本。他們還討論了初步的行銷策略。" (總結對話要點)

3.  **使用者請求：** "搜尋剛剛提到的 '量子糾纏' 這個概念。"
    **你的理想回應（基於音訊內容）：** "根據對話中提到的 '量子糾纏'，這是一個量子力學中的現象... [簡要解釋]。您可能想搜尋：'量子糾纏的解釋'、'量子糾纏應用'。" (根據對話內容提供解釋和搜尋建議)

請避免像「這個音檔聽起來很清晰」或「麥克風音訊的長度是 15 秒」這樣的回應，而是專注於音訊傳達的 *資訊*。`;

    // console.log("Formatted messages sent to AI:", JSON.stringify(formatted, null, 2)); // DEBUG: Log formatted messages

    const { text } = await generateText({
      // DO NOT CHANGE THIS MODEL
      model: google("gemini-2.0-flash-001", {
        useSearchGrounding: true,
      }),
      system: systemPrompt, // Add the system prompt here
      messages: formatted,
    });

    return NextResponse.json({ content: text });
  } catch (e: unknown) {
    console.error("AI API Error:", e); // Log the full error server-side
    const errorMessage =
      e instanceof Error ? e.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
