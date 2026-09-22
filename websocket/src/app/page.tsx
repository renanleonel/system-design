'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

enum ConnectionStatus {
  Connecting = 'connecting',
  Online = 'online',
  Closed = 'closed',
}

type RandomNumberMessage = {
  type: 'random-number';
  randomNumber: number;
  serverTime: string;
};

type FeedbackMessage = {
  type: 'acknowledgement' | 'error';
  message: string;
  serverTime: string;
};

type ServerMessage = RandomNumberMessage | FeedbackMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null;

  try {
    const payload: unknown = JSON.parse(data);

    if (
      isRecord(payload) &&
      payload.type === 'random-number' &&
      typeof payload.randomNumber === 'number' &&
      typeof payload.serverTime === 'string'
    ) {
      return {
        type: 'random-number',
        randomNumber: payload.randomNumber,
        serverTime: payload.serverTime,
      };
    }

    if (
      isRecord(payload) &&
      (payload.type === 'acknowledgement' || payload.type === 'error') &&
      typeof payload.message === 'string' &&
      typeof payload.serverTime === 'string'
    ) {
      return { type: payload.type, message: payload.message, serverTime: payload.serverTime };
    }
  } catch {
    return null;
  }

  return null;
}

const statusDotClass: Record<ConnectionStatus, string> = {
  [ConnectionStatus.Connecting]: 'bg-amber-600',
  [ConnectionStatus.Online]: 'bg-green-600 shadow-[0_0_0_4px_#dcfce7]',
  [ConnectionStatus.Closed]: 'bg-slate-400',
};

export default function Home() {
  const [status, setStatus] = useState(ConnectionStatus.Connecting);
  const [latestEvent, setLatestEvent] = useState<RandomNumberMessage | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [message, setMessage] = useState('Hello from the browser');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    socketRef.current = socket;

    socket.onopen = () => setStatus(ConnectionStatus.Online);
    socket.onmessage = ({ data }) => {
      const payload = parseServerMessage(data);
      if (!payload) return;

      if (payload.type === 'random-number') setLatestEvent(payload);
      else setFeedback(payload);
    };
    socket.onclose = () => setStatus(ConnectionStatus.Closed);
    socket.onerror = () => setStatus(ConnectionStatus.Closed);

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, []);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = message.trim();
    const socket = socketRef.current;
    if (!text || socket?.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({ type: 'message', message: text }));
  }

  return (
    <main className='min-h-screen bg-page px-4 py-18 font-sans text-ink sm:px-8'>
      <div className='mx-auto w-full max-w-180'>
        <section
          className='overflow-hidden rounded-card border border-line bg-paper shadow-card'
          aria-labelledby='stream-heading'>
          <div className='flex items-center justify-between gap-5 border-b border-line px-6.5 py-6.25'>
            <p className='mb-2.5 text-xs font-semibold tracking-widest text-brand uppercase'>
              Live connection
            </p>
            <p className='flex items-center text-lg font-semibold capitalize' aria-live='polite'>
              <span className={cn('mr-2 inline-block size-2.5 rounded-full', statusDotClass[status])} />
              {status}
            </p>
          </div>

          <div className='mx-6.5 mt-4.5 rounded-code bg-ink px-4 py-3 font-mono text-sm text-slate-200'>
            <span className='text-blue-300'>const</span> socket = new WebSocket(
            <strong className='font-medium text-amber-300'>&quot;ws://localhost:3000/api/ws&quot;</strong>)
          </div>

          <form className='mx-6.5 mt-4.5 grid gap-2.5 sm:grid-cols-[1fr_auto]' onSubmit={sendMessage}>
            <label className='sr-only' htmlFor='websocket-message'>
              Message for the server
            </label>
            <input
              className='min-w-0 rounded-code border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-3 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100'
              disabled={status !== ConnectionStatus.Online}
              id='websocket-message'
              maxLength={80}
              onChange={(event) => setMessage(event.target.value)}
              value={message}
            />
            <button
              className='rounded-code bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-3 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300'
              disabled={status !== ConnectionStatus.Online || message.trim().length === 0}
              type='submit'>
              Send to server
            </button>
          </form>

          <div
            className='mx-6.5 mt-3 rounded-code border border-line bg-blue-50 px-3.5 py-3 text-left text-sm'
            aria-live='polite'>
            <span className='font-semibold text-brand'>Browser → server → browser</span>
            <p className={cn('mt-1', feedback?.type === 'error' ? 'text-red-700' : 'text-slate-600')}>
              {feedback?.message ?? 'Send a message to receive an acknowledgement.'}
            </p>
          </div>

          <div className='grid min-h-64 place-content-center justify-items-center gap-3 p-8 text-center' aria-live='polite'>
            <span className='text-sm text-slate-500'>Latest random number</span>
            <strong className='text-display leading-display font-semibold tracking-display text-brand'>
              {latestEvent?.randomNumber ?? '—'}
            </strong>
            <time className='text-sm text-slate-500'>
              {latestEvent ? `Received at ${new Date(latestEvent.serverTime).toLocaleTimeString()}` : 'Waiting for the server…'}
            </time>
            <p className='mt-5.5 text-sm leading-relaxed text-slate-500'>
              The server sends a new message every second. Refresh the page to open a new WebSocket connection.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
