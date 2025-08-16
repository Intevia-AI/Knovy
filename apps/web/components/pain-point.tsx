"use client";
import { Annoyed, Search, BookOpen } from "lucide-react";

export function PainPoint() {
  return (
    <div className="relative z-10 mx-auto max-w-5xl space-y-12 py-12 md:py-20 lg:py-24">
      <div className="space-y-6 text-center">
        <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
          您是否也有這樣的困擾？
        </h2>
        <p className="text-lg text-muted-foreground text-center font-bold">
          「我們人在參與，心卻無法專注其中。」
        </p>
        <p className="text-lg text-muted-foreground">
          從線上會議、遠距課程、業務簡報、跨部門溝通等場景，我們早已習慣邊開著會議視窗，邊在 Google、ChatGPT、雲端硬碟間切換視窗。我們查找資料、做筆記和回應訊息，試圖一心多用，但卻沒有真正推動進度。
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Annoyed className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">頻繁切換視窗</h3>
          <p className="text-muted-foreground">注意力分散</p>
        </div>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">跟不上討論的內容</h3>
          <p className="text-muted-foreground">無法即時捕捉來龍去脈</p>
        </div>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">糟糕準備不充分</h3>
          <p className="text-muted-foreground">無法適時做出有效回應</p>
        </div>
      </div>
    </div>
  );
}
