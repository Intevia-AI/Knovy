import React, { memo } from 'react'

interface StreamingTextProps {
  text: string
  isStreaming?: boolean
}

/**
 * Presentational streamed-text view: renders text and, while streaming, a
 * blinking cursor. Reusable for any token-streamed output. The token
 * subscription and buffering live in the owning hook, not here.
 */
const NonMemoizedStreamingText: React.FC<StreamingTextProps> = ({ text, isStreaming }) => {
  return (
    <span>
      {text}
      {isStreaming && (
        <span className="ml-0.5 inline-block w-1.5 h-4 align-text-bottom bg-current animate-pulse" />
      )}
    </span>
  )
}

export const StreamingText = memo(
  NonMemoizedStreamingText,
  (prev, next) => prev.text === next.text && prev.isStreaming === next.isStreaming
)

StreamingText.displayName = 'StreamingText'
