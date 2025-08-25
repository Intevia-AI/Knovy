import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

serve(async (req) => {
  const { record } = await req.json()

  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: record.email,
      subject: 'Welcome to the Waitlist!',
      html: '<strong>Thanks for joining our waitlist!</strong> We will notify you when we launch.'
    });

    if (error) {
      return new Response(JSON.stringify(error), { status: 500 })
    }

    return new Response(JSON.stringify(data), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})