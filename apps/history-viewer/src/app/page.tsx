"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { getSessions, getTranscripts, deleteSession } from "@/lib/api";
import { SessionItem } from "@/components/session-item";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

export default function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        const sessions = await getSessions();
        setSessions(sessions);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  const handleSelectSession = async (sessionId: string) => {
    try {
      const transcripts = await getTranscripts(sessionId);
      setSelectedSession(sessions.find(s => s.id === sessionId));
      setTranscripts(transcripts);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setTranscripts([]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSession(null);
    setTranscripts([]);
  };

  const filteredSessions = selectedDate
    ? sessions.filter(s => new Date(s.started_at).toLocaleDateString() === selectedDate)
    : sessions;

  const concatenatedTranscripts = transcripts.map(t => t.content).join("\n");

  return (
    <div className="flex h-screen">
      <Sidebar sessions={sessions} onSelectDate={handleSelectDate} />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Session Transcriptions</h1>
        <div className="space-y-2 mb-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            filteredSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                onSelect={handleSelectSession}
                onDelete={handleDeleteSession}
              />
            ))
          )}
        </div>
        {selectedSession ? (
          <Card>
            <CardHeader>
              <CardTitle>{new Date(selectedSession.started_at).toLocaleString()}</CardTitle>
              <CardDescription>
                Duration: {new Date(selectedSession.ended_at - selectedSession.started_at).toISOString().substr(11, 8)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>{concatenatedTranscripts}</p>
            </CardContent>
          </Card>
        ) : (
          <p>Select a session to view the transcription.</p>
        )}
      </main>
    </div>
  );
}
