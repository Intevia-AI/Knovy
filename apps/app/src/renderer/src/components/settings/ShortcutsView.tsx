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
import { useTranslation } from '@/context/TranslationContext'
import type { TranslationKey } from '@/lib/translations'

interface Shortcut {
  actionKey: TranslationKey
  keys: string
}

const Kbd = ({ children }: { children: string }) => (
  <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
    {children}
  </kbd>
)

const shortcuts: Shortcut[] = [
  { actionKey: 'showHideKnovy', keys: 'Alt + \'' },
  { actionKey: 'openSettings', keys: '⌘ + ,' },
  { actionKey: 'startStopRecording', keys: '⌘ + R' },
  { actionKey: 'screenshotAndAsk', keys: '⌘ + Shift + S' },
  { actionKey: 'viewHistory', keys: '⌘ + H' },
  { actionKey: 'hideWindow', keys: 'Esc' }
]

export function ShortcutsView() {
  const { t } = useTranslation()

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

      {/* Shortcuts Table Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">{t('keyboardShortcuts')}</h3>
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
                {shortcuts.map((shortcut, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{t(shortcut.actionKey)}</TableCell>
                    <TableCell>
                      <Kbd>{shortcut.keys}</Kbd>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
