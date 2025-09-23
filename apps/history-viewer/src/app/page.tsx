"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { getSessions, getTranscripts, deleteSession, getSummary, ApiError } from "@/lib/api";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Button } from "@workspace/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Markdown } from "@/components/markdown";
import { Toaster } from "@workspace/ui/components/sonner";

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

interface Summary {
  id: number;
  session_id: string;
  content: string;
  updated_at: string;
}

function SummaryView({ sessionId }: { sessionId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedSummary = await getSummary(sessionId);
        setSummary(fetchedSummary);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            // Don't treat missing summary as an error
            setSummary(null);
            return;
          } else if (err.status >= 500) {
            setError("Server error occurred while loading summary.");
          } else {
            setError("Network error occurred while loading summary.");
          }
        } else {
          setError("Network error occurred while loading summary.");
        }
        console.error('Summary loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSummary();
  }, [sessionId]);

  if (isLoading) {
    return <p>Loading summary...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="p-2 rounded-md text-sm whitespace-pre-wrap bg-black/5 border border-black/10 text-black dark:bg-white/5 dark:border-white/10 dark:text-white">
      {summary ? (
        <Markdown>{summary.content}</Markdown>
      ) : (
        <p className="text-gray-500 italic">No summary available for this session.</p>
      )}
    </div>
  );
}

function TranscriptView({ sessionId }: { sessionId: string }) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTranscripts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedTranscripts = await getTranscripts(sessionId);
        setTranscripts(fetchedTranscripts);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            // Don't treat missing transcripts as an error
            setTranscripts([]);
            return;
          } else if (err.status >= 500) {
            setError("Server error occurred while loading transcripts.");
          } else {
            setError("Network error occurred while loading transcripts.");
          }
        } else {
          setError("Network error occurred while loading transcripts.");
        }
        console.error('Transcript loading error:', err);
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
        <p className="text-gray-500 italic">No transcripts found for this session.</p>
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
                <div className="flex items-center w-full">
                  <AccordionTrigger className="flex-grow p-4 text-left">
                    {new Date(session.started_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </AccordionTrigger>
                  <div className="pr-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSession(session.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <AccordionContent>
                  <Tabs defaultValue="transcripts" className="w-full">
                    <TabsList>
                      <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                    </TabsList>
                    <TabsContent value="transcripts">
                      <TranscriptView sessionId={session.id} />
                    </TabsContent>
                    <TabsContent value="summary">
                      <SummaryView sessionId={session.id} />
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {!loading && filteredSessions.length === 0 && (
          <p>No sessions found for the selected date.</p>
        )}
      </main>
      <Toaster />
    </div>
  );
}
