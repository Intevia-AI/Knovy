# Implementation Plan: Simplified Session JSON Export & Copy Feature

**Date:** 2025-10-09
**Status:** ✅ Approved - Ready for Implementation
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

### Phase 1: Export Transformation (~2h)

**1.1 Type Definitions** (15min)
- File: `apps/app/src/main/types/export.ts`
- Interfaces: `SimplifiedSessionExport`, `SimplifiedTranscript`

**1.2 Formatting Utilities** (45min)
- File: `apps/app/src/main/utils/export-formatter.ts`
- Functions:
  - `formatSessionDate(iso, locale, tz)` - Locale-aware dates
  - `formatSessionTime(iso, tz)` - 12-hour with AM/PM
  - `formatTimestamp(iso, tz)` - Transcript times
  - `calculateDuration(start, end)` - "Xh Ym Zs"
  - `getUserTimezone()` - Detect via Intl API

**1.3 Transformation** (45min)
- File: Same as above
- Function: `transformSessionForExport(data, locale, tz)`
- Convert UTC → local timezone, apply locale formatting

**1.4 Database Service** (15min)
- File: `apps/app/src/main/databaseService.ts` (line 355-383)
- Apply transformation in `exportSession()`

**1.5 Filename Update** (10min)
- File: `apps/app/src/renderer/src/components/settings/HistoryView.tsx`
- Format: `knovy-session-2025-10-08-0504.json`

### Phase 2: Copy Functionality (~2h)

**2.1 Copy Utilities** (20min)
- File: `apps/app/src/renderer/src/lib/copy-utils.ts`
- Functions:
  - `copyToClipboard(text)`
  - `formatSummaryForCopy(session)` - With metadata header
  - `formatTranscriptionsForCopy(transcripts)` - Use "Mic"/"Sys"

**2.2 Translation Keys** (10min)
- File: `apps/app/src/renderer/src/lib/translations.ts`
- Keys: `copySummary`, `copyTranscriptions`, `copyTranscript`, `copiedToClipboard`, `copyFailed`

**2.3 UI Updates** (1.5h)
- File: `apps/app/src/renderer/src/components/settings/SessionCard.tsx`
- Features:
  - Copy dropdown next to download button
  - Hover interactions on transcript lines
  - Toast notifications
  - Use "Mic" and "Sys" labels for alignment

### Phase 3: Testing & Documentation (~1.5h)

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

**Commit 1: Export transformation utilities**
```
Feat(app): Add locale and timezone-aware export transformation

- Create SimplifiedSessionExport type with snake_case fields
- Implement formatters for locale-specific dates (en-US, zh-TW)
- Add timezone detection and UTC conversion utilities
- Create transformSessionForExport with locale/tz support
- Update exportSession in databaseService to use transformation
- Improve filename format to knovy-session-{date}-{time}.json
```

**Commit 2: Copy functionality**
```
Feat(app): Add copy functionality for session data

- Create copy-utils with formatters using Mic/Sys labels
- Add translation keys for copy actions (en-US, zh-TW)
- Add copy dropdown next to download button in SessionCard
- Implement hover interactions for individual transcript copy
- Show toast notifications on successful copy
```

**Commit 3: Documentation**
```
Docs(app): Document session export and copy features

- Update architecture overview with export format details
- Document timezone and locale handling approach
- Add inline comments for transformation utilities
```

## 📁 Files Created/Modified

**New:**
1. `apps/app/src/main/types/export.ts`
2. `apps/app/src/main/utils/export-formatter.ts`
3. `apps/app/src/renderer/src/lib/copy-utils.ts`

**Modified:**
1. `apps/app/src/main/databaseService.ts`
2. `apps/app/src/renderer/src/components/settings/HistoryView.tsx`
3. `apps/app/src/renderer/src/components/settings/SessionCard.tsx`
4. `apps/app/src/renderer/src/lib/translations.ts`
5. `docs/architecture/overview.md` (optional)

## ✅ Quality Gates

- [ ] All TypeScript types compile without errors
- [ ] Locale-specific date formatting works correctly
- [ ] Timezone conversion accurate for UTC timestamps
- [ ] Duration calculation handles edge cases
- [ ] Copy functionality works with "Mic"/"Sys" labels
- [ ] Toast notifications display correctly
- [ ] No breaking changes to existing APIs
- [ ] All manual tests pass

---

**Status:** Ready for implementation
