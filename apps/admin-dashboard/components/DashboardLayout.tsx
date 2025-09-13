import React from 'react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-muted/40 p-4 border-r">
        <h2 className="text-lg font-semibold">Knovy Admin</h2>
        <nav className="mt-8">
          <ul>
            <li>
              <a href="/" className="block py-2 px-4 rounded-md bg-accent text-accent-foreground">Users</a>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
