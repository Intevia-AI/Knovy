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
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ResetStatusDialogProps {
  emails: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onResetComplete: () => void;
}

interface ResetResult {
  success: string[];
  failed: { email: string; error: string }[];
  protected: string[];
}

export function ResetStatusDialog({
  emails,
  isOpen,
  onOpenChange,
  onResetComplete,
}: ResetStatusDialogProps) {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResetStatus = async () => {
    if (!supabase || emails.length === 0) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-beta-invitation/reset`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            emails,
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
        if (
          data.results.success.length > 0 &&
          data.results.failed.length === 0 &&
          data.results.protected.length === 0
        ) {
          setTimeout(() => {
            onResetComplete();
            onOpenChange(false);
            setResult(null);
          }, 2000);
        }
      }
    } catch (err) {
      console.error("Error resetting invitation status:", err);
      setError(
        err instanceof Error ? err.message : "Failed to reset invitation status",
      );
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
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Reset Invitation Status
          </DialogTitle>
          <DialogDescription>
            This will reset the invitation status for {emails.length} user
            {emails.length > 1 ? "s" : ""} back to "Pending".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Warning:</strong> This action will clear the invitation status
              and timestamp. You will need to send a new invitation to these users.
            </AlertDescription>
          </Alert>

          {/* Email list */}
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Affected Users ({emails.length})
            </div>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-muted/50">
              {emails.map((email, index) => (
                <div key={index} className="text-sm py-1">
                  {email}
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-2">
              {result.success.length > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Successfully reset {result.success.length} user
                    {result.success.length > 1 ? "s" : ""}
                  </AlertDescription>
                </Alert>
              )}

              {result.protected.length > 0 && (
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    {result.protected.length} user
                    {result.protected.length > 1 ? "s have" : " has"} already
                    converted to beta and cannot be reset
                  </AlertDescription>
                </Alert>
              )}

              {result.failed.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to reset {result.failed.length} user
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
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleResetStatus}
            disabled={loading || emails.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Confirm Reset"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
