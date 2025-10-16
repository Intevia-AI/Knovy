"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  LayoutDashboard,
  Activity,
  Layers,
  TrendingUp,
  AlertCircle,
  BarChart3,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@workspace/ui/components/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    router.push("/logout");
  };

  const navItems: NavItem[] = [
    {
      label: "User Management",
      href: "/",
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: "Analytics Overview",
      href: "/analytics/overview",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      label: "User Activity",
      href: "/analytics/users",
      icon: <Activity className="w-5 h-5" />,
    },
    {
      label: "Feature Adoption",
      href: "/analytics/features",
      icon: <Layers className="w-5 h-5" />,
    },
    {
      label: "User Engagement",
      href: "/analytics/engagement",
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      label: "Error Monitoring",
      href: "/analytics/errors",
      icon: <AlertCircle className="w-5 h-5" />,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/" && pathname === "/") return true;
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <aside className="w-64 bg-background/40 backdrop-blur-xl p-4 border-r border-white/10">
        <div className="flex items-center gap-2 mb-8">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h2 className="text-lg font-semibold">Knovy Admin</h2>
        </div>

        <nav className="space-y-1">
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Management
            </p>
            <Link
              href={navItems[0]!.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                isActive(navItems[0]!.href)
                  ? "bg-accent/70 backdrop-blur-sm text-foreground font-medium shadow-sm"
                  : "hover:bg-accent/50 hover:backdrop-blur-sm text-muted-foreground hover:text-foreground"
              }`}
            >
              {navItems[0]!.icon}
              <span>{navItems[0]!.label}</span>
            </Link>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Analytics
            </p>
            <div className="space-y-1">
              {navItems.slice(1).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive(item.href)
                      ? "bg-accent/70 backdrop-blur-sm text-foreground font-medium shadow-sm"
                      : "hover:bg-accent/50 hover:backdrop-blur-sm text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-xs bg-primary/20 backdrop-blur-sm text-primary-foreground px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="mt-auto pt-8 space-y-2">
          <div className="px-3 py-2 rounded-lg bg-background/30 backdrop-blur-sm">
            {user?.email && (
              <p className="text-xs text-muted-foreground mb-2 truncate">{user.email}</p>
            )}
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="w-full justify-start hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto bg-background/50 backdrop-blur-sm">{children}</main>
    </div>
  );
}
