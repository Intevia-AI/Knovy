ALTER TABLE public.transcription_ledger
ADD CONSTRAINT transcription_ledger_session_id_key UNIQUE (session_id);
