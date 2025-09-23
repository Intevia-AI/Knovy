class SystemAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.bufferSize = options.processorOptions.bufferSize || 8192
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
    this.silenceThreshold = 0.01
    this.isSilent = true
    this.sourceType = 'system'
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (input.length > 0) {
      const inputChannel = input[0]

      // Calculate audio level
      let sum = 0
      for (let i = 0; i < inputChannel.length; i++) {
        sum += inputChannel[i] * inputChannel[i]
      }
      const rms = Math.sqrt(sum / inputChannel.length)
      const level = Math.min(1, rms * 100)

      // Update silence state
      this.isSilent = level < this.silenceThreshold

      // Fill the buffer
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i]

        if (this.bufferIndex >= this.bufferSize) {
          // Only send data when not silent
          if (!this.isSilent) {
            // Convert to PCM data
            const pcmData = new Int16Array(this.bufferSize)
            for (let j = 0; j < this.bufferSize; j++) {
              const s = Math.max(-1, Math.min(1, this.buffer[j]))
              pcmData[j] = s < 0 ? s * 0x8000 : s * 0x7fff
            }

            // Send the data to the main thread with source type
            this.port.postMessage(
              {
                pcmData: pcmData.buffer,
                level: level * 100,
                sourceType: this.sourceType
              },
              [pcmData.buffer]
            )
          }

          this.bufferIndex = 0
        }
      }
    }

    return true
  }
}

registerProcessor('system-audio-processor', SystemAudioProcessor)
