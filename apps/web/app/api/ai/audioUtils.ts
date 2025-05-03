export async function pcmToWav(
  pcmData: string,
  sampleRate: number,
): Promise<string> {
  // For now, we'll just return the PCM data as is since we're not using WAV conversion
  return pcmData;
}
