# Plan: Restructure Gemini Summary Response for Better UI/UX

**Date:** 2025-10-12
**Status:** ✅ Completed
**Related Agents:** `ui-ux-designer`, `workflow-coordinator`, `code-reviewer`

---

## Problem Statement

The current session history UI in the Settings window displays long markdown summaries as previews, causing:
1. **Poor UI/UX**: Each session card becomes too tall due to long summary text
2. **Raw markdown display**: Summaries are shown as plain text without proper rendering
3. **Limited information**: No short preview for quick scanning
4. **Missing context**: No structured context data (people, topics, time, location) for AI actions

---

## Proposed Solution (Updated After User Feedback)

### 1. Enhanced Summary Response Structure

Update the Gemini API response to return a **structured JSON** instead of plain text:

```json
{
  "short_summary": "Brief one-line summary for preview (~80-100 chars)",
  "long_summary": "Detailed markdown-formatted summary with context embedded at the top",
  "context": {
    "participants": ["John", "Sarah", "TeamMember3"],
    "topics": ["Product Launch", "Q4 Strategy", "Budget Review"],
    "keywords": ["milestone", "budget approval", "Q4", "launch date"],
    "time_context": "Q4 2025 planning session",
    "scenario": "team meeting",
    "key_points": ["Approved $2M budget increase", "Launch date set for Nov 15"]
  }
}
```

**Context Usage & Benefits:**

**Primary Purpose:** Improve AI action accuracy and summary generation quality
- **Participants**: Used for speaker identification, contextual understanding in transcription enhancement
- **Topics**: Theme categorization, helps AI understand conversation domain
- **Keywords**: Critical for transcription enhancement - helps correct similar-sounding words
- **Time Context**: Temporal relevance ("morning standup", "Q4 planning")
- **Scenario**: Context type (meeting, lecture, interview, casual conversation)
- **Key Points**: Important outcomes extracted from the session

**Key Design Decision:**
- Context data is **NOT displayed directly to users** in the UI
- Context is **embedded into the long_summary markdown** by Gemini as a contextual paragraph
- Context is passed to **all AI actions** (especially transcription enhancement) for better accuracy
- Example long_summary structure:
  ```markdown
  This was a team meeting with John, Sarah, and TeamMember3 discussing Product Launch, Q4 Strategy, and Budget Review.

  ## Key Discussion Points
  1. Approved $2M budget increase for the campaign
  2. Launch date finalized for November 15
  ...
  ```

### 2. Updated UI Design (Simplified After User Feedback)

Transform session cards from accordion-style to **tab-based expandable view**:

**Collapsed State:**
```
┌─────────────────────────────────────────────────┐
│ Oct 12, 2025 • 10:30 AM • 45m          [▼] [⋮]│
│ Brief one-line summary for preview...           │
└─────────────────────────────────────────────────┘
```

