
import { ThemeSwitcher } from "./theme-switcher";

interface Session {
  id: string;
  started_at: string;
}

interface SidebarProps {
  sessions: Session[];
  onSelectDate: (date: string | null) => void;
}

export function Sidebar({ sessions, onSelectDate }: SidebarProps) {
  const groupedSessions = sessions.reduce((acc, session) => {
    const date = new Date(session.started_at).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  return (
    <aside className="w-64 bg-muted p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-lg font-semibold mb-4">History</h2>
        <div className="space-y-2">
          {Object.keys(groupedSessions).map((date) => (
            <div key={date}>
              <h3 className="text-sm font-semibold mb-1 cursor-pointer" onClick={() => onSelectDate(date)}>{new Date(date).toLocaleDateString("zh-TW").replace(/-/g, "/")}</h3>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <ThemeSwitcher />
      </div>
    </aside>
  );
}

