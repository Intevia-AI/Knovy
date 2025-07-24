/**
 * @fileoverview Markdown Component - Renders markdown content with custom styling
 * @module Markdown
 * @description A React component that renders markdown content with customized styling,
 * code block highlighting, and copy functionality. Uses react-markdown with remark plugins.
 */

import Link from "next/link";
import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { toast } from "sonner";
import { cn } from "@workspace/ui/lib/utils";

/**
 * @interface MarkdownProps
 * @description Props for the Markdown component
 * @property {string} children - The markdown string to render
 * @property {boolean} [pure=false] - If true, uses default React Markdown styling instead of custom components
 */
interface MarkdownProps {
  children: string;
  pure?: boolean;
}

/**
 * @component CodeBlock
 * @description Renders code blocks with syntax highlighting and copy functionality
 * @param {Object} props - Component props
 * @param {boolean} props.inline - Whether the code block is inline or block
 * @param {string} [props.className] - CSS class name, may include language-* prefix
 * @param {React.ReactNode} props.children - The code content
 * @returns {JSX.Element} Rendered code block
 */
const CodeBlock: React.FC<{
  inline: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || "");

  if (!inline && match) {
    return (
      <pre
        {...props}
        className={cn(
          className,
          "bg-muted relative mt-2 w-full max-w-[80dvw] rounded-lg p-3 text-sm md:max-w-[500px]",
        )}
      >
        <button
          className="bg-background absolute right-2 top-2 rounded-md border p-1 text-xs"
          onClick={() => {
            const content = children?.toString() || "";
            navigator.clipboard.writeText(content);
            toast("複製成功");
          }}
        >
          複製
        </button>
        <div className="overflow-x-scroll">
          <code className={match[1]}>{children}</code>
        </div>
      </pre>
    );
  }

  return (
    <code
      className={cn(className, "bg-muted rounded-md px-1 py-0.5 text-sm")}
      {...props}
    >
      {children}
    </code>
  );
};

/**
 * @function createMarkdownComponents
 * @description Creates a configuration object for custom markdown component rendering
 * @returns {Partial<Components>} Object mapping markdown elements to React components
 */
const createMarkdownComponents = (): Partial<Components> => ({
  // @ts-ignore
  code: ({ node, inline = false, className, children, ...props }) => (
    <CodeBlock inline={inline} className={className} {...props}>
      {children}
    </CodeBlock>
  ),

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
    <span className="font-semibold" {...props}>
      {children}
    </span>
  ),

  a: ({ children, href, ...props }) => (
    <Link
      className="text-blue-500 hover:underline"
      target="_blank"
      rel="noreferrer"
      href={href || "#"}
      {...props}
    >
      {children}
    </Link>
  ),

  // Heading components with consistent styling pattern
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
  ),
});

/**
 * @component NonMemoizedMarkdown
 * @description Renders markdown content with customized styling
 * @param {Object} props - Component props
 * @param {string} props.children - The markdown string to render
 * @param {boolean} [props.pure=false] - If true, uses default React Markdown styling instead of custom components
 * 
 * @example
 * ```tsx
 * // Basic usage with custom styling
 * <Markdown>
 *   # Heading
 *   This is **bold** text with a [link](https://example.com).
 *   
 *   ```js
 *   const code = "example";
 *   ```
 * </Markdown>
 * 
 * // Using default styling
 * <Markdown pure>
 *   Simple markdown content
 * </Markdown>
 * ```
 */
const NonMemoizedMarkdown: React.FC<MarkdownProps> = ({
  children,
  pure = false,
}) => {
  // Replace HTML line breaks with newlines for proper markdown parsing
  const parsedContent = children
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/~/g, "-");

  // Common plugins for both pure and styled versions
  const plugins = [remarkGfm, remarkBreaks];

  return pure ? (
    <ReactMarkdown remarkPlugins={plugins}>{parsedContent}</ReactMarkdown>
  ) : (
    <ReactMarkdown
      remarkPlugins={plugins}
      components={createMarkdownComponents()}
    >
      {parsedContent}
    </ReactMarkdown>
  );
};

/**
 * @component Markdown
 * @description Memoized version of the markdown renderer that only re-renders when content changes
 * This optimization prevents unnecessary re-renders when parent components update
 */
export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

// Add displayName for better debugging
Markdown.displayName = "Markdown";
