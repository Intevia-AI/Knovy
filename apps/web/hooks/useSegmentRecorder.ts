import { useCallback, useRef, useState } from 'react';

const SEGMENT_MS = 20_000; // segment length
const CHUNK_MS   = 1_000;  // internal timeslice

export function useSegmentRecorder() {

  const streamRef = useRef<MediaStream>(null);
  const recRef    = useRef<MediaRecorder>(null);
  const timerRef  = useRef<NodeJS.Timeout>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [mimeType,  setMime]      = useState('audio/webm;codecs=opus');

  // assemble and dispatch a complete segment
  const makeBlob = () =>
    new Blob(chunksRef.current.splice(0), { type: mimeType });

  const startRecorder = useCallback(() => {
    if (!streamRef.current) return;
    const rec = new MediaRecorder(streamRef.current, { mimeType });
    rec.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = makeBlob();
      window.dispatchEvent(new CustomEvent('segment', { detail: blob }));
      startRecorder();
    };
    rec.start(CHUNK_MS);
    recRef.current = rec;
  }, [mimeType]);

  const start = useCallback(async () => {
    if (recording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    setMime(
      MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/ogg;codecs=opus'
    );
    startRecorder();
    timerRef.current = setInterval(() => recRef.current?.stop(), SEGMENT_MS);
    setRecording(true);
  }, [recording, startRecorder]);

  const stop = useCallback(() => {
    clearInterval(timerRef.current!);
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setRecording(false);
  }, []);

  return { recording, start, stop, mimeType };
}