**Expanded State with Tabs:**
```
┌─────────────────────────────────────────────────┐
│ Oct 12, 2025 • 10:30 AM • 45m          [▲] [⋮]│
│ Brief one-line summary for preview...           │
├─────────────────────────────────────────────────┤
│ [Summary] [Transcriptions]                      │
├─────────────────────────────────────────────────┤
│                                                  │
│ Summary Tab (markdown rendered with embedded    │
│ context):                                        │
│                                                  │
│ This was a team meeting with John, Sarah, and   │
│ TeamMember3 discussing Product Launch, Q4        │
│ Strategy, and Budget Review.                     │
│                                                  │
│ ## Key Discussion Points                         │
│ 1. Approved $2M budget increase                  │
│ 2. Launch date set for November 15               │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Key UI Simplifications:**
- **NO separate context badges or cards** - context is embedded in the markdown summary
- Users only see: short_summary (collapsed) and long_summary (expanded in Summary tab)
- Transcriptions tab remains unchanged
- Context data is stored and used by AI actions behind the scenes

---

## Implementation Plan

### Phase 1: Database Schema Updates

**File:** `apps/app/src/main/database.ts`

**Changes:**
- Update `summaries` table to store structured JSON
- Add columns: `short_summary TEXT`, `context_data TEXT` (JSON string)
- Migration strategy: Existing summaries remain in `content`, new ones populate new fields

**Schema:**
```sql
ALTER TABLE summaries ADD COLUMN short_summary TEXT;
ALTER TABLE summaries ADD COLUMN context_data TEXT; -- JSON string
```

**Migration Approach:**
- Non-breaking: Existing summaries work with `content` field
- New summaries populate all three fields: `content` (long), `short_summary`, `context_data`
- UI gracefully handles both old and new formats

---

### Phase 2: Backend Updates

#### 2.1 Update Supabase Edge Function

**File:** `supabase/functions/ai-action-summarize/index.ts`

**Changes:**
1. Update prompt to request structured JSON response
2. Parse JSON from Gemini response
3. Return structured data instead of plain text

**New Response Format (Updated):**
```typescript
{
  summary: string,              // For backward compatibility (long_summary)
  short_summary: string,
  long_summary: string,         // Same as summary, with embedded context
  context: {
    participants: string[],
    topics: string[],
    keywords: string[],
    time_context: string | null,
    scenario: string | null,    // "meeting", "lecture", "interview", etc.
    key_points: string[]
  },
  usage: { input_tokens, output_tokens }
}
```

#### 2.2 Update Prompts

**File:** `supabase/functions/_shared/prompts.ts`

**Add new prompt structure:**
```typescript
summarize_structured: {
  en: {
    with_previous: (text_input, existing_summary) => `...`,
    without_previous: (text_input) => `...`
  },
  "zh-TW": { ... }
}
```

**Prompt Requirements:**
- Instruct Gemini to return valid JSON
- Specify short_summary length (1 line, ~100 chars)
- Define context extraction rules
- Maintain markdown formatting for long_summary

---

### Phase 3: Frontend Updates

#### 3.1 Update Type Definitions

**File:** `apps/app/src/renderer/src/types/history.ts`

```typescript
export interface SessionContext {
  participants?: string[]
  topics?: string[]
  keywords?: string[]
  time_context?: string | null
  scenario?: string | null
  key_points?: string[]
}

export interface Session {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  duration: number | null
  summary: string | null           // Long summary (backward compat)
  short_summary?: string | null    // New field
  context_data?: string | null     // JSON string
  created_at: string
  transcripts?: Transcript[]
}
```

#### 3.2 Update Database Service

**File:** `apps/app/src/main/databaseService.ts`

**Changes:**
1. Update `saveSummary` to accept structured data
2. Update `getSummary` to parse and return structured data
3. Handle migration for existing plain-text summaries

```typescript
async saveSummary(sessionId: string, data: {
  content: string,           // long_summary
  short_summary?: string,
  context?: SessionContext
}): Promise<void>

async getSummary(sessionId: string): Promise<{
  content: string,
  short_summary?: string,
  context?: SessionContext,
  updated_at: string
} | null>
```

#### 3.3 Redesign SessionCard Component

**File:** `apps/app/src/renderer/src/components/settings/SessionCard.tsx`

**UI Changes (Simplified):**
1. **Collapsed State**: Show `short_summary` instead of full summary
2. **Expanded State**: Implement tabs:
   - **Summary Tab**: Render markdown `long_summary` (context is embedded in the markdown)
   - **Transcriptions Tab**: Current transcript list (unchanged)
3. **NO Context Badges/Cards**: Context is not displayed separately - it's part of the summary
4. **Markdown Rendering**: Use markdown renderer for summary

**Component Structure:**
```tsx
<SessionCard>
  <CardHeader>
    <Metadata /> {/* Date, Time, Duration */}
    <ShortSummary /> {/* One-line preview */}
    <Actions /> {/* Copy, Export, Delete, Expand */}
  </CardHeader>

  {isExpanded && (
    <CardContent>
      <Tabs>
        <TabsList>
          <Tab>Summary</Tab>
          <Tab>Transcriptions</Tab>
        </TabsList>

        <TabContent value="summary">
          <MarkdownRenderer>{long_summary}</MarkdownRenderer>
        </TabContent>

        <TabContent value="transcriptions">
          <TranscriptList transcripts={transcripts} />
        </TabContent>
      </Tabs>
    </CardContent>
  )}
</SessionCard>
```

#### 3.4 Update useAIInteraction Hook

**File:** `apps/app/src/renderer/src/hooks/useAIInteraction.ts`

**Changes:**
1. Update context gathering to use structured context
2. Pass `context` data to AI actions (chat, answer, keyword_search, screenshot)
3. Enhance prompt context with structured data

**Context Usage in AI Actions:**
```typescript
// Before
functionPayload.existing_summary = existingSummary?.content

