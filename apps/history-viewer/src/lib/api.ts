const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function getSessions() {
  const res = await fetch(`${API_URL}/sessions`);
  if (!res.ok) {
    throw new Error("Failed to fetch sessions");
  }
  return res.json();
}

export async function getTranscripts(sessionId: string) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/transcripts`);
  if (!res.ok) {
    throw new Error(`Failed to fetch transcripts for session ${sessionId}`);
  }
  return res.json();
}

export async function deleteSession(sessionId: string) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete session ${sessionId}`);
  }
  return res.json();
}

export async function getSummary(sessionId: string) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/summary`);
  if (!res.ok) {
    // A 404 is a valid case if no summary exists yet, so we handle it gracefully
    if (res.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch summary for session ${sessionId}`);
  }
  // Handle cases where the summary might be empty in the DB
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
