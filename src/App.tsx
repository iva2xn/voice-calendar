import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveAPI } from './hooks/useLiveAPI';
import { Calendar } from './components/Calendar';

export default function App() {
  const [events, setEvents] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);

  const fetchEvents = useCallback(async () => {
    const res = await fetch('/api/events');
    const data = await res.json();
    setEvents(data);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const { isConnected, isRecording, startRecording, stopRecording, error } = useLiveAPI(fetchEvents);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-900/20 blur-[120px]" />
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif italic mb-2 tracking-tight">mic test</h1>
        </div>

        <div className="relative group">
          <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 ${
            isRecording ? 'bg-red-500/20 scale-110' : 'bg-zinc-800/0 scale-100'
          }`} />
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={!isConnected}
            className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
              !isConnected 
                ? 'bg-zinc-900 border-zinc-800 cursor-not-allowed opacity-50' 
                : isRecording 
                  ? 'bg-red-500/10 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' 
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {isConnected ? (
              isRecording ? (
                <Mic className="w-10 h-10 text-red-500 animate-pulse" />
              ) : (
                <Mic className="w-10 h-10 text-zinc-400" />
              )
            ) : (
              <Loader2 className="w-10 h-10 text-zinc-700 animate-spin" />
            )}
          </motion.button>

          <div className="mt-8 flex flex-col items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">
              {isConnected ? (isRecording ? "Recording..." : "") : "Connecting..."}
            </span>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs mt-2 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={() => setShowCalendar(!showCalendar)}
          className="mt-12 text-zinc-500 hover:text-zinc-300 text-xs font-mono uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          {showCalendar ? "Hide Schedule" : "View Schedule"}
          <div className={`w-1.5 h-1.5 rounded-full ${events.length > 0 ? 'bg-white animate-pulse' : 'bg-zinc-800'}`} />
        </button>

        <AnimatePresence>
          {showCalendar && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full"
            >
              <Calendar events={events} onRefresh={fetchEvents} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
