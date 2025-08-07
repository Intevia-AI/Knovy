import { Button } from "@workspace/ui/components/button";

export function SessionItem({ session, onSelect, onDelete }) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" className="w-full justify-start" onClick={() => onSelect(session.id)}>
        {new Date(session.started_at).toLocaleString()}
      </Button>
      <Button variant="destructive" size="sm" onClick={() => onDelete(session.id)}>Delete</Button>
    </div>
  );
}