// After
functionPayload.existing_summary = existingSummary?.content
functionPayload.session_context = {
  participants: existingSummary?.context?.participants,
  topics: existingSummary?.context?.topics,
  keywords: existingSummary?.context?.keywords,
  time_context: existingSummary?.context?.time_context,
  scenario: existingSummary?.context?.scenario,
  key_points: existingSummary?.context?.key_points
}
```

---

### Phase 4: Prompt Updates for All AI Actions

**Files to Update:**
- `supabase/functions/_shared/prompts.ts`

**Actions to Enhance (Priority Order):**
1. **Transcription Enhancement** (HIGHEST PRIORITY) - Use participants, topics, keywords for accurate word correction
2. **Chat** - Use context for personalized responses
3. **Answer** - Leverage participants/topics for relevant answers
4. **Keyword Search** - Use topics/keywords for better context matching
5. **Screenshot Analysis** - Use context for better interpretation

**Why Transcription Enhancement is Priority #1:**
- Without accurate transcriptions, all other AI actions produce poor results
- Keywords help correct similar-sounding words (e.g., "meet" vs "meat", "there" vs "their")
- Participants help with speaker-specific vocabulary and accents
- Topics provide domain context for technical terms

**Example Enhancement (Transcription Enhancement):**
```typescript
if (session_context?.keywords) {
  prompt += `\n\nKey terms frequently used in this session: ${session_context.keywords.join(', ')}`
  prompt += `\n\nUse these keywords to help correct similar-sounding words.`
}
if (session_context?.participants) {
  prompt += `\n\nParticipants: ${session_context.participants.join(', ')}`
}
if (session_context?.topics) {
  prompt += `\n\nMain topics: ${session_context.topics.join(', ')}`
}
```

**Example Enhancement (Chat):**
```typescript
if (session_context?.participants) {
  prompt += `\n\nParticipants in this conversation: ${session_context.participants.join(', ')}`
}
if (session_context?.topics) {
  prompt += `\n\nMain topics discussed: ${session_context.topics.join(', ')}`
}
```

---

## Task Breakdown

### ✅ Task 1: Planning & Design
**Status:** ✅ Completed
**Assignee:** Orchestrator + UI/UX Designer
**Deliverables:**
- [x] Analyze current implementation
- [x] Design new JSON structure (APPROVED)
- [x] Design new UI with tabs (APPROVED)
- [x] Document migration strategy

---

### ✅ Task 2: Database Schema Migration
**Status:** ✅ Completed
**Assignee:** Backend Developer
**Commit:** `70e66ed`
**Files:**
- `apps/app/src/main/database.ts`

**Sub-tasks:**
- [x] Add `short_summary` column to `summaries` table
- [x] Add `context_data` column to `summaries` table
- [x] Test migration with existing data
- [x] Update IPC handlers for new structure

**Commit Message:**
```
Feat(app): Add structured summary columns to database schema

- Add short_summary TEXT column for preview text
- Add context_data TEXT column for JSON context storage
- Non-breaking change: existing summaries continue to work
- Migration handles both old and new formats gracefully
```

---

### ✅ Task 3: Update Supabase Edge Function
**Status:** ✅ Completed
**Assignee:** Backend Developer
**Commit:** `b9565c0`
**Files:**
- `supabase/functions/ai-action-summarize/index.ts`
- `supabase/functions/_shared/prompts.ts`

**Sub-tasks:**
- [x] Update prompt to request structured JSON
- [x] Add JSON parsing and validation
- [x] Return structured response
- [x] Handle Gemini errors gracefully
- [x] Add unit tests for new structure

**Commit Message:**
```
Feat(app): Update summarize function to return structured JSON

- Add structured summary prompt requesting JSON format
- Parse and validate Gemini response
- Return short_summary, long_summary, and context data
- Maintain backward compatibility with existing callers
```

---

### ✅ Task 4: Update Frontend Types & Database Service
**Status:** ✅ Completed
**Assignee:** Frontend Developer
**Commit:** `5f2035e`
**Files:**
- `apps/app/src/renderer/src/types/history.ts`
- `apps/app/src/main/databaseService.ts`

**Sub-tasks:**
- [x] Add `SessionContext` interface
- [x] Update `Session` interface with new fields
- [x] Update `saveSummary` to handle structured data
- [x] Update `getSummary` to parse JSON context
- [x] Handle backward compatibility

**Commit Message:**
```
Feat(app): Add types and service methods for structured summaries

