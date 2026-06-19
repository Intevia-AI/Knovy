class SystemAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.bufferSize = options.processorOptions.bufferSize || 8192
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
    this.sourceType = 'system'
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (input.length > 0) {
      const inputChannel = input[0]

      // Calculate audio level (used by the VU meter)
      let sum = 0
      for (let i = 0; i < inputChannel.length; i++) {
        sum += inputChannel[i] * inputChannel[i]
      }
      const rms = Math.sqrt(sum / inputChannel.length)
      const level = Math.min(1, rms * 100)

      // Emit every full buffer as Float32 PCM
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i]
        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage(
            { pcmData: this.buffer.slice(0).buffer, level: level * 100, sourceType: this.sourceType },
            []
          )
          this.bufferIndex = 0
        }
      }
    }

    return true
  }
}

registerProcessor('system-audio-processor', SystemAudioProcessor)
