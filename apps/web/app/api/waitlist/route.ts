import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// It's better to create the client inside the route handler
// to ensure environment variables are loaded correctly in the serverless environment.
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.from("waitlist").insert([{ email }]).select();

    if (error) {
      // Log the full error to the console for better debugging
      console.error("Supabase error:", error);

      if (error.code === "23505") {
        // Unique violation
        return NextResponse.json({ error: "Email already on waitlist" }, { status: 409 });
      }

      return NextResponse.json(
        {
          error: "Error adding to waitlist",
          details: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Successfully added to waitlist", data }, { status: 201 });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
