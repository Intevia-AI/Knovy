// node mailer
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  const { feedback } = await req.json();
  // use google + app password
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.GMAIL_USER,
    subject: "Feedback from user",
    text: feedback,
  };
  try {
    await transporter.sendMail(mailOptions);
    return NextResponse.json({ message: "Feedback sent successfully" });
  } catch (error) {
    console.error("Error sending feedback:", error);
    return NextResponse.json(
      { message: "Error sending feedback" },
      { status: 500 },
    );
  }
}
