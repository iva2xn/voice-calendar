import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Trash2, Bell } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface CalendarEvent {
  id: number;
  title: string;
  start_time: string;
  end_time?: string;
  description?: string;
  notified: number;
}

export function Calendar({ events, onRefresh }: { events: CalendarEvent[], onRefresh: () => void }) {
  const [notifiedIds, setNotifiedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const checkNotifications = () => {
      const now = new Date();
      events.forEach(event => {
        const startTime = parseISO(event.start_time);
        if (!event.notified && !notifiedIds.has(event.id) && isAfter(now, startTime)) {
          if (Notification.permission === "granted") {
            new Notification(`Calendar: ${event.title}`, {
              body: event.description || "Event starting now!",
              icon: "/favicon.ico"
            });
            
            fetch(`/api/events/${event.id}/notified`, { method: 'PATCH' });
            setNotifiedIds(prev => new Set(prev).add(event.id));
          }
        }
      });
    };

    const interval = setInterval(checkNotifications, 10000);
    return () => clearInterval(interval);
  }, [events, notifiedIds]);

  const deleteEvent = async (id: number) => {
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const requestPermission = () => {
    Notification.requestPermission();
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif italic text-zinc-100 flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-zinc-400" />
          Your Schedule
        </h2>
        {Notification.permission !== "granted" && (
          <button 
            onClick={requestPermission}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors"
          >
            <Bell className="w-3 h-3" />
            Enable Notifications
          </button>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {events.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl text-zinc-500"
            >
              No events scheduled yet. Talk to the assistant to add some!
            </motion.div>
          ) : (
            events.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl group hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-zinc-100">{event.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(event.start_time), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    {event.description && (
                      <p className="mt-2 text-sm text-zinc-500 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                  <button 
                    onClick={() => deleteEvent(event.id)}
                    className="p-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
