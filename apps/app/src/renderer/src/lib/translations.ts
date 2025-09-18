/**
 * @fileoverview Application translation strings for internationalization
 * @module translations
 * @description Provides translation strings for all UI elements in multiple languages
 */

/**
 * Translation dictionary containing all application strings in multiple languages
 * Organized by language code and then by string key
 *
 * @type {Record<string, Record<string, string>>}
 */
export const translations = {
  'en-US': {
    // Add English translations here
    greeting: 'Hello',
    // ControlPanel Status
    PreviewPanelTitle: 'Screen Preview',
    systemAudioLabel: 'System Audio',
    statusLoading: 'AI Processing',
    statusSharing: 'Sharing/Recording',
    statusStopped: 'Stopped',
    statusLoadingShort: 'Processing...',
    statusSharingShort: 'Sharing',
    statusStoppedShort: 'Stopped',
    stopSharingButton: 'Stop',
    startSharingButton: 'Share',
    // ControlPanel Keywords
    keywordsTitle: 'Keywords',
    explainKeywordTooltipPrefix: 'Explain',
    // ControlPanel AI Actions
    aiActionsTitle: 'AI Actions',
    aiActionAnswer: 'Deep Answer',
    aiActionSummary: 'Generate Summary',
    shortcutKeyTooltip: 'Shortcut:',
    aiActionScreenshot: 'Screenshot & Ask',
    aiActionUpload: 'Upload File',
    // ControlPanel Advanced Settings
    advancedSettingsTitle: 'Advanced Settings',
    customPromptLabel: 'Custom Model Instruction',
    customPromptPlaceholder: 'Enter custom prompt and press Enter...',
    currentPromptLabel: 'Current Model Instruction',
    clearButton: 'Clear',
    languageSelectLabel: 'Language Selection',
    languageSelectPlaceholder: 'Select language',
    // HeaderBar
    pinWindowTooltip: 'Pin window',
    unpinWindowTooltip: 'Unpin window',
    minimizeWindowTooltip: 'Minimize',
    closeWindowTooltip: 'Close',
    // SourcePickerModal
    sourcePickerTitle: 'Select Source to Share',
    sourcePickerSearching: 'Searching for available sources...',
    sourcePickerShareSourceTooltipPrefix: 'Share',
    cancelButton: 'Cancel',
    // ChatPanel
    chatPlaceholderSharing: 'Enter custom prompt or question...',
    chatPlaceholderNotSharing: 'Please start screen sharing first',
    sendChatButtonLabel: 'Send custom prompt',
    askAIButton: 'Ask AI',
    // RealTimeSubtitle
    showSubtitlesLabel: 'Show Subtitles',
    hideSubtitlesLabel: 'Hide Subtitles',
    showSubtitlesAriaLabel: 'Show subtitles',
    hideSubtitlesAriaLabel: 'Hide subtitles',
    // Markdown
    copyCodeButton: 'Copy',
    copyCodeSuccessToast: 'Copied successfully',
    // Textarea Hints
    textareaHint: 'Press Enter to confirm, Shift + Enter for new line',
    noQueryProvided: '[Hint] No query content provided.',
    currentScreen: 'this screenshot',
    screenshotAnalysis: 'Screenshot Analysis',
    noSearchQueryProvided: '[Hint] No search keywords provided.',
    search: 'Search',
    insufficientTranscription: '[Hint] Insufficient transcription content for analysis.',
    screenshotButton: 'Screenshot',
    // New Auth-related translations (English placeholders)
    loginToShareScreenToast: 'Login Required',
    loginToShareScreenDescriptionToast: 'Please log in to start screen sharing.',
    loginToTakeScreenshotToast: 'Login Required',
    loginToTakeScreenshotDescriptionToast: 'Please log in to take a screenshot.',
    loginToUseAiActionsToast: 'Login Required',
    loginToUseAiActionsDescriptionToast: 'Please log in to use AI actions with screen content.',
    statusAuthLoading: 'Authenticating...',
    statusAuthLoadingShort: 'Auth...',
    signOut: 'Sign Out',
    // Settings Modal
    viewHistory: 'View History',
    languageSettings: 'Language Settings',
    selectOutputLanguage: 'Select Output Language',
    restartSessionTitle: 'Restart Session?',
    restartSessionMessage:
      'To capture the new display, the current screen sharing session must be restarted.',
    restartButton: 'Restart',
    displaySettingsTitle: 'Display',
    showOnLabel: 'Show on',
    defaultDisplayLabel: 'Default',
    displayLabelPrefix: 'Display',
    primaryDisplaySuffix: '(Primary)',
    dailyQuotasTitle: 'Daily Quotas',
    usageDataNotAvailable: 'Usage data not available.',
    customPromptTitle: 'Custom Prompt',
    customPromptHint: 'Press Enter to confirm. Shift+Enter for a new line.'
  },
  'zh-TW': {
    // Add Traditional Chinese translations here
    greeting: '您好',
    // ControlPanel Status
    PreviewPanelTitle: '螢幕預覽',
    systemAudioLabel: '系統音訊',
    statusLoading: 'AI 處理中',
    statusSharing: '分享/錄製中',
    statusStopped: '已停止',
    statusLoadingShort: '處理中...',
    statusSharingShort: '分享中',
    statusStoppedShort: '已停止',
    stopSharingButton: '停止',
    startSharingButton: '分享',
    // ControlPanel Keywords
    keywordsTitle: '關鍵字',
    explainKeywordTooltipPrefix: '解釋',
    // ControlPanel AI Actions
    aiActionsTitle: 'AI 動作',
    aiActionAnswer: '深度回答',
    aiActionSummary: '產生摘要',
    shortcutKeyTooltip: '快捷鍵:',
    aiActionScreenshot: '截圖提問',
    aiActionUpload: '上傳檔案',
    // ControlPanel Advanced Settings
    advancedSettingsTitle: '進階設定',
    customPromptLabel: '客製化模型要求',
    customPromptPlaceholder: '輸入自定義提示詞後按 Enter...',
    currentPromptLabel: '當前模型要求',
    clearButton: '清除',
    languageSelectLabel: '語言選擇',
    languageSelectPlaceholder: '選擇語言',
    // HeaderBar
    pinWindowTooltip: '視窗置頂',
    unpinWindowTooltip: '取消置頂',
    minimizeWindowTooltip: '最小化',
    closeWindowTooltip: '關閉',
    // SourcePickerModal
    sourcePickerTitle: '選擇分享來源',
    sourcePickerSearching: '正在搜尋可用的分享來源...',
    sourcePickerShareSourceTooltipPrefix: '分享',
    cancelButton: '取消',
    // ChatPanel
    chatPlaceholderSharing: '輸入自訂提示詞或問題…',
    chatPlaceholderNotSharing: '請先開始分享螢幕',
    sendChatButtonLabel: '發送自訂提示詞',
    askAIButton: '詢問 AI',
    // RealTimeSubtitle
    showSubtitlesLabel: '顯示字幕',
    hideSubtitlesLabel: '隱藏字幕',
    showSubtitlesAriaLabel: '顯示字幕',
    hideSubtitlesAriaLabel: '隱藏字幕',
    // Markdown
    copyCodeButton: '複製',
    copyCodeSuccessToast: '複製成功',
    // Textarea Hints
    textareaHint: '按 Enter 確認，Shift + Enter 換行',
    noQueryProvided: '[提示] 沒有提供查詢內容。',
    currentScreen: '這張截圖',
    screenshotAnalysis: '截圖分析',
    noSearchQueryProvided: '[提示] 沒有提供搜尋關鍵字。',
    search: '搜尋',
    insufficientTranscription: '[提示] 沒有足夠的轉錄內容可供分析。',
    screenshotButton: '截圖',
    // Add zh-TW translations for new keys here
    loginToShareScreenToast: '請先登入',
    loginToShareScreenDescriptionToast: '請登入以開始分享螢幕。',
    loginToTakeScreenshotToast: '請先登入',
    loginToTakeScreenshotDescriptionToast: '請登入以擷取螢幕畫面。',
    loginToUseAiActionsToast: '請先登入',
    loginToUseAiActionsDescriptionToast: '請登入以使用螢幕內容相關的 AI 功能。',
    statusAuthLoading: '驗證中...',
    statusAuthLoadingShort: '驗證...',
    signOut: '登出',
    // Settings Modal
    viewHistory: '查看歷史紀錄',
    languageSettings: '語言設定',
    selectOutputLanguage: '選擇輸出語言',
    restartSessionTitle: '重新開始會話？',
    restartSessionMessage: '為了擷取新的顯示器，必須重新開始目前的螢幕分享會話。',
    restartButton: '重新開始',
    displaySettingsTitle: '顯示器',
    showOnLabel: '顯示於',
    defaultDisplayLabel: '預設',
    displayLabelPrefix: '顯示器',
    primaryDisplaySuffix: '(主要)',
    dailyQuotasTitle: '每日配額',
    usageDataNotAvailable: '無可用使用數據。',
    customPromptTitle: '自訂提示',
    customPromptHint: '按 Enter 確認，Shift+Enter 換行。'
  }
}

