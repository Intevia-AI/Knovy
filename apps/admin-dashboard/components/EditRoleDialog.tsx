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
import { toast } from "sonner";

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
  const { supabase, user: currentUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState(user?.role || "");
  const [isSaving, setIsSaving] = useState(false);

  // Check if the user being edited is the current user
  const isEditingSelf = !!(user && currentUser && user.id === currentUser.id);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    if (isEditingSelf) {
      toast.error("You cannot change your own role");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-api/users/${user.id}/role`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: selectedRole }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      toast.success(`Role updated to ${selectedRole} for ${user.email}`);
      onRoleUpdate(user.id, selectedRole);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update role:", error);
      toast.error("Failed to update role. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role for {user.email}</DialogTitle>
          <DialogDescription>
            {isEditingSelf ? (
              <span className="text-destructive">
                You cannot change your own role. Ask another admin to change it for you.
              </span>
            ) : (
              "Select a new role for the user. This will immediately change their permissions."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedRole} onValueChange={setSelectedRole} disabled={isEditingSelf}>
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
          <Button onClick={handleSave} disabled={isSaving || isEditingSelf}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
