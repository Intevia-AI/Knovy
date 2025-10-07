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
    microphoneAudioLabel: 'Microphone Audio',
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
    // ChatPanel
    chatPlaceholderSharing: 'Enter custom prompt or question...',
    chatPlaceholderNotSharing: 'Please start screen sharing first',
    sendChatButtonLabel: 'Send custom prompt',
    askAIButton: 'Ask AI',
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
    // Settings Panel
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
    customPromptHint: 'Press Enter to confirm. Shift+Enter for a new line.',
    toggleAppVisibility: 'Toggle App Visibility',
    toggleAppVisibilitySubtitle: 'Protect Knovy from being shared to meeting apps',
    quitKnovy: 'Quit Knovy',
    cancelButton: 'Cancel',
    // Section Titles
    generalSection: 'General',
    appearanceSection: 'Appearance',
    accountSection: 'Account',
    aboutSection: 'About',

    // About Section
    versionLabel: 'Version',
    copyrightLabel: 'Copyright',

    // AI Action Display Messages
    aiActionChatDisplay: 'Chat',
    aiActionAnswerDisplay: 'Answer based on transcription',
    aiActionSummaryDisplay: 'Generate summary from transcription',
    aiActionKeywordSearchDisplay: 'Keyword search',
    aiActionScreenshotDisplay: 'Screenshot analysis',
    // ChatPanel Tabs
    transcriptionTab: 'Transcription',
    summaryTab: 'Summary',
    // Settings Sidebar
    generalTab: 'General',
    historyTab: 'History',
    accountTab: 'Account',
    displayTab: 'Display',
    shortcutsTab: 'Shortcuts',
    aboutTab: 'About',
    // Settings Pages
    settingsTitle: 'Settings',
    settingsDescription: 'Manage your general settings',
    historyTitle: 'History',
    historyDescription: 'View and manage your session history',
    searchSessions: 'Search sessions...',
    calendar: 'Calendar',
    noSessionsFound: 'No sessions found matching your search',
    noSessionsYet: 'No sessions yet',
    shortcutsTitle: 'Keyboard Shortcuts',
    shortcutsDescription: 'View all available keyboard shortcuts',
    keyboardShortcuts: 'Keyboard Shortcuts',
    shortcutAction: 'Action',
    shortcutKey: 'Shortcut',
    // Shortcut Categories
    shortcutCategoryGlobal: 'Global',
    shortcutCategoryRecording: 'Recording',
    shortcutCategoryPanels: 'Panels',
    shortcutCategoryAiActions: 'AI Actions',
    // Shortcut Actions
    toggleKnovy: 'Show / Hide Knovy',
    toggleSettings: 'Show / Hide Settings',
    toggleRecording: 'Toggle Recording',
    hideWindow: 'Hide Window',
    togglePreviewPanel: 'Show / Hide Preview Panel',
    toggleChatPanel: 'Show / Hide Chat Panel',
    toggleActionsPanel: 'Show / Hide Actions Panel',
    aiActionRecommendResponse: 'Recommend Response',
    aiActionScreenshotAnalysis: 'Analyze Screenshot',
    aboutTitle: 'About',
    aboutDescription: 'About Knovy and version information',
    aiPoweredTranscription: 'Your All-in-One AI working assistant',
    visitWebsite: 'Visit Website',
    checkForUpdates: 'Check for Updates',
    generalSettingsDescription: 'Manage your general application settings',
    languageChangeWarning: 'Changing language will stop your current recording session',
    displaySettingsDescription: 'Configure display and screen settings',
    contentProtectionDescription: 'Hide app content from screenshots and screen recordings',
    accountSettingsDescription: 'Manage your account and subscription',
    // Delete Confirmation Dialog
    deleteSessionTitle: 'Delete Session?',
    deleteSessionMessage:
      'Are you sure you want to delete this session? This action cannot be undone.',
    deleteButton: 'Delete',
    cancelDeleteButton: 'Cancel',
    // Screenshot Selection Window
    screenshotSelectionHint: 'Click and drag to select an area',
    screenshotSelectionCapture: 'Release mouse or press Enter to capture',
    screenshotSelectionCancel: 'Press ESC to cancel'
  },
  'zh-TW': {
    // Add Traditional Chinese translations here
    greeting: '您好',
    // ControlPanel Status
    PreviewPanelTitle: '螢幕預覽',
    systemAudioLabel: '系統音訊',
    microphoneAudioLabel: '麥克風音訊',
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
    // ChatPanel
    chatPlaceholderSharing: '輸入自訂提示詞或問題…',
    chatPlaceholderNotSharing: '請先開始分享螢幕',
    sendChatButtonLabel: '發送自訂提示詞',
    askAIButton: '詢問 AI',
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
    // Settings Panel
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
    customPromptHint: '按 Enter 確認，Shift+Enter 換行。',
    toggleAppVisibility: '顯示/隱藏 Knovy',
    toggleAppVisibilitySubtitle: '保護 Knovy 不被截圖或錄製',
    quitKnovy: '退出 Knovy',
    cancelButton: '取消',
    // Section Titles
    generalSection: '一般',
    appearanceSection: '外觀',
    accountSection: '帳戶',
    aboutSection: '關於',

    // About Section
    versionLabel: '版本',
    copyrightLabel: '版權',

    // AI Action Display Messages
    aiActionChatDisplay: '聊天', // We don't actually use this translation key, but we need to keep it for compatibility
    aiActionAnswerDisplay: '請根據前後文推薦適合的回應',
    aiActionSummaryDisplay: '請根據前後文產生摘要',
    aiActionKeywordSearchDisplay: '關鍵字搜尋',
    aiActionScreenshotDisplay: '請分析這張截圖',
    // ChatPanel Tabs
    transcriptionTab: '逐字稿',
    summaryTab: '摘要',
    // Settings Sidebar
    generalTab: '設定',
    historyTab: '歷史紀錄',
    accountTab: '帳戶',
    displayTab: '顯示器',
    shortcutsTab: '快捷鍵',
    aboutTab: '關於',
    // Settings Pages
    settingsTitle: '設定',
    settingsDescription: '管理您的一般設定',
    historyTitle: '歷史紀錄',
    historyDescription: '查看和管理您的對話紀錄',
    searchSessions: '搜尋對話紀錄...',
    calendar: '日曆',
    noSessionsFound: '找不到符合您搜尋的對話紀錄',
    noSessionsYet: '尚無對話紀錄',
    shortcutsTitle: '鍵盤快捷鍵',
    shortcutsDescription: '查看所有可用的鍵盤快捷鍵',
    keyboardShortcuts: '鍵盤快捷鍵',
    shortcutAction: '動作',
    shortcutKey: '快捷鍵',
    // Shortcut Categories
    shortcutCategoryGlobal: '一般',
    shortcutCategoryRecording: '螢幕錄製',
    shortcutCategoryPanels: '控制面板',
    shortcutCategoryAiActions: 'AI 動作',
    // Shortcut Actions
    toggleKnovy: '切換 Knovy',
    toggleSettings: '切換設定',
    toggleRecording: '切換錄製',
    hideWindow: '隱藏視窗',
    togglePreviewPanel: '切換預覽面板',
    toggleChatPanel: '切換聊天面板',
    toggleActionsPanel: '切換動作面板',
    aiActionRecommendResponse: '推薦回應',
    aiActionScreenshotAnalysis: '分析截圖',
    aboutTitle: '關於',
    aboutDescription: '關於 Knovy 和版本資訊',
    aiPoweredTranscription: 'Your All-in-One AI working assistant',
    visitWebsite: '來去官網',
    checkForUpdates: '檢查更新',
    generalSettingsDescription: '管理您的一般設定',
    languageChangeWarning: '變更語言將會停止您目前的錄製對話紀錄',
    displaySettingsDescription: '設定 Knovy 所處的螢幕',
    contentProtectionDescription: '隱藏應用程式內容，防止螢幕截圖和錄影',
    accountSettingsDescription: '管理您的帳戶和訂閱',
    // Delete Confirmation Dialog
    deleteSessionTitle: '刪除紀錄',
    deleteSessionMessage: '您確定要刪除此對話紀錄嗎？此操作無法復原。',
    deleteButton: '刪除',
    cancelDeleteButton: '取消',
    // Screenshot Selection Window
    screenshotSelectionHint: '點擊並拖曳以選擇區域',
    screenshotSelectionCapture: '放開滑鼠或按 Enter 進行截圖',
    screenshotSelectionCancel: '按 ESC 取消'
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
  | 'microphoneAudioLabel'
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
  // ChatPanel
  | 'chatPlaceholderSharing'
  | 'chatPlaceholderNotSharing'
  | 'sendChatButtonLabel'
  | 'askAIButton'
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
  // Settings Panel
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
  | 'toggleAppVisibility'
  | 'toggleAppVisibilitySubtitle'
  | 'quitKnovy'
  | 'cancelButton'
  // Section Titles
  | 'generalSection'
  | 'appearanceSection'
  | 'accountSection'
  | 'aboutSection'
  | 'versionLabel'
  | 'copyrightLabel'
  // AI Action Display Messages
  | 'aiActionChatDisplay'
  | 'aiActionAnswerDisplay'
  | 'aiActionSummaryDisplay'
  | 'aiActionKeywordSearchDisplay'
  | 'aiActionScreenshotDisplay'
  // ChatPanel Tabs
  | 'transcriptionTab'
  | 'summaryTab'
  // Settings Sidebar
  | 'generalTab'
  | 'historyTab'
  | 'accountTab'
  | 'displayTab'
  | 'shortcutsTab'
  | 'aboutTab'
  // Settings Pages
  | 'settingsTitle'
  | 'settingsDescription'
  | 'historyTitle'
  | 'historyDescription'
  | 'searchSessions'
  | 'calendar'
  | 'noSessionsFound'
  | 'noSessionsYet'
  | 'shortcutsTitle'
  | 'shortcutsDescription'
  | 'keyboardShortcuts'
  | 'shortcutAction'
  | 'shortcutKey'
  // Shortcut Categories
  | 'shortcutCategoryGlobal'
  | 'shortcutCategoryRecording'
  | 'shortcutCategoryPanels'
  | 'shortcutCategoryAiActions'
  // Shortcut Actions
  | 'toggleKnovy'
  | 'toggleSettings'
  | 'toggleRecording'
  | 'hideWindow'
  | 'togglePreviewPanel'
  | 'toggleChatPanel'
  | 'toggleActionsPanel'
  | 'aiActionRecommendResponse'
  | 'aiActionScreenshotAnalysis'
  | 'aboutTitle'
  | 'aboutDescription'
  | 'aiPoweredTranscription'
  | 'visitWebsite'
  | 'checkForUpdates'
  | 'generalSettingsDescription'
  | 'languageChangeWarning'
  | 'displaySettingsDescription'
  | 'contentProtectionDescription'
  | 'accountSettingsDescription'
  // Delete Confirmation Dialog
  | 'deleteSessionTitle'
  | 'deleteSessionMessage'
  | 'deleteButton'
  | 'cancelDeleteButton'

/**
 * Type definition for supported language codes in the application
 * Currently supports: en-US, zh-TW
 *
 * @typedef {string} SupportedLanguage
 */
export type SupportedLanguage = keyof typeof translations | 'original'
