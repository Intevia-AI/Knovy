/**
 * @fileoverview AudioVisualizer Component - Renders a real-time audio frequency visualization
 * @module AudioVisualizer
 * @description A React component that visualizes audio frequency data from an AnalyserNode
 * using HTML5 Canvas. It creates a bar graph visualization that updates in real-time.
 */

import React, { useRef, useEffect } from "react";

/**
 * @interface AudioVisualizerProps
 * @description Props for the AudioVisualizer component
 * @property {AnalyserNode|null} analyserNode - Web Audio API AnalyserNode providing frequency data
 * @property {number} [width=280] - Width of the canvas in pixels
 * @property {number} [height=50] - Height of the canvas in pixels
 * @property {string} [barColor="#3b82f6"] - Color of the frequency bars (CSS color)
 * @property {string} [backgroundColor="#f3f4f6"] - Background color of the canvas (CSS color)
 */
interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  width?: number;
  height?: number;
  barColor?: string;
  backgroundColor?: string;
}

/**
 * @component AudioVisualizer
 * @description Renders a real-time audio frequency visualization using HTML5 Canvas
 * 
 * @example
 * ```tsx
 * // Basic usage with an analyser node
 * <AudioVisualizer analyserNode={audioAnalyserNode} />
 * 
 * // Custom styling
 * <AudioVisualizer 
 *   analyserNode={audioAnalyserNode}
 *   width={500}
 *   height={100}
 *   barColor="#ff0000"
 *   backgroundColor="#000000"
 * />
 * ```
 */
const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyserNode,
  width = 280, // Default width
  height = 50, // Default height
  barColor = "#3b82f6", // Default blue-500
  backgroundColor = "#f3f4f6", // Default gray-100
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  /**
   * Effect hook that handles the canvas drawing and animation
   * Sets up a requestAnimationFrame loop to continuously draw the audio visualization
   * Cleans up by canceling the animation frame when the component unmounts
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext("2d");

    /**
     * Draw function that renders the audio visualization
     * Gets called recursively via requestAnimationFrame to create animation
     */
    const draw = () => {
      if (!analyserNode || !canvas || !canvasCtx) {
        // Clear canvas if analyserNode is null
        if (canvas && canvasCtx) {
          canvasCtx.fillStyle = backgroundColor;
          canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
        animationFrameId.current = requestAnimationFrame(draw); // Keep trying
        return;
      }

      // Set FFT size (power of 2, affects frequency resolution)
      analyserNode.fftSize = 256;
      const bufferLength = analyserNode.frequencyBinCount; // half of fftSize
      const dataArray = new Uint8Array(bufferLength);

      // Get frequency data
      analyserNode.getByteFrequencyData(dataArray);

      // --- Drawing ---
      canvasCtx.fillStyle = backgroundColor;
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5; // Adjust spacing
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const data = dataArray[i];
        if (!data) continue; // Skip if no data
        barHeight = (data / 255) * canvas!.height; // Scale height

        canvasCtx.fillStyle = barColor;
        canvasCtx.fillRect(x, canvas!.height - barHeight, barWidth, barHeight);

        x += barWidth + 1; // Add spacing between bars
      }

      // Request next frame
      animationFrameId.current = requestAnimationFrame(draw);
    };

    // Start drawing loop
    draw();

    // Cleanup function
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      // Optional: Clear canvas on unmount
      if (canvas && canvasCtx) {
        canvasCtx.fillStyle = backgroundColor;
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [analyserNode, width, height, barColor, backgroundColor]); // Re-run effect if analyserNode or dimensions/colors change

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-border w-full"
    />
  );
};

export default AudioVisualizer;
