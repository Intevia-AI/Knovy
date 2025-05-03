import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const blobToBase64 = (b: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? res(reader.result) : rej();
    reader.onerror = rej;
    reader.readAsDataURL(b);
  });

export const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

export const cleanupStream = (
  ref: React.MutableRefObject<MediaStream | null>,
) => {
  ref.current?.getTracks().forEach((t) => t.stop());
  ref.current = null;
};

export const cleanupRecorder = (
  ref: React.MutableRefObject<MediaRecorder | null>,
) => {
  if (ref.current && ref.current.state !== "inactive") {
    ref.current.ondataavailable = null;
    ref.current.onstop = null;
    ref.current.onerror = null;
    try {
      ref.current.stop();
    } catch (e) {
      console.warn("Error stopping recorder during cleanup:", e);
    }
  }
  ref.current = null;
};
