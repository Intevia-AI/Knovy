"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@workspace/ui/components/table";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { SendInvitationDialog } from "./SendInvitationDialog";
import { CheckCircle2, XCircle, Mail, Users, Eye } from "lucide-react";
import { EmailPreviewDialog } from "./EmailPreviewDialog";

interface WaitlistUser {
  id: number;
  email: string;
  created_at: string;
  invited_to_beta: boolean;
  invited_at: string | null;
  converted_to_beta: boolean;
  converted_at: string | null;
}

export function WaitlistTable() {
  const { supabase } = useAuth();
  const [waitlist, setWaitlist] = useState<WaitlistUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const [emailsToInvite, setEmailsToInvite] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchWaitlist = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-beta-invitation/waitlist`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data?.waitlist) {
        setWaitlist(data.waitlist);
      }
    } catch (error) {
      console.error("Error fetching waitlist:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

  const handleSelectEmail = (email: string, checked: boolean) => {
    if (checked) {
      setSelectedEmails([...selectedEmails, email]);
    } else {
      setSelectedEmails(selectedEmails.filter((e) => e !== email));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const uninvitedEmails = waitlist
        .filter((user) => !user.invited_to_beta)
        .map((user) => user.email);
      setSelectedEmails(uninvitedEmails);
    } else {
      setSelectedEmails([]);
    }
  };

  const handleSendInvitation = (emails: string[]) => {
    setEmailsToInvite(emails);
    setInvitationDialogOpen(true);
  };

  const handleInvitationSent = () => {
    setSelectedEmails([]);
    fetchWaitlist(); // Refresh the list
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const uninvitedCount = waitlist.filter((user) => !user.invited_to_beta).length;
  const invitedCount = waitlist.filter((user) => user.invited_to_beta).length;
  const convertedCount = waitlist.filter((user) => user.converted_to_beta).length;

  if (loading) {
    return <p>Loading waitlist...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Waitlist Management</h1>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>Total: {waitlist.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              <span>Invited: {invitedCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              <span>Converted: {convertedCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              <span>Pending: {uninvitedCount}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview Email
          </Button>
          {selectedEmails.length > 0 && (
            <Button
              onClick={() => handleSendInvitation(selectedEmails)}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Send Invitations ({selectedEmails.length})
            </Button>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                checked={
                  selectedEmails.length > 0 &&
                  selectedEmails.length === uninvitedCount
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="cursor-pointer"
              />
            </TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Invitation Status</TableHead>
            <TableHead>Invited At</TableHead>
            <TableHead>Conversion Status</TableHead>
            <TableHead>Converted At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {waitlist.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                {!user.invited_to_beta && (
                  <input
                    type="checkbox"
                    checked={selectedEmails.includes(user.email)}
                    onChange={(e) =>
                      handleSelectEmail(user.email, e.target.checked)
                    }
                    className="cursor-pointer"
                  />
                )}
              </TableCell>
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(user.created_at)}
              </TableCell>
              <TableCell>
                {user.invited_to_beta ? (
                  <Badge variant="default" className="flex items-center gap-1 w-fit">
                    <CheckCircle2 className="h-3 w-3" />
                    Invited
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                    <XCircle className="h-3 w-3" />
                    Pending
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(user.invited_at)}
              </TableCell>
              <TableCell>
                {user.converted_to_beta ? (
                  <Badge variant="default" className="flex items-center gap-1 w-fit bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Converted
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    <XCircle className="h-3 w-3" />
                    Not Yet
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(user.converted_at)}
              </TableCell>
              <TableCell>
                {!user.invited_to_beta && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendInvitation([user.email])}
                    className="flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    Send
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SendInvitationDialog
        emails={emailsToInvite}
        isOpen={invitationDialogOpen}
        onOpenChange={setInvitationDialogOpen}
        onInvitationSent={handleInvitationSent}
      />

      <EmailPreviewDialog
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        sampleEmail={waitlist[0]?.email || "user@example.com"}
      />
    </div>
  );
}