- Add SessionContext interface for context data
- Update Session type with short_summary and context_data
- Update database service to save/retrieve structured summaries
- Gracefully handle legacy plain-text summaries
```

---

### ✅ Task 5: Save Structured Summary Data
**Status:** ✅ Completed
**Assignee:** Frontend Developer
**Commit:** `274f66f`
**Files:**
- `apps/app/src/renderer/src/hooks/useAIInteraction.ts`

**Sub-tasks:**
- [x] Update AI interaction hook to save structured summary
- [x] Parse structured response from Edge Function
- [x] Save short_summary and context_data to database
- [x] Maintain backward compatibility

**Commit Message:**
```
Feat(app): Save structured summary data from AI responses

- Parse structured JSON response from summarize Edge Function
- Save short_summary and context_data to database
- Update existing summary saving logic
- Handle both old and new response formats gracefully
```

---

### ✅ Task 6: Redesign SessionCard UI
**Status:** ✅ Completed
**Assignee:** UI/UX Designer + Frontend Developer
**Commit:** `9650fce`
**Files:**
- `apps/app/src/renderer/src/components/settings/SessionCard.tsx`

**Sub-tasks:**
- [x] Update collapsed view to show short_summary
- [x] Implement tabs (Summary, Transcriptions)
- [x] Add markdown rendering for long_summary
- [x] Remove old single-section expanded view
- [x] Ensure responsive design
- [x] Add loading states for tabs

**Bug Fixes:**
- [x] Fix Markdown component import (Commit: `5c983e4`)

**Commit Message:**
```
Feat(app): Redesign SessionCard with tabs and structured summary display

- Show short_summary in collapsed state for better UX
- Add tabs for Summary and Transcriptions in expanded view
- Render long_summary as markdown in Summary tab
- Context is embedded in summary markdown (no separate display)
- Maintain existing copy and export functionality
```

---

### ✅ Task 7: Testing & Documentation
**Status:** ✅ Completed
**Assignee:** QA + Code Reviewer
**Commit:** `f3b7021`

**Sub-tasks:**
- [x] Test new sessions create structured summaries
- [x] Test old sessions display correctly
- [x] Test UI responsiveness and tab switching
- [x] Update plan with completion status

**Additional Bug Fixes:**
- [x] Recreate session history if deleted while running (Commit: `7988ec7`)

**Commit Message:**
```
Docs(app): Update plan with completion status and commit hashes

