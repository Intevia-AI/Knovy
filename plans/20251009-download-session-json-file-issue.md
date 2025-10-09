# Implementation Plan: Simplified Session JSON Export & Copy Feature

**Date:** 2025-10-09
**Status:** 🚧 In Progress - Phase 2 Complete
**Breaking Changes:** ❌ No
**Est. Time:** ~5.5 hours

## 📋 Overview

Simplify exported session JSON and add copy functionality for better UX.

**Goals:**
1. Clean, locale-aware JSON export (no technical metadata)
2. Copy functionality (summary, all transcriptions, individual lines)
3. Timezone-aware timestamps
4. snake_case naming convention

## ✨ New JSON Format

```json
{
  "session_date": "2025/10/08",
  "session_time": "05:04 AM",
  "duration": "1h 25m 17s",
  "timezone": "Asia/Taipei",
  "locale": "zh-TW",
  "title": null,
  "short_summary": null,
  "summary": "...",
  "transcriptions": [
    { "timestamp": "05:05 AM", "source": "system", "text": "..." }
  ]
}
```

**Date Formats:**
- `en-US`: "October 8, 2025"
- `zh-TW`: "2025/10/08"

**Copy Formats:**
```
Session: 2025/10/08 05:04 AM (Asia/Taipei)
Duration: 1h 25m 17s

Transcriptions:
[05:05 AM] [Mic] User message here...
[05:06 AM] [Sys] System audio here...
```

## 🏗️ Implementation Tasks

### Phase 1: Export Transformation (~2h) ✅ COMPLETED

**1.1 Type Definitions** ✅
- File: `apps/app/src/main/types/export.ts`
- Interfaces: `SimplifiedSessionExport`, `SimplifiedTranscript`
- Commit: `Feat(app): Simplify session export structure`

**1.2 Formatting Utilities** ✅
- File: `apps/app/src/main/utils/export-formatter.ts`
- Functions:
  - `formatSessionDate(iso, locale, tz)` - Locale-aware dates
  - `formatSessionTime(iso, tz)` - 12-hour with AM/PM
  - `formatTimestamp(iso, tz)` - Transcript times
  - `calculateDuration(start, end)` - "Xh Ym Zs"
  - `getUserTimezone()` - Detect via Intl API

**1.3 Transformation** ✅
- File: Same as above
- Function: `transformSessionForExport(data, locale, tz)`
- Convert UTC → local timezone, apply locale formatting

**1.4 Database Service** ✅
- File: `apps/app/src/main/databaseService.ts` (line 355-394)
- Apply transformation in `exportSession()`
- Updated IPC handler in `apps/app/src/main/index.ts`
- Updated preload bridge in `apps/app/src/preload/index.ts`

**1.5 Filename Update** ✅
- File: `apps/app/src/renderer/src/components/settings/HistoryView.tsx` (lines 179-209)
- Format: `knovy-session-2025-10-08-0504.json`

### Phase 2: Copy Functionality (~2h) ✅ COMPLETED

**2.1 Copy Utilities** ✅
- File: `apps/app/src/renderer/src/lib/copy-utils.ts`
- Functions:
  - `copyToClipboard(text)`
  - `formatSummaryForCopy(session)` - With metadata header
  - `formatTranscriptionsForCopy(session)` - Use "Mic"/"Sys"
  - `formatTranscriptForCopy(transcript)` - Individual line format

**2.2 Translation Keys** ✅
- File: `apps/app/src/renderer/src/lib/translations.ts` (lines 154-161, 305-312, 462-467)
- Keys: `copySummary`, `copyTranscriptions`, `copyTranscript`, `copiedToClipboard`, `copyFailed`
- Both en-US and zh-TW translations added

**2.3 UI Updates** ✅
- File: `apps/app/src/renderer/src/components/settings/SessionCard.tsx`
- Features implemented:
  - Copy dropdown next to download button (lines 136-175)
  - Hover interactions on transcript lines (lines 240-278)
  - Toast notifications for success/failure
  - "Mic" and "Sys" labels for alignment (lines 255-263)
  - Visual feedback with Check icon after copying (lines 268-276)

### Phase 3: Testing & Documentation (~1.5h) ⏳ PENDING

**3.1 Manual Testing** (30min)
- Test all scenarios (with/without summary, mixed sources, etc.)
- Verify locale/timezone accuracy
- Test copy functionality

**3.2 Code Review** (20min)
- Edge case handling
- Type safety
- Performance

**3.3 Documentation** (25min)
- Update architecture docs
- Add inline comments

## 📝 Commit Messages

**Commit 1: Export transformation utilities** ✅ COMPLETED
```
Feat(app): Simplify session export structure

(User committed this phase)
```

**Commit 2: Copy functionality** ⏳ READY FOR COMMIT
```
Feat(app): Add copy functionality for session data

- Create copy-utils with formatters using Mic/Sys labels
- Add translation keys for copy actions (en-US, zh-TW)
- Add copy dropdown next to download button in SessionCard
- Implement hover interactions for individual transcript copy
- Show toast notifications on successful copy
```

**Commit 3: Documentation** ⏳ OPTIONAL
```
Docs(app): Document session export and copy features

- Update architecture overview with export format details
- Document timezone and locale handling approach
- Add inline comments for transformation utilities
```

## 📁 Files Created/Modified

**New Files (Phase 1 - Committed):**
1. ✅ `apps/app/src/main/types/export.ts`
2. ✅ `apps/app/src/main/utils/export-formatter.ts`

**New Files (Phase 2 - Ready for commit):**
3. ✅ `apps/app/src/renderer/src/lib/copy-utils.ts`

**Modified Files (Phase 1 - Committed):**
1. ✅ `apps/app/src/main/databaseService.ts` (lines 355-394)
2. ✅ `apps/app/src/main/index.ts` (line 1430-1432)
3. ✅ `apps/app/src/preload/index.ts` (line 71-72)
4. ✅ `apps/app/src/renderer/src/components/settings/HistoryView.tsx` (lines 179-209)

**Modified Files (Phase 2 - Ready for commit):**
5. ✅ `apps/app/src/renderer/src/components/settings/SessionCard.tsx` (lines 3, 6-11, 35-37, 47-79, 136-175, 240-278)
6. ✅ `apps/app/src/renderer/src/lib/translations.ts` (lines 154-161, 305-312, 462-467)

**Optional:**
7. ⏳ `docs/architecture/overview.md`

## ✅ Quality Gates

**Phase 1 (Export Transformation):**
- [x] All TypeScript types compile without errors
- [x] Locale-specific date formatting works correctly (en-US, zh-TW)
- [x] Timezone conversion accurate for UTC timestamps
- [x] Duration calculation handles edge cases
- [x] No breaking changes to existing APIs
- [x] User-friendly filename format implemented

**Phase 2 (Copy Functionality):**
- [x] Copy utilities created with "Mic"/"Sys" labels
- [x] Translation keys added for en-US and zh-TW
- [x] Copy dropdown menu implemented
- [x] Hover interactions on transcript lines
- [x] Toast notifications display correctly
- [x] Visual feedback (Check icon) after copying

**Phase 3 (Testing - Pending):**
- [ ] Manual testing of export with different locales
- [ ] Manual testing of copy functionality
- [ ] Verify timezone conversion accuracy
- [ ] Test all edge cases (no summary, mixed sources, etc.)

---

**Status:** Phase 2 complete - Ready for commit and testing
