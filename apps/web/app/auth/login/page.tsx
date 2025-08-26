"use client";

import { Logo } from "@/components/logo";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useLanguage } from "@/context/language-context";

export default function LoginPage() {
  const { t } = useLanguage();

  const formSchema = z.object({
    email: z.string().email({ message: t("auth.validation.invalid_email") }),
    password: z.string().min(12, {
      message: t("auth.validation.password_too_short").replace("{minLength}", "12"),
    }),
  });

  // Initialize form with React Hook Form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Form submission handler
  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    // Add your authentication logic here
  }

  return (
    <section className="flex min-h-screen bg-zinc-50 px-4 py-16 md:py-32 dark:bg-transparent">
      <div className="bg-muted m-auto h-fit w-full max-w-sm overflow-hidden rounded-[calc(var(--radius)+.125rem)] border shadow-md shadow-zinc-950/5 dark:[--color-muted:var(--color-zinc-900)]">
        <div className="bg-card -m-px rounded-[calc(var(--radius)+.125rem)] border p-8 pb-6">
          <div className="text-center">
            <Link href="/" aria-label="go home" className="mx-auto block w-fit">
              <Logo />
            </Link>
            <h1 className="mb-1 mt-4 text-xl font-semibold">
              {t("auth.login.title")}
            </h1>
            <p className="text-sm">{t("auth.login.subtitle")}</p>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-6 space-y-6"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel htmlFor="email" className="block text-sm">
                      {t("auth.form.email_label")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        id="email"
                        placeholder={t("auth.form.email_placeholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <FormLabel
                        htmlFor="password"
                        className="text-title text-sm"
                      >
                        {t("auth.form.password_label")}
                      </FormLabel>
                      <Button variant="link" size="sm">
                        <Link
                          href="/auth/forgot-password"
                          className="link intent-info variant-ghost text-sm"
                        >
                          {t("auth.login.forgot_password")}
                        </Link>
                      </Button>
                    </div>
                    <FormControl>
                      <Input
                        type="password"
                        id="password"
                        className="input sz-md variant-mixed"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                {t("auth.login.submit_button")}
              </Button>
            </form>
          </Form>

          <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <hr className="border-dashed" />
            <span className="text-muted-foreground text-xs">
              {t("auth.form.continue_with_divider")}
            </span>
            <hr className="border-dashed" />
          </div>

          <div className="w-full">
            <Button type="button" className="w-full" variant="outline">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="0.98em"
                height="1em"
                viewBox="0 0 256 262"
                className="mr-2 h-4 w-4"
              >
                <path
                  fill="#4285f4"
                  d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                ></path>
                <path
                  fill="#34a853"
                  d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                ></path>
                <path
                  fill="#fbbc05"
                  d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
                ></path>
                <path
                  fill="#eb4335"
                  d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                ></path>
              </svg>
              {t("auth.form.google_button")}
            </Button>
          </div>
        </div>

        <div className="p-3">
          <p className="text-accent-foreground text-center text-sm">
            {t("auth.login.no_account_prompt")}
            <Link href="/auth/register">
              <Button variant="link" className="px-2">
                {t("auth.login.create_account_link")}
              </Button>
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
