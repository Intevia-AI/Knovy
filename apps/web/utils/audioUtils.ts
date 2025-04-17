// Helper function to download and analyze WAV data
function debugSaveWav(wavData: string, filename: string = 'debug.wav') {
  const byteString = atob(wavData);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  
  // Create blob and download
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function pcmToWav(pcmData: string, sampleRate: number = 24000): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Decode base64 PCM data
      const binaryString = atob(pcmData);
      const pcmBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pcmBytes[i] = binaryString.charCodeAt(i);
      }

      // Convert bytes to samples (assuming 16-bit PCM)
      const samples = new Int16Array(pcmBytes.buffer);

      // Create WAV header
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);

      const pcmByteLength = samples.length * 2; // 16-bit = 2 bytes per sample

      // "RIFF" chunk descriptor
      view.setUint8(0, 'R'.charCodeAt(0));
      view.setUint8(1, 'I'.charCodeAt(0));
      view.setUint8(2, 'F'.charCodeAt(0));
      view.setUint8(3, 'F'.charCodeAt(0));

      // File length (header size + data size)
      view.setUint32(4, 36 + pcmByteLength, true);

      // "WAVE" format
      view.setUint8(8, 'W'.charCodeAt(0));
      view.setUint8(9, 'A'.charCodeAt(0));
      view.setUint8(10, 'V'.charCodeAt(0));
      view.setUint8(11, 'E'.charCodeAt(0));

      // "fmt " sub-chunk
      view.setUint8(12, 'f'.charCodeAt(0));
      view.setUint8(13, 'm'.charCodeAt(0));
      view.setUint8(14, 't'.charCodeAt(0));
      view.setUint8(15, ' '.charCodeAt(0));

      // Sub-chunk size (16 for PCM)
      view.setUint32(16, 16, true);

      // Audio format (1 for PCM)
      view.setUint16(20, 1, true);

      // Number of channels (1 for mono)
      view.setUint16(22, 1, true);

      // Sample rate
      view.setUint32(24, sampleRate, true);

      // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
      view.setUint32(28, sampleRate * 1 * 16/8, true);

      // Block align (NumChannels * BitsPerSample/8)
      view.setUint16(32, 1 * 16/8, true);

      // Bits per sample
      view.setUint16(34, 16, true);

      // "data" sub-chunk
      view.setUint8(36, 'd'.charCodeAt(0));
      view.setUint8(37, 'a'.charCodeAt(0));
      view.setUint8(38, 't'.charCodeAt(0));
      view.setUint8(39, 'a'.charCodeAt(0));

      // Data size
      view.setUint32(40, pcmByteLength, true);

      // Combine header and PCM data
      const wavData = new Uint8Array(wavHeader.byteLength + pcmBytes.length);
      wavData.set(new Uint8Array(wavHeader), 0);
      wavData.set(pcmBytes, wavHeader.byteLength);

      // Convert to base64
      const base64Wav = btoa(String.fromCharCode(...wavData));
      resolve(base64Wav);
    } catch (error) {
      reject(error);
    }
  });
} 