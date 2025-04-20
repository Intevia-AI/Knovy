import { Button } from "@workspace/ui/components/button";
import { Mail, SendHorizonal } from "lucide-react";

export default function CallToAction() {
  return (
    <section className="py-16 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-4xl font-semibold lg:text-5xl">
            訂閱以獲取未來更新！
          </h2>
          <p className="mt-4 text-muted-foreground">如果您對我們的產品有興趣，請填入電子信箱，當新版本釋出時會通知您！</p>

          <form action="" className="mx-auto mt-10 max-w-sm lg:mt-12">
            <div className="bg-background has-[input:focus]:ring-muted relative grid grid-cols-[1fr_auto] items-center rounded-[calc(var(--radius)+0.75rem)] border pr-3 shadow shadow-zinc-950/5 has-[input:focus]:ring-2">
              <Mail className="text-caption pointer-events-none absolute inset-y-0 left-5 my-auto size-5" />

              <input
                placeholder="填入您的電子信箱以獲取更新"
                className="h-14 w-full bg-transparent pl-12 focus:outline-none"
                type="email"
              />

              <div className="md:pr-1.5 lg:pr-0">
                <Button aria-label="submit" className="rounded-(--radius)">
                  <span className="hidden md:block">通知我</span>
                  <SendHorizonal
                    className="relative mx-auto size-5 md:hidden"
                    strokeWidth={2}
                  />
                </Button>
              </div>
            </div>
          </form>

          {/* Feedback Section */}
          <div className="mt-12 max-w-xl mx-auto text-left">
             <h3 className="text-xl font-semibold mb-2 text-center">使用回饋</h3>
             <p className="mb-4 text-sm text-muted-foreground text-center">我們只花了兩週時間開發這個原型，請幫助我們改進。</p>
             <textarea
                placeholder="請在此輸入您的回饋..."
                rows={4}
                className="w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-muted"
             />
             <Button className="mt-4 w-full">提交回饋</Button>
          </div>

        </div>
      </div>
    </section>
  );
}