"use client";

import { useLanguage } from "@/context/language-context";
import { createClient } from "@supabase/supabase-js";
import * as z from "zod";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@workspace/ui/components/form";
import { Toaster, toast } from "sonner";
import { useForm } from "react-hook-form";

// Create the Supabase client once outside the component to avoid multiple instances.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function WaitlistForm() {
  const { t, locale } = useLanguage();

  const formSchema = z.object({
    email: z.string().email({ message: t("auth.validation.invalid_email") }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onSubmit", // Only validate on submit to avoid real-time errors
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Clear any previous validation errors
    form.clearErrors();
    
    // Validate the form manually and show toast if invalid
    const validationResult = formSchema.safeParse(values);
    if (!validationResult.success) {
      const emailError = validationResult.error.errors.find(err => err.path[0] === 'email');
      if (emailError) {
        toast.error(emailError.message, {
          // description: emailError.message,
          duration: 4000,
        });
        return;
      }
    }

    await supabase.functions.invoke("add-to-waitlist", {
      body: { ...values, locale },
    }).then((res) => {
      if (res.error) {
        let errorMessage = t("waitlist.toast.error"); // Default message

        if (res.error.context?.status === 409) {
          errorMessage = t("waitlist.toast.duplicate_email");
        } else if (res.error.context?.error) {
          errorMessage = res.error.context.error;
        }

        toast.error(errorMessage);
      } else {
        toast.success(t("waitlist.toast.success"));
        form.reset();
      }
    });
  }

  return (
    <>
      <Toaster />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full max-w-md items-center space-x-2"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input
                    placeholder={t("waitlist.form.placeholder")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t("waitlist.form.submitting")
              : t("waitlist.form.submit")}
          </Button>
        </form>
      </Form>
    </>
  );
}
