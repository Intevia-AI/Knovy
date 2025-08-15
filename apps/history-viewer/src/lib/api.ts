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
