import { NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import tmp from "tmp";
import { promisify } from "util";

// Promisify tmp functions
const tmpName = promisify(tmp.tmpName);
const tmpCleanup = promisify(tmp.setGracefulCleanup); // Optional: better cleanup
tmpCleanup(); // Call once to set up graceful cleanup

// --- Constants -----------------------------------------------
const MAX_TRIM_SECONDS = 20;
const TARGET_MIME_TYPE = "audio/wav";

// Helper function to run ffmpeg command asynchronously
function runFfmpeg(command: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .on("error", (err) => {
        console.error("ffmpeg error:", err.message);
        reject(new Error(`ffmpeg processing failed: ${err.message}`));
      })
      .on("end", () => {
        console.log("ffmpeg processing finished successfully");
        resolve();
      })
      .run();
  });
}

// Helper function to get audio duration using ffprobe
function getAudioDuration(filePath: string): Promise<number | null> {
  // Return null on failure
  return new Promise((resolve) => {
    // Don't reject, just resolve with null
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error("ffprobe error:", err.message);
        // Don't reject, resolve with null to indicate failure
        return resolve(null);
      }
      // Check if duration is a valid number
      if (
        metadata?.format?.duration &&
        typeof metadata.format.duration === "number" &&
        isFinite(metadata.format.duration)
      ) {
        resolve(metadata.format.duration);
      } else {
        console.warn(
          "Could not determine a valid audio duration from metadata.",
        );
        resolve(null); // Resolve with null if duration is invalid/missing
      }
    });
  });
}

interface ProcessAudioRequest {
  audioData: string; // Base64 encoded audio blob
  originalMimeType: string; // Mime type of the original blob (useful for logging)
}

export async function POST(req: Request) {
  let tempInputPath: string | null = null;
  let tempOutputPath: string | null = null;

  try {
    const { audioData, originalMimeType }: ProcessAudioRequest =
      await req.json();
    console.log(
      `[Server Process] Received audio. Original type: ${originalMimeType}`,
    );

    if (!audioData) {
      return NextResponse.json({ error: "Missing audioData" }, { status: 400 });
    }

    // 1. Decode Base64 and write to temporary input file
    const audioBuffer = Buffer.from(audioData, "base64");
    // Determine a suitable extension based on mime type, default if unknown
    tempInputPath = await tmpName();
    await fs.writeFile(tempInputPath, audioBuffer);
    console.log(
      `[Server Process] Wrote ${audioBuffer.length} bytes to temp input: ${tempInputPath}`,
    );

    // 2. Get duration using ffprobe
    const duration = await getAudioDuration(tempInputPath);
    let startSec = 0; // Default start time to 0

    if (duration !== null && duration > 0) {
      console.log(`[Server Process] Detected duration: ${duration}s`);
      // 3. Calculate trim start time ONLY if duration is valid
      startSec = Math.max(duration - MAX_TRIM_SECONDS, 0);
    } else {
      console.warn(
        `[Server Process] Could not get valid duration. Processing entire audio.`,
      );
      // Keep startSec = 0
    }

    console.log(`[Server Process] Trimming from ${startSec.toFixed(2)}s`);

    // 4. Create temporary output path
    tempOutputPath = await tmpName();

    // 5. Process with ffmpeg (trim and convert to WAV)
    const command = ffmpeg(tempInputPath)
      .setStartTime(startSec) // Pass the calculated or default startSec
      .toFormat("wav") // Output format WAV
      .outputOptions([
        // Ensure standard WAV format (e.g., 16-bit PCM)
        "-acodec pcm_s16le", // Signed 16-bit Little Endian PCM
        // '-ar 16000',       // Optional: Resample audio rate if needed
        // '-ac 1'            // Optional: Force mono channel if needed
      ])
      .output(tempOutputPath);

    await runFfmpeg(command);

    // 6. Read the processed WAV file
    const processedWavBuffer = await fs.readFile(tempOutputPath);
    console.log(
      `[Server Process] Read processed WAV: ${processedWavBuffer.length} bytes from ${tempOutputPath}`,
    );

    // 7. Base64 encode the result for JSON transport
    const processedAudioData = processedWavBuffer.toString("base64");

    return NextResponse.json({
      processedAudioData,
      processedMimeType: TARGET_MIME_TYPE,
    });
  } catch (error) {
    console.error("[Process Audio API Error]:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Audio processing failed: ${errorMessage}` },
      { status: 500 },
    );
  } finally {
    // 8. Clean up temporary files
    try {
      if (tempInputPath) await fs.unlink(tempInputPath);
      if (tempOutputPath) await fs.unlink(tempOutputPath);
      console.log("[Server Process] Cleaned up temp files.");
    } catch (cleanupError) {
      console.error(
        "[Server Process] Error cleaning up temp files:",
        cleanupError,
      );
    }
  }
}
