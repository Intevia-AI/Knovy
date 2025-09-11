export async function getSessions() {
  const res = await fetch('http://localhost:4000/api/sessions');
  return res.json();
}

export async function getTranscripts(sessionId: string) {
  const res = await fetch(`http://localhost:4000/api/sessions/${sessionId}/transcripts`);
  return res.json();
}

export async function getSummary(sessionId: string) {
  const res = await fetch(`http://localhost:4000/api/sessions/${sessionId}/summary`);
  return res.json();
}

export async function deleteSession(sessionId: string) {
  const res = await fetch(`http://localhost:4000/api/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  return res.json();
}