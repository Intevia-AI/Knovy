"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import {
  ChartBarIncreasingIcon,
  Database,
  Fingerprint,
  IdCard,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BorderBeam } from "@workspace/ui/components/border-beam";

export function FeaturesSection() {

  return (
    <section className="py-12 md:py-20 lg:py-32" id="features">
      <div className="bg-linear-to-b absolute inset-0 -z-10 sm:inset-6 sm:rounded-b-3xl dark:block dark:to-[color-mix(in_oklab,var(--color-zinc-900)_75%,var(--color-background))]"></div>
      <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16 lg:space-y-20 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        {/* Pain Point Section */}
        <div className="relative z-10 mx-auto max-w-3xl space-y-6 text-center">
          <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
            我們看到的痛點
          </h2>
          <p className="text-lg text-muted-foreground">
            隨著線上開會愈來愈普遍，人們已習慣開著會議軟體的視窗，有需要便跳出去Google、ChatGPT查資料或是瀏覽文件，這樣其實是非常不直觀和方便的操作。頻繁切換視窗的同時，又要聽別人在講什麼，還要隨時做筆記，如果這時候又有人問你的意見，你卻恍神，那就糟了，這一切都令人手忙腳亂和不便。
            <br /><br />
            在研究市面上線上會議的AI後，我們發現大部分工具是專注在「會議後」的統整功能，比如逐字稿、摘要、代辦事項等，但很少專注在「會議當下」即時協助的AI工具。至於線上面試AI，其性質比較像面試作弊神器，重點功能在即時問題的擬答，但需使用自帶的介面和網頁，再將會議軟體的畫面導入，我們認為這會造成使用者的不直覺和不安全感。
            <br /><br />
            因此，我們決定做一個結合會議面試兩者工具，不論是公司內部會議、學業報告討論、面試、客戶溝通都能適用，兼顧會議前、中、後，並且以工具列的形式呈現的全方位AI meeting Assistant。讓使用者僅需停留在原本視訊畫面，不需切換視窗及可在同個畫面使用工具。
          </p>
        </div>

        {/* Solution Section */}
        <div className="relative z-10 mx-auto max-w-3xl space-y-6 text-center">
          <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
            解方
          </h2>
          <p className="text-lg text-muted-foreground">
            我們希望打造一個極致方便的。透過 INTEVIA AI，讓你彷彿拿到knowledge buff一樣，不論是開什麼會都有如神助，也減少不必要的多餘操作，讓你可以專心在會議本身。
            <br /><br />
            第一，我們的AI讓你不需要切任何視窗，只要點選在會議畫面旁邊開著的工具列就好。第二，你不需要動手打任何一個字，我們的AI會隨時"和你一起"開會，將聽到的資訊實時輸入進AI，也包含即時讀取你的畫面，然後根據內容自動持續的輸出可能可以幫助你的答案、問題、資訊。當然，你也可以針對這些生成的內容做選擇，只要動動滑鼠。
            <br /><br />
            不只這樣，你還能事先上傳會議的相關文件、會議目標、議程給INTEVIA，他會在你開會中需要的時候及時跳出，再也不用自己翻文件。除此之外，INTEVIA也將包含real time 的翻譯和字幕，還有口音的強化及修正，不論是哪國語言、哪種口音，都不用擔心有溝通障礙。
            <br /><br />
            最後，其他Meeting AI有的功能，我們也會有，包括會後的摘要、代辦事項、deadline和逐字稿。我們也會替你的會議表現、口才評分，給您最直接的建議。當然，要使用我們的AI去面試也沒有問題。
          </p>
        </div>

        {/* Key Features Section */}
        <div className="relative z-10 mx-auto max-w-4xl space-y-12">
          <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
            產品主要功能
          </h2>
          <div className="grid gap-12 md:grid-cols-3">
            {/* Before Meeting */}
            <div className="space-y-4 rounded-lg border bg-card p-6"><h3 className="text-xl font-semibold">會議前</h3><ul className="list-disc space-y-2 pl-5 text-muted-foreground"><li>設定會議目標、主題、成員、氛圍</li><li>上傳相關文件(文件、報告、履歷、職缺描述、新聞)</li><li>設定語言與口音</li></ul></div>
            {/* During Meeting */}
            <div className="space-y-4 rounded-lg border bg-card p-6"><h3 className="text-xl font-semibold">會議中 (即時)</h3><ul className="list-disc space-y-2 pl-5 text-muted-foreground"><li>智慧搜尋 (查資料)</li><li>建議回答</li><li>問題產生</li><li>即時摘要</li><li>即時字幕和翻譯</li><li>口音調整/強化</li></ul></div>
            {/* After Meeting */}
            <div className="space-y-4 rounded-lg border bg-card p-6"><h3 className="text-xl font-semibold">會議後</h3><ul className="list-disc space-y-2 pl-5 text-muted-foreground"><li>會議逐字稿、摘要</li><li>代辦事項、死線</li><li>表現評分與建議</li></ul></div>
          </div>
        </div>

      </div>
    </section>
  );
}
