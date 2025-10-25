# Prompt Improvement Plan for All AI Actions

**Status**: ✅ Complete
**Start Date**: 2025-10-24
**Last Updated**: 2025-10-24
**Completion Date**: 2025-10-24

## Overview
Improved all AI action prompts in `supabase/functions/_shared/prompts.ts` based on user requirements while maintaining the existing architecture. Focus on accuracy, context-awareness, Taiwan cultural awareness, and better handling of edge cases including Whisper hallucinations.

## Current vs Proposed Mapping

| Original Action | Implementation Status | Changes Made |
|-----------------|----------------------|--------------|
| `summary` | ✅ No changes needed | Already comprehensive |
| `chat` | ✅ Complete | Removed summaryContext, added Taiwan cultural awareness for zh-TW |
| `recommend_response` | ✅ Complete | Changed to return exactly 3 concise responses (10-20 words each) |
| `keyword_search` | ✅ Complete | Removed summaryContext, added Taiwan cultural awareness for zh-TW |
| `screenshot` | ✅ Complete | Removed summaryContext, added Taiwan cultural awareness for zh-TW |
| `transcription_enhance` | ✅ Complete | Enhanced critical thinking, Taiwan cultural awareness, removed summaryContext |
| **Backend (whisper.cpp)** | ✅ Complete | **NEW: Added hallucination filtering at source** |

## Available Context Variables

### Current Implementation
```typescript
{
  existing_summary: string,           // summary.content (long_summary text)
  recent_transcriptions: string,      // last 5-10 transcripts joined by \n
  text_input: string,                 // user input or transcription
  userLanguage: string,               // 'en-US' | 'zh-TW'
  conversationHistory: string[]       // (transcription_enhance only)
}
```

### ❌ Removed (Not Implemented)
- `summaryContext` - Removed because user's chat data is NOT saved online in Supabase
- Context is already available through `existing_summary` when needed

## Key Issues Addressed

### 1. Removed `summaryContext` ✅
- **Issue**: `summaryContext` was being fetched from Supabase but doesn't exist
- **Root cause**: User's chat data is NOT saved online
- **Solution**: Removed all `summaryContext` parameters and database queries
- **Files affected**:
  - `supabase/functions/_shared/prompts.ts` (all prompt functions)
  - `supabase/functions/ai-action-chat/index.ts`
  - `supabase/functions/ai-action-recommend-response/index.ts`
  - `supabase/functions/ai-action-keyword-search/index.ts`
  - `supabase/functions/ai-action-screenshot-analysis/index.ts`

### 2. Updated `recommend_response` Output Format ✅
- **Change**: Now returns exactly 3 concise response options
- **Format**: Each response limited to 10-20 words
- **Variety**: Three different tones (direct, conversational, action-oriented)
- **Languages**: Both English and zh-TW prompts updated

### 3. Added Taiwan Cultural Awareness ✅
- **All zh-TW prompts** now include: "你是服務台灣使用者的 AI 助理，熟悉台灣的文化、用語、時事和在地知識"
- **Ensures** LLM understands Taiwanese context, terminology, and local knowledge
- **Applies to**: chat, keyword_search, screenshot, transcription_enhance, recommend_response

### 4. Whisper Hallucination Filtering ✅ (Implemented at Backend Level)
- **New Enhancement**: Added hallucination filtering at whisper.cpp backend level
- **Common artifacts now filtered**:
  - Chinese speaker labels: 姜:, 王:, 張:, 李:, 陳:, 劉:, 楊:, 黃:, 趙:, 吳: (surname + colon)
  - Content markers: 歌詞:, 字幕:, 旁白:, 音樂:, 掌聲:, 笑聲:, 背景音:, 音效:
  - English markers: "Subtitle by", "Copyright", "Untertitel", "WDR", "ZDF"
  - Timestamp patterns: [00:00], (00:00), 00:00:00
- **Architecture Decision**: Filter at source (whisper backend) rather than in LLM prompts
- **Benefit**: More efficient, deterministic, and cost-effective than LLM-based filtering
- **Implementation**: Backend preprocessing before transcription reaches enhancement service

### 5. Transcription Enhancement Problems (Previously Identified) ✅
1. **"有薪病假" → "有心病假" → "心臟病"**
   - Now addressed with critical thinking and context validation

