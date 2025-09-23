export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getSessions() {
  const res = await fetch('http://localhost:4000/api/sessions');

  if (!res.ok) {
    if (res.status >= 500) {
      throw new ApiError(res.status, 'Server error occurred');
    }
    throw new ApiError(res.status, `Request failed with status ${res.status}`);
  }

  return res.json();
}

export async function getTranscripts(sessionId: string) {
  const res = await fetch(`http://localhost:4000/api/sessions/${sessionId}/transcripts`);

  if (!res.ok) {
    if (res.status === 404) {
      throw new ApiError(404, 'Transcripts not found');
    }
    if (res.status >= 500) {
      throw new ApiError(res.status, 'Server error occurred');
    }
    throw new ApiError(res.status, `Request failed with status ${res.status}`);
  }

  return res.json();
}

export async function getSummary(sessionId: string) {
  const res = await fetch(`http://localhost:4000/api/sessions/${sessionId}/summary`);

  if (!res.ok) {
    if (res.status === 404) {
      throw new ApiError(404, 'Summary not found');
    }
    if (res.status >= 500) {
      throw new ApiError(res.status, 'Server error occurred');
    }
    throw new ApiError(res.status, `Request failed with status ${res.status}`);
  }

  const data = await res.json();
  return data;
}

export async function deleteSession(sessionId: string) {
  const res = await fetch(`http://localhost:4000/api/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    if (res.status >= 500) {
      throw new ApiError(res.status, 'Server error occurred');
    }
    throw new ApiError(res.status, `Request failed with status ${res.status}`);
  }

  return res.json();
}