
'use client'

import { useLanguage } from "@/context/language-context";
import { createClient } from '@supabase/supabase-js'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@workspace/ui/components/form'
import { Toaster, toast } from 'sonner'
import { useForm } from 'react-hook-form'

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
})

export function WaitlistForm() {
  const { t } = useLanguage();

  const formSchema = z.object({
    email: z.string().email({ message: t("auth.validation.invalid_email") }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error } = await supabase.functions.invoke("add-to-waitlist", {
        body: values,
      });

      if (error) {
        toast.error(error.message || t("waitlist.toast.error"));
      } else {
        toast.success(t("waitlist.toast.success"));
        form.reset();
      }
    } catch (error) {
      toast.error(t("waitlist.toast.error"));
    }
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
                <FormMessage />
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
