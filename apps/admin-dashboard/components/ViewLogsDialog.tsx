"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@workspace/ui/components/table";

interface User {
  id: string;
  email: string;
  role: string;
}

interface ActionLog {
  id: number;
  action: string;
  timestamp: string;
  metadata: any;
}

interface ViewLogsDialogProps {
  user: User | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ViewLogsDialog({ user, isOpen, onOpenChange }: ViewLogsDialogProps) {
  const { supabase } = useAuth();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke(`admin-api/users/${user.id}/usage`);
        if (data?.logs) {
          setLogs(data.logs);
        } else {
          setLogs([]);
        }
        if (error) {
          console.error("Error fetching logs:", error);
        }
        setLoading(false);
      };
      fetchLogs();
    }
  }, [isOpen, user, supabase]);

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Action Logs for {user.email}</DialogTitle>
          <DialogDescription>Here are the recent actions performed by this user.</DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-96 overflow-y-auto">
          {loading ? (
            <p>Loading logs...</p>
          ) : logs.length === 0 ? (
            <p>No logs found for this user.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                    <TableCell>
                      <pre className="text-xs bg-muted p-2 rounded-md">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