2. **"房價" → "方家" (not corrected)**
   - Now addressed with pronunciation similarity checking

3. **"迪士尼 Let It Go" → "Lady Goode"**
   - Now addressed with semantic fit over phonetic match

**Root Cause Addressed**: Added critical thinking, context validation, and Taiwan cultural awareness

## Implementation Progress

### ✅ Phase 1: Foundation & Context Understanding
- [x] **Task 1.1**: Document Current vs Proposed Mapping
  - **Commit**: `Docs(prompts): Add current vs proposed mapping documentation`
  - **Status**: ✅ Complete
  - **Files**: `plans/20251024_prompt_improvement_for_all_ai_actions.md`

---

### ✅ Phase 2: Transcription Enhancement (Critical Priority) - COMPLETED
- [x] **Task 2.1**: Enhance transcription_enhance prompt with critical thinking (English)
  - **Goal**: Fix the 3 known issues above
  - **Approach**:
    - Add critical thinking instructions
    - Use hybrid context (keywords + topics from summary)
    - Add pronunciation similarity checking
    - Removed corrections array to save tokens
  - **Commit**: `Fix(prompts): Add critical thinking to transcription enhancement`
  - **Status**: ✅ Complete

- [x] **Task 2.2**: Add zh-TW version of enhanced transcription prompt
  - **Commit**: `Fix(prompts): Add zh-TW critical thinking for transcription enhancement`
  - **Status**: ✅ Complete

---

### ✅ Phase 3: Answer Action Enhancement (High Priority) - COMPLETED
- [x] **Task 3.1**: Merge auto-response and deep-answer into unified 'answer' prompt (English)
  - **Approach**: Single prompt with trigger detection logic
  - **Triggers**: ?, question words, command verbs, keywords (price/weather/etc.)
  - **Response Modes**:
    - Quick (no triggers): ≤200 words
    - Deep (triggers found): unlimited, structured analysis
  - **Commit**: `Feat(prompts): Unify answer action with adaptive depth`
  - **Status**: ✅ Complete

- [x] **Task 3.2**: Add zh-TW version
  - **Commit**: `Feat(prompts): Add zh-TW unified answer prompt`
  - **Status**: ✅ Complete

---

### ✅ Phase 4: Chat Enhancement - COMPLETED
- [x] **Task 4.1**: Improve chat prompt with context retrieval priority
  - **Approach**: Prioritize history_context, fall back to general knowledge
  - **Commit**: `Feat(prompts): Enhance chat with context prioritization`
  - **Status**: ✅ Complete

---

### ✅ Phase 5: Summary Enhancement - COMPLETED
- [x] **Task 5.1**: Review and refine summary prompts
  - **Note**: Current implementation already comprehensive, no changes needed
  - **Status**: ✅ Complete (No changes required)

---

### ✅ Phase 6: Screenshot Analysis Enhancement - COMPLETED
- [x] **Task 6.1**: Simplify and enhance screenshot prompt
  - **Approach**: Natural language output, better context awareness
  - **Commit**: `Feat(prompts): Enhance screenshot analysis with better context`
  - **Status**: ✅ Complete

---

### ✅ Phase 7: Keyword Search Enhancement - COMPLETED
- [x] **Task 7.1**: Refine keyword_search prompt
  - **Approach**: Better disambiguation, clearer explanations
  - **Commit**: `Refactor(prompts): Improve keyword search clarity`
  - **Status**: ✅ Complete

---

### ✅ Phase 8: Implementation Complete
- [x] **All Changes Implemented**
  - ✅ Removed summaryContext from all prompts
  - ✅ Updated recommendResponse to return 3 concise responses
  - ✅ Added Taiwan cultural awareness to all zh-TW prompts
  - ✅ Enhanced transcription with critical thinking (hallucination filtering at backend)
  - ✅ Removed summaryContext fetching from Edge Functions
  - **Status**: ✅ Complete

### ⏳ Phase 9: Testing & Validation (Recommended Next Steps)
- [ ] **Task 9.1**: Manual testing with real examples
  - Test Taiwan cultural awareness in zh-TW responses
  - Verify recommendResponse returns exactly 3 items
  - Test transcription enhancement with known issues (有薪病假, 房價, Let It Go)
  - Verify backend whisper hallucination filtering (separate from prompts)
  - **Status**: ⏳ Pending User Testing

