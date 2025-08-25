
import { WaitlistForm } from './waitlist-form'

export function WaitlistSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">加入測試候補名單</h2>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          不要再猶豫了，現在就加入測試候補名單，搶先體驗我們的產品！
        </p>
        <div className="mt-8 flex justify-center">
          <WaitlistForm />
        </div>
      </div>
    </section>
  )
}
