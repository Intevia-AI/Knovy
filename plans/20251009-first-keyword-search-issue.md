# Plan: Improve First Keyword Search User Experience

**Date:** 2025-10-09
**Status:** In Progress
**Priority:** High
**Type:** Bug Fix + UX Improvement

---

## Problem Statement

### Current Behavior
When users click a keyword in the ChatPanel during early stages of app usage (when there are few transcriptions and no summary has been generated), the LLM responds by asking the user to provide more context instead of providing useful information about the keyword.

### Expected Behavior
The keyword search should always provide helpful information about the clicked term, regardless of the available conversation context. When context is limited, the system should gracefully fall back to providing a general, informative response about the keyword.

### User Impact
- **Frustrating UX**: Users clicking keywords expect to learn about them, not be told they need to provide context first
- **Breaks User Mental Model**: Keywords are presented as clickable/searchable, implying they work independently
- **Poor First Impression**: This issue is most prominent during initial app usage when users are still learning the system

---

## Root Cause Analysis

### Investigation Results

After reviewing the implementation, I've identified the issue:

**Current Prompt Design** (`supabase/functions/_shared/prompts.ts`, lines 96-133):

```typescript
keywordSearch: {
  en: {
    base: ({...}) => {
      let prompt = `Your goal is to provide a precise and relevant summary for the term: "${text_input}".
      Use the provided conversation context to understand the user's intent.

      If the context is relevant, tailor the summary to it.
      If not, provide a general, informative summary. [...]`
    }
  }
}
```

**The Prompt Design is Actually Good** ✅

The prompt already instructs the LLM to:
1. Use context when available and relevant
2. Provide a general summary when context is not relevant
3. Use knowledge and web search capabilities

**The Real Issue: Empty Context Handling** ❌

When there's **no context at all** (no summary, no recent transcriptions), the LLM receives:
- No existing_summary section
- No recent_transcriptions section
- Only the instruction to "use context"

This creates ambiguity: The LLM interprets the lack of context as "insufficient information" rather than "provide general information."

### Context Gathering Logic

In `useAIInteraction.ts` (lines 283-295):

```typescript
case 'keyword_search': {
  functionName = 'ai-action-keyword-search'
  const sessionId = await (window as any).electronAPI.invoke('session:get-id')
  const existingSummary = await (window as any).electronAPI.invoke('db:get-summary', sessionId)
  const context = await gatherContext()  // Returns last 10 transcriptions

  functionPayload.text_input = query
  functionPayload.existing_summary = existingSummary?.content
  functionPayload.recent_transcriptions = context?.text
  break
}
```

When both `existingSummary` and `context.text` are empty/undefined:
- The prompt doesn't explicitly tell the LLM "there is no context, provide general information"
- The LLM may interpret this as needing more context from the user

---

## Proposed Solution

### Approach: Two-Tier Strategy

**Tier 1: Improve Prompt Clarity** (Primary Fix)
- Explicitly handle the "no context" scenario in the prompt
- Add clear instruction for when context is minimal or absent
- Emphasize the LLM should always provide useful information

**Tier 2: Enhance Context Detection** (Supporting Improvement)
- Add logic to detect when context is insufficient
- Adjust prompt dynamically based on context availability
- Provide better signals to the LLM about context quality

### Design Principles

1. **Graceful Degradation**: Always provide value, regardless of context availability
2. **Clear Instructions**: Leave no ambiguity about expected behavior
3. **User-Centric**: Prioritize user learning and exploration over context dependency
4. **Backward Compatible**: Maintain existing behavior when sufficient context exists
5. **Progressive Enhancement**: Align with Knovy's existing architecture pattern

---

## Implementation Plan

### Phase 1: Prompt Improvement (Backend)

#### Task 1.1: Update English Keyword Search Prompt
**File:** `supabase/functions/_shared/prompts.ts`
**Lines:** 96-140
**Status:** ✅ Completed

