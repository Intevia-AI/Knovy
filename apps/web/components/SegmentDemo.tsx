'use client';
import { useEffect, useState } from 'react';
import { useSegmentRecorder } from '@/hooks/useSegmentRecorder';

export default function SegmentDemo() {
  const { recording, start, stop, mimeType } = useSegmentRecorder();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handler = async (e: CustomEvent<Blob>) => {
      setBusy(true);
      const buf = await e.detail.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: b64, mimeType }),
      });
      setBusy(false);
    };
    window.addEventListener('segment', handler as any);
    return () => window.removeEventListener('segment', handler as any);
  }, [mimeType]);

  return (
    <div className="flex gap-3">
      {!recording ? (
        <button onClick={start} className="btn-primary">
          🎙️ Start
        </button>
      ) : (
        <button onClick={stop} className="btn-danger">
          ⏹ Stop
        </button>
      )}
      {busy && <span>Uploading…</span>}
    </div>
  );
}
