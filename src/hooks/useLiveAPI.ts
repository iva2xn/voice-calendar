import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";

export interface Event {
  id?: number;
  title: string;
  start_time: string;
  end_time?: string;
  description?: string;
  notified?: number;
}

export function useLiveAPI(onEventAdded: () => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);

  const playNextInQueue = useCallback(() => {
    if (audioQueue.current.length === 0 || isPlayingRef.current || !audioContextRef.current) {
      return;
    }

    isPlayingRef.current = true;
    const pcmData = audioQueue.current.shift()!;
    
    const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextInQueue();
    };
    source.start();
  }, []);

  const connect = useCallback(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are a helpful calendar assistant. 
          The current time is ${new Date().toLocaleString()}. 
          You can help users schedule events and check their existing schedule. 
          When a user wants to schedule something, use the add_calendar_event tool.
          When a user asks what's on their calendar or asks about their schedule, use the list_calendar_events tool.
          Always confirm the details before scheduling.`,
          tools: [{
            functionDeclarations: [
              {
                name: "add_calendar_event",
                description: "Add an event to the user's calendar",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "The title of the event" },
                    start_time: { type: Type.STRING, description: "The start time in ISO format" },
                    end_time: { type: Type.STRING, description: "The end time in ISO format (optional)" },
                    description: { type: Type.STRING, description: "A brief description (optional)" }
                  },
                  required: ["title", "start_time"]
                }
              },
              {
                name: "list_calendar_events",
                description: "List all events currently on the user's calendar",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const binaryString = atob(part.inlineData.data);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const pcmData = new Int16Array(bytes.buffer);
                  audioQueue.current.push(pcmData);
                  playNextInQueue();
                }
              }
            }

            if (message.toolCall) {
              for (const call of message.toolCall.functionCalls) {
                if (call.name === "add_calendar_event") {
                  const args = call.args as any;
                  try {
                    const apiUrl = `${window.location.origin}/api/events`;
                    const res = await fetch(apiUrl, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(args),
                    });
                    
                    if (res.ok) {
                      onEventAdded();
                      
                      sessionRef.current?.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { success: true, message: "Event scheduled successfully" }
                        }]
                      });
                    } else {
                      sessionRef.current?.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { success: false, error: "Failed to schedule event on server" }
                        }]
                      });
                    }
                  } catch (e) {
                    sessionRef.current?.sendToolResponse({
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: { success: false, error: "Network error while scheduling event" }
                      }]
                    });
                  }
                } else if (call.name === "list_calendar_events") {
                  try {
                    const apiUrl = `${window.location.origin}/api/events`;
                    const res = await fetch(apiUrl);
                    if (res.ok) {
                      const events = await res.json();
                      sessionRef.current?.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { success: true, events: events }
                        }]
                      });
                    } else {
                      sessionRef.current?.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { success: false, error: "Failed to fetch events from server" }
                        }]
                      });
                    }
                  } catch (e) {
                    sessionRef.current?.sendToolResponse({
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: { success: false, error: "Network error while fetching events" }
                      }]
                    });
                  }
                }
              }
            }

            if (message.serverContent?.interrupted) {
              audioQueue.current = [];
              isPlayingRef.current = false;
            }
          },
          onclose: () => {
            setIsConnected(false);
            setIsRecording(false);
          },
          onerror: (err) => {
            setError("Connection error. Please try again.");
          }
        }
      });

      sessionRef.current = session;
    } catch (err) {
      setError("Failed to initialize AI session.");
    }
  }, [onEventAdded, playNextInQueue]);

  const startRecording = useCallback(async () => {
    if (!sessionRef.current) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        sessionRef.current?.sendRealtimeInput({
          media: { data: base64Data, mimeType: "audio/pcm;rate=16000" }
        });
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      setIsRecording(true);
    } catch (err) {
      setError("Microphone access denied.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      sessionRef.current?.close();
      stopRecording();
    };
  }, [connect, stopRecording]);

  return { isConnected, isRecording, startRecording, stopRecording, error };
}