**Changes:**
```typescript
keywordSearch: {
  en: {
    base: ({...}) => {
      let prompt = `Your goal is to provide a precise, informative, and helpful summary for the term: "${text_input}".`

      // Explicitly handle the no-context scenario
      const hasContext = !!(existing_summary || recent_transcriptions)

      if (hasContext) {
        prompt += `\n\nUse the provided conversation context below to tailor your response to the user's specific situation and interests.`
      } else {
        prompt += `\n\nNo conversation context is available yet. Provide a general, informative explanation of this term based on your knowledge. Focus on practical, useful information that helps users understand the concept.`
      }

      prompt += `\n\nGuidelines:
- Provide clear, accurate information about "${text_input}"
- Use simple language that's easy to understand
- Include relevant examples or use cases when helpful
- Keep the response concise but comprehensive (2-4 sentences)
- If this is a technical term, explain it in accessible terms`

      if (existing_summary) {
        prompt += `\n\nConversation Summary:\n---\n${existing_summary}\n---`
      }

      if (recent_transcriptions) {
        prompt += `\n\nRecent Transcriptions:\n---\n${recent_transcriptions}\n---`
      }

      if (hasContext) {
        prompt += `\n\nBased on the conversation context and your knowledge, provide a tailored summary for "${text_input}".`
      } else {
        prompt += `\n\nProvide a helpful general summary for "${text_input}".`
      }

      return prompt
    }
  }
}
```

**Commit Message:**
```
Fix(app): Improve keyword search prompt to handle limited context gracefully

- Add explicit handling for scenarios with no conversation context
- Provide clear instructions to LLM for both context-rich and context-poor situations
- Ensure users always receive informative responses when clicking keywords
- Maintain backward compatibility with existing context-aware behavior
```

**Testing:**
- Test with no context (empty session)
- Test with minimal context (1-2 transcriptions, no summary)
- Test with rich context (multiple transcriptions + summary)
- Verify response quality in all scenarios

---

#### Task 1.2: Update Traditional Chinese Keyword Search Prompt
**File:** `supabase/functions/_shared/prompts.ts`
**Lines:** 142-186
**Status:** ✅ Completed

**Changes:**
Apply the same pattern to the Traditional Chinese prompt with culturally appropriate phrasing.

**Commit Message:**
```
Fix(app): Apply keyword search prompt improvements to Traditional Chinese

- Mirror English prompt improvements for Traditional Chinese users
- Ensure consistent UX across both supported languages
- Maintain cultural and linguistic appropriateness
```

**Testing:**
- Test all scenarios with language set to zh-TW
- Verify prompt produces natural Traditional Chinese responses

---

## Success Criteria

### User Experience Metrics
- ✅ Users clicking keywords always receive helpful information
- ✅ No "please provide more context" responses for keyword searches
- ✅ First-time users have positive keyword search experience
- ✅ Response quality maintained for context-rich scenarios

### Technical Metrics
- ✅ No breaking changes to existing functionality
- ✅ Backward compatible with current behavior
- ✅ Both English and Traditional Chinese work correctly
- ✅ Response time remains acceptable (<5 seconds)

### Quality Metrics
- ✅ Responses are accurate and informative
- ✅ Language is clear and accessible
- ✅ Context is used when available and relevant
- ✅ General information provided when context unavailable

---

## Risk Assessment

### Low Risk ✅
- **Prompt-only changes**: No code logic changes in Phase 1
- **Backward compatible**: Existing behavior preserved when context exists
- **Localized impact**: Only affects keyword search, not other AI actions
- **Easy rollback**: Can revert prompt changes instantly if needed

### Potential Issues
1. **LLM Behavior Variability**
   - Risk: AI might still occasionally ask for context
   - Mitigation: Explicit, clear instructions; test thoroughly

2. **Response Length**
   - Risk: General responses might be too verbose or too brief
   - Mitigation: Include length guidance in prompt; iterate based on testing

3. **Accuracy Without Context**
   - Risk: Generic responses might not match user's specific need
   - Mitigation: This is acceptable trade-off; better than refusing to help

---

## Timeline

| Task | Estimated Time | Status |
|------|---------------|--------|
| 1.1: Update English prompt | 15 min | ✅ Completed |
| 1.2: Update Chinese prompt | 15 min | ✅ Completed |
| **Total** | **~30 min** | **✅ Done** |

---

## Next Steps

1. ✅ Plan approved by user - removing Phase 2 and Phase 3
2. Proceed with Task 1.1 (English prompt update)
3. Proceed with Task 1.2 (Traditional Chinese prompt update)
4. User will manually test the changes

---

## Notes

- This issue highlights the importance of **graceful degradation** in AI systems
- Similar pattern could apply to other AI actions (chat, screenshot analysis)
- Consider documenting prompt engineering best practices for team
- The current prompt structure is well-designed; just needs explicit no-context handling

---

**Last Updated:** 2025-10-09
**Status:** ✅ Implementation Complete - Ready for Testing
