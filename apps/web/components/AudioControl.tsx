// "use client";

// import { useEffect, useRef, useState } from "react";
// import { GeminiWebSocket } from "../gemini-nextjs/app/services/geminiWebSocket";

// export default function AudioControl() {
//   const [isActive, setIsActive] = useState(false);
//   const [isConnected, setIsConnected] = useState(false);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [audioLevel, setAudioLevel] = useState(0);
//   const [isProcessing, setIsProcessing] = useState(false);

//   const geminiWsRef = useRef<GeminiWebSocket | null>(null);
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
//   const mediaStreamRef = useRef<MediaStream | null>(null);

//   useEffect(() => {
//     // Log environment variables
//     console.log("[AudioControl] Environment variables:", {
//       NEXT_PUBLIC_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
//       GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY
//     });

//     // Initialize GeminiWebSocket but don't connect yet
//     console.log("[AudioControl] Creating GeminiWebSocket instance...");
//     geminiWsRef.current = new GeminiWebSocket(
//       (text) => {
//         console.log("[AudioControl] Received text:", text);
//       },
//       () => {
//         console.log("[AudioControl] WebSocket connection established");
//         setIsConnected(true);
//       },
//       (isPlaying) => {
//         console.log("[AudioControl] Playing state changed:", isPlaying);
//         setIsPlaying(isPlaying);
//       },
//       (level) => {
//         console.log("[AudioControl] Audio level:", level);
//         setAudioLevel(level);
//       },
//       (text) => {
//         console.log("[AudioControl] Received transcription:", text);
//       }
//     );

//     return () => {
//       console.log("[AudioControl] Cleaning up...");
//       if (geminiWsRef.current) {
//         geminiWsRef.current.disconnect();
//       }
//       if (mediaStreamRef.current) {
//         mediaStreamRef.current.getTracks().forEach(track => track.stop());
//       }
//       if (audioContextRef.current) {
//         audioContextRef.current.close();
//       }
//     };
//   }, []);

//   const startAudio = async () => {
//     try {
//       console.log("[AudioControl] Starting audio...");
//       setIsProcessing(true);

//       // Connect to WebSocket first
//       console.log("[AudioControl] Connecting to WebSocket...");
//       if (!geminiWsRef.current) {
//         console.error("[AudioControl] GeminiWebSocket instance is null!");
//         return;
//       }

//       console.log("[AudioControl] Calling connect() on GeminiWebSocket...");
//       geminiWsRef.current.connect();

//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           sampleRate: 16000,
//           channelCount: 1,
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true,
//         },
//       });

//       console.log("[AudioControl] Got media stream");
//       mediaStreamRef.current = stream;
//       audioContextRef.current = new AudioContext({
//         sampleRate: 16000,
//       });

//       console.log("[AudioControl] Loading audio worklet...");
//       await audioContextRef.current.audioWorklet.addModule("/worklets/audio-processor.js");
//       const audioWorkletNode = new AudioWorkletNode(
//         audioContextRef.current,
//         "audio-processor",
//         {
//           processorOptions: {
//             bufferSize: 4096,
//           },
//         }
//       );

//       audioWorkletNode.port.onmessage = (event) => {
//         const { pcmData, level } = event.data;
//         setAudioLevel(level);
//         if (geminiWsRef.current && !isPlaying) {
//           console.log("[AudioControl] Sending audio chunk to WebSocket");
//           const b64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData)));
//           geminiWsRef.current.sendMediaChunk(b64Data, "audio/pcm");
//         }
//       };

//       const source = audioContextRef.current.createMediaStreamSource(stream);
//       source.connect(audioWorkletNode);
//       audioWorkletNode.connect(audioContextRef.current.destination);
//       audioWorkletNodeRef.current = audioWorkletNode;

//       console.log("[AudioControl] Audio setup complete");
//       setIsActive(true);
//     } catch (error) {
//       console.error("[AudioControl] Error starting audio:", error);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const stopAudio = () => {
//     console.log("[AudioControl] Stopping audio...");
//     if (mediaStreamRef.current) {
//       mediaStreamRef.current.getTracks().forEach(track => track.stop());
//     }
//     if (audioContextRef.current) {
//       audioContextRef.current.close();
//     }
//     if (geminiWsRef.current) {
//       geminiWsRef.current.disconnect();
//     }
//     setIsActive(false);
//     setIsConnected(false);
//   };

//   return (
//     <div className="flex flex-col items-center space-y-4">
//       <button
//         onClick={isActive ? stopAudio : startAudio}
//         disabled={isProcessing}
//         className={`px-6 py-3 rounded-full text-white font-semibold transition-colors ${
//           isActive
//             ? "bg-red-500 hover:bg-red-600"
//             : "bg-blue-500 hover:bg-blue-600"
//         } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
//       >
//         {isProcessing ? "Processing..." : isActive ? "Stop" : "Start"}
//       </button>

//       {isActive && (
//         <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
//           <div
//             className="h-full bg-blue-500 transition-all duration-100"
//             style={{ width: `${audioLevel}%` }}
//           />
//         </div>
//       )}
//     </div>
//   );
// }
