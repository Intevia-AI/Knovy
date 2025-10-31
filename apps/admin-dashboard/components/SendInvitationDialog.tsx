"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { CheckCircle2, XCircle, Loader2, AlertCircle, Eye } from "lucide-react";
import { EmailPreviewDialog } from "./EmailPreviewDialog";

interface SendInvitationDialogProps {
  emails: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onInvitationSent: () => void;
  isResend?: boolean;
}

interface InvitationResult {
  success: string[];
  failed: { email: string; error: string }[];
  alreadyInvited: string[];
  immediatelyUpgraded: string[];
}

export function SendInvitationDialog({
  emails,
  isOpen,
  onOpenChange,
  onInvitationSent,
  isResend = false,
}: SendInvitationDialogProps) {
  const { supabase } = useAuth();
  const [locale, setLocale] = useState<"en" | "zh-TW">("en");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleSendInvitations = async () => {
    if (!supabase || emails.length === 0) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-beta-invitation`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            emails,
            locale,
            force: isResend, // Pass force flag for resend mode
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.results) {
        setResult(data.results);

        // If all succeeded, close dialog after a delay
        if (data.results.success.length > 0 && data.results.failed.length === 0) {
          setTimeout(() => {
            onInvitationSent();
            onOpenChange(false);
            setResult(null);
          }, 2000);
        }
      }
    } catch (err) {
      console.error("Error sending invitations:", err);
      setError(err instanceof Error ? err.message : "Failed to send invitations");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      setResult(null);
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isResend ? "Resend Beta Invitation" : "Send Beta Invitation"}</DialogTitle>
          <DialogDescription>
            {isResend
              ? `Resend beta invitation email${emails.length > 1 ? "s" : ""} to ${emails.length} user${emails.length > 1 ? "s" : ""}. This will update the invitation timestamp.`
              : `Send beta invitation email${emails.length > 1 ? "s" : ""} to ${emails.length} user${emails.length > 1 ? "s" : ""}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email list */}
          <div className="space-y-2">
            <Label>Recipients ({emails.length})</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-muted/50">
              {emails.map((email, index) => (
                <div key={index} className="text-sm py-1">
                  {email}
                </div>
              ))}
            </div>
          </div>

          {/* Language selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="locale">Email Language</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-1 h-8"
              >
                <Eye className="h-4 w-4" />
                Preview Email
              </Button>
            </div>
            <Select value={locale} onValueChange={(value: "en" | "zh-TW") => setLocale(value)}>
              <SelectTrigger id="locale">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh-TW">繁體中文 (Traditional Chinese)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-2">
              {result.success.length > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {isResend
                      ? `Successfully resent ${result.success.length} invitation${result.success.length > 1 ? "s" : ""}`
                      : `Successfully sent ${result.success.length} invitation${result.success.length > 1 ? "s" : ""}`}
                  </AlertDescription>
                </Alert>
              )}

              {result.immediatelyUpgraded && result.immediatelyUpgraded.length > 0 && (
                <Alert className="border-blue-200 bg-blue-50">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    {result.immediatelyUpgraded.length} existing user
                    {result.immediatelyUpgraded.length > 1 ? "s" : ""} immediately upgraded to beta!
                  </AlertDescription>
                </Alert>
              )}

              {result.alreadyInvited.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    {result.alreadyInvited.length} user
                    {result.alreadyInvited.length > 1 ? "s" : ""} already invited
                  </AlertDescription>
                </Alert>
              )}

              {result.failed.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to send {result.failed.length} invitation
                    {result.failed.length > 1 ? "s" : ""}:
                    <ul className="mt-2 list-disc list-inside">
                      {result.failed.map((f, i) => (
                        <li key={i} className="text-sm">
                          {f.email}: {f.error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSendInvitations} disabled={loading || emails.length === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isResend ? "Resending..." : "Sending..."}
              </>
            ) : isResend ? (
              "Resend Invitations"
            ) : (
              "Send Invitations"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <EmailPreviewDialog
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        sampleEmail={emails[0] || "user@example.com"}
      />
    </Dialog>
  );
}
