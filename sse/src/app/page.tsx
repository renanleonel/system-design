'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

enum ConnectionStatus {
  Connecting = 'connecting',
  Online = 'online',
  Closed = 'closed',
}

type SsePayload = { randomNumber: number; serverTime: string };

function parseSsePayload(data: string): SsePayload | null {
  // SSE `data` is text, so validate its JSON shape before updating the UI.
  const payload: unknown = JSON.parse(data);

  if (
    payload !== null &&
    typeof payload === 'object' &&
    'randomNumber' in payload &&
    'serverTime' in payload &&
    typeof payload.randomNumber === 'number' &&
    typeof payload.serverTime === 'string'
  ) {
    return { randomNumber: payload.randomNumber, serverTime: payload.serverTime };
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
  const [latestEvent, setLatestEvent] = useState<SsePayload | null>(null);

  useEffect(() => {
    // EventSource makes one long-lived GET request and receives each server event on it.
    const source = new EventSource('/api/events');

    // These callbacks run when the browser receives connection and message events.
    source.onopen = () => setStatus(ConnectionStatus.Online);
    source.onmessage = ({ data }) => {
      const payload = parseSsePayload(data);
      if (payload) setLatestEvent(payload);
    };

    // EventSource retries dropped connections automatically; readyState tells us
    // whether it is reconnecting or has been explicitly closed.
    source.onerror = () =>
      setStatus(
        source.readyState === EventSource.CLOSED
          ? ConnectionStatus.Closed
          : ConnectionStatus.Connecting,
      );

    // Close the persistent request when React unmounts this component.
    return () => source.close();
  }, []);

  return (
    <main className='min-h-screen bg-page px-4 py-18 font-sans text-ink sm:px-8'>
      <div className='mx-auto w-full max-w-180'>
        <section
          className='overflow-hidden rounded-card border border-line bg-paper shadow-card'
          aria-labelledby='stream-heading'>
          <div className='flex items-center justify-between gap-5 border-b border-line px-6.5 py-6.25'>
            <div>
              <p className='mb-2.5 text-xs font-semibold tracking-widest text-brand uppercase'>
                Live connection
              </p>
            </div>
            <p className='flex items-center text-lg font-semibold capitalize' aria-live='polite'>
              <span
                className={cn('mr-2 inline-block size-2.5 rounded-full', statusDotClass[status])}
              />
              {status}
            </p>
          </div>

          <div className='mx-6.5 mt-4.5 rounded-code bg-ink px-4 py-3 font-mono text-sm text-slate-200'>
            <span className='text-blue-300'>const</span> stream = new EventSource(
            <strong className='font-medium text-amber-300'>&quot;/api/events&quot;</strong>)
          </div>

          <div
            className='grid min-h-78.75 place-content-center justify-items-center gap-3 p-8 text-center'
            aria-live='polite'>
            <span className='text-sm text-slate-500'>Latest random number</span>
            <strong className='text-display leading-display font-semibold tracking-display text-brand'>
              {latestEvent?.randomNumber ?? '—'}
            </strong>
            <time className='text-sm text-slate-500'>
              {latestEvent
                ? `Received at ${new Date(latestEvent.serverTime).toLocaleTimeString()}`
                : 'Waiting for the server…'}
            </time>

            <p className='mt-5.5 text-sm leading-relaxed text-slate-500'>
              The server sends a new event every two seconds. Refresh the page to open a new SSE
              connection.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
