/**
 * Shared parsing for structured session summaries.
 * Summaries are persisted as a JSON string of StructuredSummary; older sessions
 * may still hold free-form markdown, in which case parsing returns null.
 */

export interface StructuredSummary {
  short_summary: string
  key_points: string[]
  decisions: string[]
  action_items: string[]
  open_questions: string[]
  topics: string[]
}

export function parseStructuredSummary(content: string): StructuredSummary | null {
  // Older sessions persisted the model's fenced ```json output verbatim.
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(stripped)
    if (typeof parsed?.short_summary !== 'string') return null
    return parsed as StructuredSummary
  } catch {
    return null
  }
}
