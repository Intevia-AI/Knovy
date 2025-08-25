
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@workspace/ui/components/form'
import { Toaster, toast } from 'sonner'
import { createClient } from '@supabase/supabase-js'

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
})

export function WaitlistForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.functions.invoke('add-to-waitlist', {
        body: values,
      });

      if (error) {
        toast.error(error.message || '加入失敗，請再試一次。');
      } else {
        toast.success('加入成功！您很快就會收到一封確認信。');
        form.reset();
      }
    } catch (error) {
      toast.error('加入失敗，請再試一次。');
    }
  }

  return (
    <>
      <Toaster />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full max-w-md items-center space-x-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input placeholder="輸入您的電子郵件" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '加入中...' : '加入測試候補名單'}
          </Button>
        </form>
      </Form>
    </>
  )
}
