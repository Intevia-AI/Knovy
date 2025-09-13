'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@workspace/ui/components/table';
import { Button } from '@workspace/ui/components/button';
import { EditRoleDialog } from './EditRoleDialog';
import { ViewLogsDialog } from './ViewLogsDialog';

interface User {
  id: string;
  email: string;
  role: string;
}

export function UserTable() {
  const { supabase } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingLogsUser, setViewingLogsUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-api/users', { method: 'GET' });
    if (data?.users) {
      setUsers(data.users);
    }
    if (error) {
      console.error('Error fetching users:', error);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleUpdate = (userId: string, newRole: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  if (loading) {
    return <p>Loading users...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">User Management</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                  Edit Role
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setViewingLogsUser(user)}>
                  View Logs
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <EditRoleDialog
        user={editingUser}
        isOpen={!!editingUser}
        onOpenChange={(isOpen) => !isOpen && setEditingUser(null)}
        onRoleUpdate={handleRoleUpdate}
      />
      <ViewLogsDialog
        user={viewingLogsUser}
        isOpen={!!viewingLogsUser}
        onOpenChange={(isOpen) => !isOpen && setViewingLogsUser(null)}
      />
    </div>
  );
}
