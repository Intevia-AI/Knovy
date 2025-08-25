
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@workspace/ui/components/form'
import { Toaster, toast } from 'sonner'

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
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success('加入成功！')
        form.reset()
      } else {
        toast.error(result.error || '加入失敗，請再試一次。')
      }
    } catch (error) {
      toast.error('加入失敗，請再試一次。')
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
