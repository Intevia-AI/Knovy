/**
 * @fileoverview Utility functions for UI and media handling
 * @module utils
 * @description Collection of utility functions for class name merging, media handling, and formatting
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines multiple class values using clsx and tailwind-merge
 *
 * @param {...ClassValue[]} inputs - Class values to be merged
 * @returns {string} Combined class string with conflicts resolved by tailwind-merge
 *
 * @example
 * // Combine Tailwind classes with conditional classes
 * cn('text-red-500', isActive && 'bg-blue-200', 'p-4')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a Blob to a base64 encoded string
 *
 * @param {Blob} b - The Blob to convert
 * @returns {Promise<string>} Promise resolving to the base64 encoded string
 *
 * @example
 * // Convert an audio blob to base64
 * const base64Data = await blobToBase64(audioBlob);
 */
export const blobToBase64 = (b: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? res(reader.result) : rej())
    reader.onerror = rej
    reader.readAsDataURL(b)
  })

/**
 * Formats seconds into MM:SS time format
 *
 * @param {number} s - Time in seconds
 * @returns {string} Formatted time string in MM:SS format
 *
 * @example
 * // Format 75 seconds as "1:15"
 * const timeDisplay = formatTime(75);
 */
export const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

/**
 * Safely cleans up a MediaStream by stopping all tracks and clearing the reference
 *
 * @param {React.MutableRefObject<MediaStream | null>} ref - React ref containing the MediaStream
 * @returns {void}
 *
 * @example
 * // Clean up a stream when component unmounts
 * useEffect(() => {
 *   return () => cleanupStream(streamRef);
 * }, []);
 */
export const cleanupStream = (ref: React.MutableRefObject<MediaStream | null>) => {
  ref.current?.getTracks().forEach((t) => t.stop())
  ref.current = null
}

/**
 * Safely cleans up a MediaRecorder by stopping recording and clearing the reference
 *
 * @param {React.MutableRefObject<MediaRecorder | null>} ref - React ref containing the MediaRecorder
 * @returns {void}
 *
 * @example
 * // Clean up a recorder when component unmounts
 * useEffect(() => {
 *   return () => cleanupRecorder(recorderRef);
 * }, []);
 */
export const cleanupRecorder = (ref: React.MutableRefObject<MediaRecorder | null>) => {
  if (ref.current && ref.current.state !== 'inactive') {
    ref.current.ondataavailable = null
    ref.current.onstop = null
    ref.current.onerror = null
    try {
      ref.current.stop()
    } catch (e) {
      console.warn('Error stopping recorder during cleanup:', e)
    }
  }
  ref.current = null
}
