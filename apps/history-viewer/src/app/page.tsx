"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { getSessions, getTranscripts, deleteSession } from "@/lib/api";
import { SessionItem } from "@/components/session-item";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Button } from "@workspace/ui/components/button";

interface Session {
  id: string;
  started_at: string;
  ended_at: string;
}

interface Transcript {
  id: string;
  session_id: string;
  timestamp: string;
  content: string;
}

function TranscriptView({ sessionId }: { sessionId: string }) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTranscripts = async () => {
      setIsLoading(true);
      try {
        const fetchedTranscripts = await getTranscripts(sessionId);
        setTranscripts(fetchedTranscripts);
      } catch (err) {
        setError("Failed to load transcripts.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadTranscripts();
  }, [sessionId]);

  if (isLoading) {
    return <p>Loading transcripts...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="space-y-2 pl-4 border-l-2">
      {transcripts.length > 0 ? (
        transcripts.map((t) => (
          <p key={t.id} className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-semibold">{new Date(t.timestamp).toLocaleTimeString()}:</span>{" "}
            {t.content}
          </p>
        ))
      ) : (
        <p>No transcripts found for this session.</p>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        const sessions: Session[] = await getSessions();
        setSessions(sessions);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      setSessions((prevSessions) => prevSessions.filter((s) => s.id !== sessionId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectDate = (date: string | null) => {
    setSelectedDate(date);
  };

  const filteredSessions = selectedDate
    ? sessions.filter((s) => new Date(s.started_at).toLocaleDateString() === selectedDate)
    : sessions;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar sessions={sessions} onSelectDate={handleSelectDate} />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">
          Session History
          {selectedDate && (
            <span className="ml-4 text-base font-normal text-muted-foreground">
              {new Date(selectedDate).toLocaleDateString("zh-TW").replace(/-/g, "/")}
            </span>
          )}
        </h1>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {filteredSessions.map((session) => (
              <AccordionItem value={session.id} key={session.id}>
                <AccordionTrigger>
                  <div className="flex justify-between items-center w-full pr-4">
                    <span>
                      {new Date(session.started_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation(); // prevent accordion from opening
                        handleDeleteSession(session.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <TranscriptView sessionId={session.id} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {!loading && filteredSessions.length === 0 && (
          <p>No sessions found for the selected date.</p>
        )}
      </main>
    </div>
  );
}
