import { useState, useEffect } from 'react'
import { motion } from 'motion'
import { Info } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/context/TranslationContext'
import type { TranslationKey } from '@/lib/translations'

interface Shortcut {
  actionKey: TranslationKey
  keys: string[]
}

interface ShortcutCategory {
  categoryKey: TranslationKey
  shortcuts: Shortcut[]
}

const Kbd = ({ keys }: { keys: string[] }) => (
  <span className="inline-flex items-center gap-1">
    {keys.map((key, index) => (
      <kbd
        key={index}
        className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded shadow-sm font-mono min-w-[24px]"
      >
        {key}
      </kbd>
    ))}
  </span>
)

const shortcutCategories: ShortcutCategory[] = [
  {
    categoryKey: 'shortcutCategoryGlobal',
    shortcuts: [
      { actionKey: 'toggleKnovy', keys: ['⌥', '\\'] },
      { actionKey: 'toggleSettings', keys: ['⌥', ','] },
      { actionKey: 'hideWindow', keys: ['Esc'] }
    ]
  },
  {
    categoryKey: 'shortcutCategoryRecording',
    shortcuts: [
      { actionKey: 'toggleRecording', keys: ['⌥', 'R'] }
    ]
  },
  {
    categoryKey: 'shortcutCategoryPanels',
    shortcuts: [
      { actionKey: 'togglePreviewPanel', keys: ['⌥', 'P'] },
      { actionKey: 'toggleChatPanel', keys: ['⌥', 'C'] },
      { actionKey: 'toggleActionsPanel', keys: ['⌥', 'A'] }
    ]
  },
  {
    categoryKey: 'shortcutCategoryAiActions',
    shortcuts: [
      { actionKey: 'aiActionRecommendResponse', keys: ['⌥', '1'] },
      { actionKey: 'aiActionScreenshotAnalysis', keys: ['⌥', '2'] }
    ]
  }
]

export function ShortcutsView() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading for consistent UX
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Alert Skeleton */}
        <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/50 p-4">
          <Skeleton className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <Skeleton className="h-4 flex-1" />
        </div>

        {/* Shortcut Cards Skeleton */}
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-background/50 backdrop-blur-sm">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-[60%]" />
                    <Skeleton className="h-4 w-[40%]" />
                  </div>
                  {Array.from({ length: i === 1 ? 3 : i === 4 ? 2 : 1 }, (_, j) => (
                    <div key={j} className="flex items-center gap-4">
                      <Skeleton className="h-8 w-[60%]" />
                      <div className="flex gap-1">
                        <Skeleton className="h-7 w-10 rounded" />
                        <Skeleton className="h-7 w-10 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Help Footer Skeleton */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Skeleton className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t('shortcutsTab')}</h2>
        <p className="text-sm text-muted-foreground">{t('shortcutsDescription')}</p>
      </div>

      {/* Info Alert */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Alert variant="default">
          <Info className="w-4 h-4" />
          <AlertDescription>
            Customizable keyboard shortcuts will be available in a future update.
          </AlertDescription>
        </Alert>
      </motion.div>

      {/* Shortcuts by Category */}
      <div className="space-y-6">
        {shortcutCategories.map((category, categoryIndex) => (
          <motion.div
            key={category.categoryKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 * (categoryIndex + 1) }}
          >
            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium">{t(category.categoryKey)}</h3>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60%]">{t('shortcutAction')}</TableHead>
                      <TableHead>{t('shortcutKey')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {category.shortcuts.map((shortcut, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{t(shortcut.actionKey)}</TableCell>
                        <TableCell>
                          <Kbd keys={shortcut.keys} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Help Footer */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Tip:</strong> Global shortcuts work even when Knovy is hidden.
              </p>
              <p>Shortcuts for Panels and AI Actions only work when recording is active.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