## Test Cases

### Transcription Enhancement
```typescript
// Test Case 1: Paid sick leave
{
  rawText: "有心病假",
  expected: "有薪病假",
  context: { topics: ["employee benefits", "HR policies"], keywords: ["salary", "benefits"] }
}

// Test Case 2: Housing prices
{
  rawText: "最近方家很高",
  expected: "最近房價很高",
  context: { topics: ["real estate", "economy"], keywords: ["housing market"] }
}

// Test Case 3: Disney song
{
  rawText: "迪士尼的 Lady Goode",
  expected: "迪士尼的 Let It Go",
  context: { topics: ["Disney", "movies"], keywords: ["Frozen", "迪士尼"] }
}
```

### Answer Action
```typescript
// Test Case 1: Question trigger (deep mode)
{
  input: "What is the housing price trend in Taiwan?",
  expected_mode: "deep",
  expected_length: "> 200 words"
}

// Test Case 2: No trigger (quick mode)
{
  input: "The meeting went well",
  expected_mode: "quick",
  expected_length: "≤ 200 words"
}
```

## Breaking Changes
- ✅ None - only prompt improvements
- ✅ API contracts unchanged
- ✅ No frontend modifications needed
- ✅ Backward compatible - Edge Functions handle missing fields gracefully

## Implementation Summary

### Files Modified
1. **`supabase/functions/_shared/prompts.ts`**
   - Removed `summaryContext` from all prompt functions
   - Added Taiwan cultural awareness to all zh-TW prompts
   - Updated `recommendResponse` to return 3 concise options
   - Enhanced `transcriptionEnhancement` with critical thinking

2. **Edge Functions (summaryContext removal)**
   - `supabase/functions/ai-action-chat/index.ts`
   - `supabase/functions/ai-action-recommend-response/index.ts`
   - `supabase/functions/ai-action-keyword-search/index.ts`
   - `supabase/functions/ai-action-screenshot-analysis/index.ts`

3. **Backend (whisper.cpp)** ⭐ NEW
   - Added hallucination filtering for speaker labels (姜:, 王:, etc.)
   - Added filtering for content markers (歌詞:, 字幕:, etc.)
   - Added filtering for English artifacts and timestamps
   - Preprocessing before transcription reaches enhancement service

4. **Plan Documentation**
   - `plans/20251024_prompt_improvement_for_all_ai_actions.md` (this file)

### Success Metrics (To Be Validated)
- [ ] Taiwan cultural awareness improves zh-TW response quality
- [ ] recommendResponse consistently returns exactly 3 options
- [ ] Transcription enhancement shows improved accuracy with context validation
- [ ] No errors from missing summaryContext
- [ ] ⭐ **Backend whisper hallucination filtering removes all common artifacts** (姜:, 歌詞:, timestamps)

---

## Notes
- ❌ **summaryContext Removed**: Not implemented because user's chat data is NOT saved online in Supabase
- ✅ **Taiwan Cultural Awareness**: All zh-TW prompts now include local knowledge context
- ⭐ **Whisper Hallucination Filtering**: NEW backend-level filtering at whisper.cpp (not in LLM prompts)
- ✅ **recommendResponse Format**: Changed to return exactly 3 concise (10-20 word) responses
- ✅ **Backward Compatible**: No breaking changes to API contracts

## Key Architecture Decision
**Hallucination Filtering Strategy**: Initially considered adding filtering instructions to LLM prompts, but decided to implement at whisper.cpp backend level instead. This provides:
- ✅ Better performance (regex vs LLM processing)
- ✅ Deterministic results (no LLM interpretation)
- ✅ Lower costs (fewer tokens)
- ✅ Separation of concerns (mechanical filtering vs semantic understanding)

## Deferred for Future Consideration
- **Phase 2**: Update `existing_summary` to use structured `SummarizeResponse` interface
  - **Reason**: Current string-based approach is working fine
  - **Benefit**: Could extract specific fields (keywords, topics, participants) for more targeted prompts
  - **Effort**: Requires updating how summary data is passed from frontend to Edge Functions
  - **Status**: Not critical for current improvements, can be implemented later if needed
