'use client'
import React, { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  children: string
  pure?: boolean
  onKeywordClick?: (keyword: string) => void
}

const NonMemoizedMarkdown: React.FC<MarkdownProps> = ({
  children,
  pure = false,
  onKeywordClick
}) => {
  const parsedContent = children.replace(/<br\s*\/?\?>/g, '\n').replace(/~/g, '-')
  const plugins = [remarkGfm, remarkBreaks]

  const markdownComponents: Partial<Components> = {
    code: ({ node, className, children, ...props }) => {
      const keyword = String(children)
      const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (onKeywordClick) {
          console.log(`[Markdown] Keyword clicked: "${keyword}". Calling onKeywordClick prop.`)
          onKeywordClick(keyword)
        }
      }

      return (
        <span
          {...props}
          onClick={onKeywordClick ? handleClick : undefined}
          className={cn(
            className,
            'bg-muted rounded-lg px-1 py-0.5 text-sm hover:bg-muted/80 cursor-pointer'
          )}
        >
          {children}
        </span>
      )
    },

    ol: ({ children, ...props }) => (
      <ol className="ml-4 list-outside list-decimal" {...props}>
        {children}
      </ol>
    ),

    li: ({ children, ...props }) => (
      <li className="py-1" {...props}>
        {children}
      </li>
    ),

    ul: ({ children, ...props }) => (
      <ul className="ml-4 list-outside list-disc" {...props}>
        {children}
      </ul>
    ),

    strong: ({ children, ...props }) => (
      <strong className="font-semibold" {...props}>
        {children}
      </strong>
    ),

    a: ({ children, href, ...props }) => {
      const handleExternalLink = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        if (href && window.electronAPI?.openExternal) {
          window.electronAPI.openExternal(href)
        }
      }
      return (
        <a
          className="text-blue-500 hover:underline"
          href={href || '#'}
          onClick={handleExternalLink}
          {...props}
        >
          {children}
        </a>
      )
    },

    h1: ({ children, ...props }) => (
      <h1 className="mb-2 mt-6 text-3xl font-semibold" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="mb-2 mt-6 text-2xl font-semibold" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="mb-2 mt-6 text-xl font-semibold" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="mb-2 mt-6 text-lg font-semibold" {...props}>
        {children}
      </h4>
    ),
    h5: ({ children, ...props }) => (
      <h5 className="mb-2 mt-6 text-base font-semibold" {...props}>
        {children}
      </h5>
    ),
    h6: ({ children, ...props }) => (
      <h6 className="mb-2 mt-6 text-sm font-semibold" {...props}>
        {children}
      </h6>
    )
  }

  return pure ? (
    <ReactMarkdown remarkPlugins={plugins}>{parsedContent}</ReactMarkdown>
  ) : (
    <ReactMarkdown remarkPlugins={plugins} components={markdownComponents}>
      {parsedContent}
    </ReactMarkdown>
  )
}

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Markdown.displayName = 'Markdown'
