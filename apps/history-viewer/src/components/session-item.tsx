import { Button } from "@workspace/ui/components/button";

interface Session {
  id: string;
  started_at: string;
}

interface SessionItemProps {
  session: Session;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SessionItem({ session, onSelect, onDelete }: SessionItemProps) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" className="w-full justify-start" onClick={() => onSelect(session.id)}>
        {new Date(session.started_at).toLocaleString()}
      </Button>
      <Button variant="destructive" size="sm" onClick={() => onDelete(session.id)}>Delete</Button>
    </div>
  );
}