import React, { memo } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface KeywordHighlighterProps {
  text: string
  keywords?: string[]
  onKeywordClick?: (keyword: string) => void
}

interface TextSegment {
  text: string
  isKeyword: boolean
  keyword?: string
}

/**
 * Highlights keywords in text by wrapping them in styled spans.
 * Matches the styling of inline code from MarkdownRenderer.
 * Supports optional click handlers for keyword search functionality.
 */
const NonMemoizedKeywordHighlighter: React.FC<KeywordHighlighterProps> = ({
  text,
  keywords = [],
  onKeywordClick
}) => {
  const { hasEntitlement } = useAuth()
  const canUseKeywordSearch = hasEntitlement('allow_ai_action:keyword-search')

  // If no keywords, return plain text
  if (!keywords || keywords.length === 0) {
    return <>{text}</>
  }

  // Build segments by finding keyword positions in text
  const segments: TextSegment[] = []
  let currentIndex = 0

  // Sort keywords by length (descending) to prioritize longer matches
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length)

  while (currentIndex < text.length) {
    let foundMatch = false
    let longestMatch: { keyword: string; index: number } | null = null

    // Find the earliest occurring keyword from current position
    for (const keyword of sortedKeywords) {
      const index = text.indexOf(keyword, currentIndex)
      if (index !== -1 && index >= currentIndex) {
        // If this is the first match or it occurs earlier than previous matches
        if (!longestMatch || index < longestMatch.index) {
          longestMatch = { keyword, index }
        }
        // If at same position, keep the longer one (already sorted by length)
        else if (index === longestMatch.index && keyword.length > longestMatch.keyword.length) {
          longestMatch = { keyword, index }
        }
      }
    }

    if (longestMatch) {
      // Add text before keyword if any
      if (longestMatch.index > currentIndex) {
        segments.push({
          text: text.substring(currentIndex, longestMatch.index),
          isKeyword: false
        })
      }

      // Add keyword segment
      segments.push({
        text: longestMatch.keyword,
        isKeyword: true,
        keyword: longestMatch.keyword
      })

      currentIndex = longestMatch.index + longestMatch.keyword.length
      foundMatch = true
    }

    if (!foundMatch) {
      // No more keywords found, add remaining text
      segments.push({
        text: text.substring(currentIndex),
        isKeyword: false
      })
      break
    }
  }

  const isClickableKeyword = canUseKeywordSearch && onKeywordClick

  return (
    <>
      {segments.map((segment, index) => {
        if (!segment.isKeyword) {
          return <React.Fragment key={index}>{segment.text}</React.Fragment>
        }

        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation()
          if (onKeywordClick && canUseKeywordSearch && segment.keyword) {
            console.log(
              `[KeywordHighlighter] Keyword clicked: "${segment.keyword}". Calling onKeywordClick prop.`
            )
            onKeywordClick(segment.keyword)
          }
        }

        return (
          <span
            key={index}
            onClick={isClickableKeyword ? handleClick : undefined}
            className={cn(
              isClickableKeyword
                ? 'bg-muted rounded-lg px-1 py-0.5 text-sm hover:bg-muted/80 cursor-pointer'
                : 'bg-muted rounded-lg px-1 py-0.5 text-sm' // Non-clickable styling for free users
            )}
          >
            {segment.text}
          </span>
        )
      })}
    </>
  )
}

export const KeywordHighlighter = memo(
  NonMemoizedKeywordHighlighter,
  (prevProps, nextProps) =>
    prevProps.text === nextProps.text &&
    JSON.stringify(prevProps.keywords) === JSON.stringify(nextProps.keywords) &&
    prevProps.onKeywordClick === nextProps.onKeywordClick
)

KeywordHighlighter.displayName = 'KeywordHighlighter'
