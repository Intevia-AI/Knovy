"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TextEffect } from "@workspace/ui/components/text-effect";
import { DemoComponent } from "@/components/demo";
import { Button } from "@workspace/ui/components/button";
import { useState } from "react";

export function HeroSection() {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const handleFeedbackSubmit = async () => {
    if (!feedback.trim()) {
      return;
    }
    setIsSubmitting(true);
    setSubmitStatus("idle");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ feedback }),
      });

      if (response.ok) {
        setFeedback("");
        setSubmitStatus("success");
        console.log("Feedback submitted successfully!");
        setTimeout(() => setSubmitStatus("idle"), 3000);
      } else {
        console.error("Failed to submit feedback");
        setSubmitStatus("error");
        setTimeout(() => setSubmitStatus("idle"), 3000);
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setSubmitStatus("error");
      setTimeout(() => setSubmitStatus("idle"), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main className="overflow-hidden" id="home">
        <div
          aria-hidden
          className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block"
        >
          <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
        </div>
        <section>
          <div className="relative pt-24 md:pt-36">
            <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]"></div>
            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                <Link
                  href="#link"
                  className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5 dark:shadow-zinc-950"
                >
                  <span className="text-foreground text-sm">
                    隆重介紹：全方位AI開會神器
                  </span>
                  <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700"></span>
                  <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                    <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                      <span className="flex size-6">
                        <ArrowRight className="m-auto size-3" />
                      </span>
                      <span className="flex size-6">
                        <ArrowRight className="m-auto size-3" />
                      </span>
                    </div>
                  </div>
                </Link>

                <TextEffect
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  as="h1"
                  className="mt-8 text-balance text-6xl md:text-7xl lg:mt-16 xl:text-[5.25rem]"
                >
                  你的個人會議神器 – INTEVIA AI
                </TextEffect>
                <TextEffect
                  per="line"
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  delay={0.5}
                  as="p"
                  className="mx-auto mt-8 max-w-2xl text-balance text-lg"
                >
                  全方位AI開會神器
                </TextEffect>
                <TextEffect
                  per="line"
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  delay={0.5}
                  as="p"
                  className="mx-auto mt-8 max-w-2xl text-balance text-lg"
                >
                  Your Personal Meeting Cheater – INTEVIA AI
                </TextEffect>
              </div>
            </div>

            <div className="mx-auto max-w-5xl p-6 mt-12 lg:mt-16">
              <DemoComponent />
            </div>

            {/* Feedback Section */}
            <div className="mt-12 max-w-xl mx-auto text-left px-6 pb-12">
              <h3 className="text-xl font-semibold mb-2 text-center">
                使用回饋
              </h3>
              <p className="mb-4 text-sm text-muted-foreground text-center">
                我們只花了兩週時間開發這個原型，請幫助我們改進。
              </p>
              <textarea
                placeholder="請在此輸入您的回饋..."
                rows={4}
                className="w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-muted"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={isSubmitting}
              />
              <Button
                className="mt-4 w-full"
                onClick={handleFeedbackSubmit}
                disabled={isSubmitting || !feedback.trim()}
              >
                {isSubmitting ? "提交中..." : "提交回饋"}
              </Button>
              {submitStatus === "success" && (
                <p className="mt-2 text-sm text-green-600 text-center">
                  感謝您的回饋！
                </p>
              )}
              {submitStatus === "error" && (
                <p className="mt-2 text-sm text-red-600 text-center">
                  提交失敗，請稍後再試。
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