/**
 * Type definition for all translation keys in the application
 * Used for type safety when accessing translations
 *
 * @typedef {string} TranslationKey
 */
export type TranslationKey =
  | 'greeting'
  // ControlPanel Status
  | 'PreviewPanelTitle'
  | 'systemAudioLabel'
  | 'statusLoading'
  | 'statusSharing'
  | 'statusStopped'
  | 'statusLoadingShort'
  | 'statusSharingShort'
  | 'statusStoppedShort'
  | 'stopSharingButton'
  | 'startSharingButton'
  // ControlPanel Keywords
  | 'keywordsTitle'
  | 'explainKeywordTooltipPrefix'
  // ControlPanel AI Actions
  | 'aiActionsTitle'
  | 'aiActionAnswer'
  | 'aiActionSummary'
  | 'shortcutKeyTooltip'
  | 'aiActionScreenshot'
  | 'aiActionUpload'
  // ControlPanel Advanced Settings
  | 'advancedSettingsTitle'
  | 'customPromptLabel'
  | 'customPromptPlaceholder'
  | 'currentPromptLabel'
  | 'clearButton'
  | 'languageSelectLabel'
  | 'languageSelectPlaceholder'
  // HeaderBar
  | 'pinWindowTooltip'
  | 'unpinWindowTooltip'
  | 'minimizeWindowTooltip'
  | 'closeWindowTooltip'
  // SourcePickerModal
  | 'sourcePickerTitle'
  | 'sourcePickerSearching'
  | 'sourcePickerShareSourceTooltipPrefix'
  | 'cancelButton'
  // ChatPanel
  | 'chatPlaceholderSharing'
  | 'chatPlaceholderNotSharing'
  | 'sendChatButtonLabel'
  | 'askAIButton'
  // RealTimeSubtitle
  | 'showSubtitlesLabel'
  | 'hideSubtitlesLabel'
  | 'showSubtitlesAriaLabel'
  | 'hideSubtitlesAriaLabel'
  // Markdown
  | 'copyCodeButton'
  | 'copyCodeSuccessToast'
  // Textarea Hints
  | 'textareaHint'
  | 'noQueryProvided'
  | 'currentScreen'
  | 'screenshotAnalysis'
  | 'noSearchQueryProvided'
  | 'search'
  | 'insufficientTranscription'
  | 'screenshotButton'
  // New Auth-related keys
  | 'loginToShareScreenToast'
  | 'loginToShareScreenDescriptionToast'
  | 'loginToTakeScreenshotToast'
  | 'loginToTakeScreenshotDescriptionToast'
  | 'loginToUseAiActionsToast'
  | 'loginToUseAiActionsDescriptionToast'
  | 'statusAuthLoading'
  | 'statusAuthLoadingShort'
  | 'signOut'
  // Settings Modal
  | 'viewHistory'
  | 'languageSettings'
  | 'selectOutputLanguage'
  | 'restartSessionTitle'
  | 'restartSessionMessage'
  | 'restartButton'
  | 'displaySettingsTitle'
  | 'showOnLabel'
  | 'defaultDisplayLabel'
  | 'displayLabelPrefix'
  | 'primaryDisplaySuffix'
  | 'dailyQuotasTitle'
  | 'usageDataNotAvailable'
  | 'customPromptTitle'
  | 'customPromptHint'
// ... add other keys here

/**
 * Type definition for supported language codes in the application
 * Currently supports: en-US, zh-TW
 *
 * @typedef {string} SupportedLanguage
 */
export type SupportedLanguage = keyof typeof translations | 'original'