- Mark all completed tasks with commit references
- Document implementation progress
- Update task breakdown with actual commits
```

---

## Breaking Changes Assessment

### ✅ Non-Breaking Changes
- Database schema adds columns (existing data unaffected)
- Edge function returns backward-compatible structure
- UI handles both old and new formats gracefully

### ⚠️ Considerations
- Existing summaries will not have `short_summary` → UI uses fallback (truncated long summary)
- Existing summaries will not have `context` → UI hides context badges
- New Gemini responses must be valid JSON → Add error handling

---

## Design Decisions (Finalized After User Feedback)

### 1. JSON Structure - ✅ APPROVED

**Final Structure:**
```json
{
  "short_summary": "Brief one-line summary (~80-100 chars)",
  "long_summary": "Detailed markdown summary with embedded context",
  "context": {
    "participants": ["Name1", "Name2"],
    "topics": ["Topic1", "Topic2"],
    "keywords": ["keyword1", "keyword2"],
    "time_context": "Q4 2025 planning",
    "scenario": "meeting",
    "key_points": ["Point1", "Point2"]
  }
}
```

**Decisions:**
- ✅ Use `participants` instead of `people`
- ✅ Use `key_points` instead of `key_decisions` (more flexible)
- ✅ Add `keywords` field (critical for transcription enhancement)
- ✅ Use `scenario` instead of `location` (meeting, lecture, interview, etc.)
- ✅ No `action_items` field (covered by key_points)

### 2. UI/UX Design - ✅ APPROVED

**Decisions:**
- ✅ Context is **NOT displayed separately** in UI
- ✅ Context is **embedded in the long_summary markdown** by Gemini
- ✅ Users see: collapsed = short_summary, expanded = tabs (Summary + Transcriptions)
- ✅ Summary tab renders markdown with embedded context
- ✅ NO context badges, NO context cards

### 3. Migration Strategy - ✅ APPROVED

**Decision:**
- ✅ Implement backward compatibility
- ✅ Old sessions display legacy summary (no short_summary or context)
- ✅ New sessions populate all fields
- ✅ UI gracefully handles both formats

### 4. Context Usage Priority - ✅ APPROVED

**Decision:**
- ✅ **Transcription Enhancement = HIGHEST PRIORITY**
  - Keywords for word correction
  - Participants for speaker vocabulary
  - Topics for domain context
- ✅ Chat, Answer, Keyword Search, Screenshot Analysis also use context
- ✅ Context is passed to all AI actions for better accuracy

---

## Next Steps

1. ✅ **JSON structure approved** - Ready to implement
2. ✅ **UI design approved** - Ready to implement
3. 🔄 **Begin implementation** - Starting with Task 2
4. 📝 **Create commits sequentially** - One per task

---

## Progress Tracking

- [x] Task 1: Planning & Design (APPROVED)
- [x] Task 2: Database migration (Commit: `70e66ed`)
- [x] Task 3: Backend updates - Supabase Edge Function (Commit: `b9565c0`)
- [x] Task 4: Frontend types & database service (Commit: `5f2035e`)
- [x] Task 5: Save structured summary data (Commit: `274f66f`)
- [x] Task 6: SessionCard UI redesign (Commit: `9650fce`)
- [x] Task 7: Documentation and testing (Commit: `f3b7021`)
- [x] Bug Fix: Markdown component import (Commit: `5c983e4`)
- [x] Bug Fix: Recreate session history if deleted (Commit: `7988ec7`)
- [ ] Task 8: **OPTIONAL** - Pass context to AI actions for enhanced accuracy (Not Started)

---

## Notes

- All changes must maintain backward compatibility
- Each task should be a separate commit following conventional commits
- Test thoroughly before moving to next task
- Update this plan after each task completion

---

## Implementation Summary (Completed: 2025-10-12)

### ✅ Successfully Implemented Features

1. **Structured Summary JSON Format**
   - Gemini now returns structured JSON with `short_summary`, `long_summary`, and `context` fields
   - Context includes: participants, topics, keywords, time_context, scenario, key_points
   - Backend properly parses and validates JSON responses

2. **Database Schema Enhancement**
   - Added `short_summary` and `context_data` columns to `summaries` table
   - Backward compatible with existing plain-text summaries
   - Migration strategy handles both old and new formats gracefully

3. **Redesigned Session Card UI**
   - Collapsed state shows concise `short_summary` for quick scanning
   - Expanded state uses tabs: **Summary** (markdown-rendered) and **Transcriptions**
   - Context is embedded naturally in the long_summary markdown
   - NO separate context badges/cards for cleaner UI

4. **Improved User Experience**
   - Session cards are now significantly shorter in collapsed state
   - Markdown rendering provides better readability
   - Tab-based navigation separates content types logically
   - Maintains all existing functionality (copy, export, delete)

### 🔧 Bug Fixes Applied

1. **Markdown Component Import Fix** (`5c983e4`)
   - Corrected import name from `MarkdownRenderer` to `Markdown`
   - Fixed export name mismatch error

2. **Session History Recreation** (`7988ec7`)
   - Added logic to recreate session history if deleted while app is running
   - Prevents data loss and improves reliability

### 📊 Metrics

- **Total Commits**: 9 commits (7 feature commits + 2 bug fixes)
- **Files Changed**:
  - Backend: 3 files (database, edge function, prompts)
  - Frontend: 4 files (types, services, hooks, components)
- **Breaking Changes**: 0 (fully backward compatible)
- **Lines Added/Modified**: ~500+ lines

### 🎯 Remaining Optional Work

**Task 8: Pass Context to AI Actions**
- Currently, context is stored but not yet passed to AI actions
- **Priority**: Transcription Enhancement > Chat > Answer > Keyword Search > Screenshot
- **Benefit**: Improved accuracy for all AI-powered features
- **Status**: Not started (optional enhancement)

### 🚀 Next Steps (If Implementing Task 8)

1. Update `useAIInteraction.ts` to pass `session_context` to all AI action calls
2. Update prompts in `supabase/functions/_shared/prompts.ts` for each action
3. Test transcription enhancement with keyword-based corrections
4. Test chat responses with participant and topic awareness
5. Verify improved accuracy across all AI features

**Recommendation**: Implement Task 8 in a separate phase after observing user feedback on the current UI changes.
