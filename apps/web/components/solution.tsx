"use client";
"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";
import { Briefcase, Play, Settings } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export function Solution() {
  const { t } = useLanguage();
  return (
    <div className="relative z-10 mx-auto max-w-5xl space-y-12 py-12 md:py-20 lg:py-24">
      <div className="space-y-6 text-center">
        <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
          {t("solution.title")}
        </h2>
        <p className="text-lg text-muted-foreground">
          {t("solution.description_p1")}
          <span className="font-bold">{t("solution.description_highlight")}</span>
          {t("solution.description_p2")}
        </p>
      </div>
      <WorkingStages />
      {/* <SolutionAccordion /> */}
    </div>
  );
}

function WorkingStages() {
  const { t } = useLanguage();
  return (
    <div className="relative z-10 mx-auto max-w-5xl space-y-12">
      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">{t("solution.stage1.title")}</h3>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>{t("solution.stage1.item1")}</li>
            <li>{t("solution.stage1.item2")}</li>
            <li>{t("solution.stage1.item3")}</li>
          </ul>
        </div>
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Play className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">{t("solution.stage2.title")}</h3>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>{t("solution.stage2.item1")}</li>
            <li>{t("solution.stage2.item2")}</li>
            <li>{t("solution.stage2.item3")}</li>
            <li>{t("solution.stage2.item4")}</li>
            <li>{t("solution.stage2.item5")}</li>
          </ul>
        </div>
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">{t("solution.stage3.title")}</h3>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>{t("solution.stage3.item1")}</li>
            <li>{t("solution.stage3.item2")}</li>
            <li>{t("solution.stage3.item3")}</li>
            <li>{t("solution.stage3.item4")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function SolutionAccordion() {
  return (
<div className="mx-auto max-w-3xl">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>不切畫面、不分心打字</AccordionTrigger>
            <AccordionContent>
              以工具列形式常駐於工作畫面旁，<span className="font-bold">無須切換視窗，更不用打字</span>，只要說話、滑鼠點擊，就能獲得支援。
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>即時語音與畫面感知</AccordionTrigger>
            <AccordionContent>
              同步感知您的語音和螢幕內容，<span className="font-bold">主動提供有價值的資訊、問題與建議</span>。
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>多語即時字幕</AccordionTrigger>
            <AccordionContent>
              支援多語言即時字幕生成，讓跨國溝通不再受限。
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger>會議結束後的完整回饋</AccordionTrigger>
            <AccordionContent>
              提供逐字稿、摘要、待辦事項，甚至根據您在會議的表現，提供<span className="font-bold">分析與建議</span>。
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-5">
            <AccordionTrigger>文件與目標整合（開發中）</AccordionTrigger>
            <AccordionContent>
              會議前上傳文件、任務目標、議程等背景知識，INTEVIA 將在您需要時自動引用，不用再手動翻資料。
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-6">
            <AccordionTrigger>Agentic 功能（開發中）</AccordionTrigger>
            <AccordionContent>
              我們正在開發更主動的 Agent，未來只須說出需求（如修改檔案、查詢資料或安排會議），就能<span className="font-bold">自動執行任務</span>。
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
  );
}