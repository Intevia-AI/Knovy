"use client";

import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

interface User {
  id: string;
  email: string;
  role: string;
}

interface EditRoleDialogProps {
  user: User | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRoleUpdate: (userId: string, newRole: string) => void;
}

const ROLES = ["free", "pro", "admin", "beta"];

export function EditRoleDialog({ user, isOpen, onOpenChange, onRoleUpdate }: EditRoleDialogProps) {
  const { supabase } = useAuth();
  const [selectedRole, setSelectedRole] = useState(user?.role || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase.functions.invoke(`admin-api/users/${user.id}/role`, {
      body: { role: selectedRole },
    });

    if (error) {
      console.error("Failed to update role:", error);
      // Here you would ideally show a toast notification
    } else {
      onRoleUpdate(user.id, selectedRole);
      onOpenChange(false);
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role for {user.email}</DialogTitle>
          <DialogDescription>
            Select a new role for the user. This will immediately change their permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
