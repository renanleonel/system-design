// An SSE response is a live stream, never a cacheable route result.
export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

function formatEvent(data: unknown, id: number) {
  // SSE is text: fields use newlines and a blank line dispatches the event.
  return `id: ${id}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  let eventId = 0;
  let interval: ReturnType<typeof setInterval> | undefined;

  // Next returns this stream as the HTTP response body and keeps it open.
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        eventId += 1;

        // Every call pushes a fresh event through the already-open connection.
        controller.enqueue(
          encoder.encode(
            formatEvent(
              {
                randomNumber: Math.floor(Math.random() * 100) + 1,
                serverTime: new Date().toISOString(),
              },
              eventId,
            ),
          ),
        );
      };

      // Suggest a three-second automatic-retry delay to EventSource.
      controller.enqueue(encoder.encode('retry: 3000\n\n'));

      // Send once immediately, then continue emitting one event per second.
      send();
      interval = setInterval(send, 1000);
    },

    cancel() {
      // Closing EventSource cancels the stream, so stop the server timer too.
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      // This makes browsers parse the response body as Server-Sent Events.
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
