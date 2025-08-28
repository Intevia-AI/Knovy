/**
 * @module FeedbackAPI
 * @description API endpoint for handling user feedback submissions
 */
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * @function POST
 * @description Handles POST requests to submit user feedback via email
 * @route POST /api/feedback
 * @param {Request} req - The incoming HTTP request object
 *
 * @requestBody {Object} - The request body containing feedback text
 * @requestExample
 * {
 *   "feedback": "I really like the new feature, but I found a bug when..."
 * }
 *
 * @responseBody {Object} - Success message when feedback is sent
 * @responseExample
 * {
 *   "message": "Feedback sent successfully"
 * }
 *
 * @errorResponse {Object} - Error message when feedback submission fails
 * @errorExample
 * {
 *   "message": "Error sending feedback"
 * }
 *
 * @returns {Promise<NextResponse>} JSON response indicating success or failure
 */
export async function POST(req: Request) {
  const { feedback } = await req.json();

  // Create email transporter using Gmail with app password
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  // Configure email content
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.GMAIL_USER, // Sending to self (the admin email)
    subject: "Feedback from user",
    text: feedback,
  };

  try {
    // Send the email with feedback
    await transporter.sendMail(mailOptions);
    return NextResponse.json({ message: "Feedback sent successfully" });
  } catch (error) {
    console.error("Error sending feedback:", error);
    // Return a 500 error response
    return NextResponse.json({ message: "Error sending feedback" }, { status: 500 });
  }
}
