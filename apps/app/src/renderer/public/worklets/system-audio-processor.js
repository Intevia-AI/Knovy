class SystemAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.bufferSize = options.processorOptions.bufferSize || 8192
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
    this.silenceThreshold = 0.01
    this.isSilent = true
    this.sourceType = 'system'

    // Enhanced VAD properties
    this.speechTimeout = 2000  // 2 seconds of silence = speech end (in ms)
    this.minSegmentLength = 3000  // Minimum 3 seconds
    this.maxSegmentLength = 45000 // Maximum 45 seconds
    this.speechStartTime = null
    this.lastSpeechTime = null
    this.isInSpeech = false
    this.segmentStartTime = null

    // Track time using currentTime from AudioContext
    this.lastProcessTime = 0
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (input.length > 0) {
      const inputChannel = input[0]
      const currentTime = Date.now()

      // Calculate audio level
      let sum = 0
      for (let i = 0; i < inputChannel.length; i++) {
        sum += inputChannel[i] * inputChannel[i]
      }
      const rms = Math.sqrt(sum / inputChannel.length)
      const level = Math.min(1, rms * 100)

      // Update silence state
      this.isSilent = level < this.silenceThreshold

      // Enhanced VAD: Speech detection logic
      if (!this.isSilent) {
        // Speech detected
        if (!this.isInSpeech) {
          // Start of speech
          this.isInSpeech = true
          this.speechStartTime = currentTime
          if (!this.segmentStartTime) {
            this.segmentStartTime = currentTime
          }
          console.log('[SystemAudioProcessor] Speech started')
        }
        this.lastSpeechTime = currentTime
      } else {
        // Silence detected
        if (this.isInSpeech && this.lastSpeechTime) {
          const silenceDuration = currentTime - this.lastSpeechTime

          // Check if silence timeout reached
          if (silenceDuration >= this.speechTimeout) {
            const segmentDuration = currentTime - (this.segmentStartTime || currentTime)

            // Only trigger segment end if minimum duration met
            if (segmentDuration >= this.minSegmentLength) {
              console.log(`[SystemAudioProcessor] Speech ended after ${segmentDuration}ms, triggering segment dispatch`)
              this.port.postMessage({
                type: 'speechEnd',
                segmentDuration,
                sourceType: this.sourceType
              })
              this.segmentStartTime = null
            }

            this.isInSpeech = false
            this.speechStartTime = null
          }
        }
      }

      // Force segment creation if maximum duration exceeded
      if (this.segmentStartTime) {
        const segmentDuration = currentTime - this.segmentStartTime
        if (segmentDuration >= this.maxSegmentLength) {
          console.log(`[SystemAudioProcessor] Maximum segment duration (${segmentDuration}ms) reached, forcing dispatch`)
          this.port.postMessage({
            type: 'speechEnd',
            segmentDuration,
            forced: true,
            sourceType: this.sourceType
          })
          this.segmentStartTime = currentTime // Start new segment immediately
        }
      }

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
