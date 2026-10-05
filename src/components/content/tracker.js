/*
  A student's learning events, gathered while a meeting's content is open and
  sent in batches (backend a9ed505, `POST /tracking/events`; owner, 2026-10-04).

  What counts, decided with the owner:
  - opened: an item seen - half of it on screen - for the first time (not a FILE:
    the server records a file's download itself, and `content.opened` would
    complete a FILE on a glance);
  - text_read_to_end: a TEXT's end on screen once the text has been on screen
    long enough to read it (`readingMs`);
  - link_clicked: a LINK, or another site's VIDEO, followed;
  - video_progressed: a YouTube video reaching a tenth not reached before - the
    server keeps it per 10% (tracking.record.js), so nothing finer is sent.

  Each is sent once per content per drawer. A batch is at most 50 (the schema's
  cap). One that fails on the network or a 5xx goes back in the queue for the
  next flush; a 4xx would fail again unchanged and is dropped. Per-event refusals
  (a stale time, content gone) come back in a 200 and are dropped too: there is
  nothing to correct.

  Each accepted event's answer says whether its content is now complete
  (`completed`, backend b0f3307); `onProgress(contentId, { completed })` hears it,
  so a tick appears without reading the list again. A FILE is completed by the
  server when it is fetched, so `fileFetched` reports that one locally.
*/

export const MAX_BATCH = 50;

/* Time to read a text: about a second per 50 words, never under 3 s or over a minute. */
export function readingMs(html) {
  const text = String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(60_000, Math.max(3_000, Math.round((words / 50) * 1000)));
}

/* The tenth of a video reached, 0 to 10, as the server counts it (tracking.record.js tenthOf). */
export const tenthOf = (position, duration) => Math.min(10, Math.floor((position / duration) * 10));

/**
 * @param {{ send: (events: object[]) => Promise<unknown>, now?: () => Date,
 *          onProgress?: (contentId: string, update: { completed: boolean }) => void }} deps
 */
export function createTracker({ send, now = () => new Date(), onProgress = null }) {
  const queue = [];
  const once = new Set();
  const tenths = new Map();
  let inFlight = null;
  let listener = onProgress;
  const notify = (contentId, update) => listener?.(contentId, update);

  const push = (event) => queue.push({ ...event, occurredAt: now().toISOString() });

  const pushOnce = (verb, contentId) => {
    const key = `${verb}:${contentId}`;
    if (once.has(key)) return false;
    once.add(key);
    push({ verb, contentId });
    return true;
  };

  async function flushNow(options) {
    while (queue.length > 0) {
      const batch = queue.splice(0, MAX_BATCH);
      let answer;
      try {
        answer = await send(batch, options);
      } catch (err) {
        const status = err?.status ?? 0;
        if (status >= 400 && status < 500) continue;
        queue.unshift(...batch);
        return;
      }
      /* An accepted event means the content has a progress row: opened at least. */
      for (const result of answer?.results ?? []) {
        const event = batch[result.index];
        if (result.ok && event) notify(event.contentId, { completed: Boolean(result.completed) });
      }
    }
  }

  return {
    opened: (contentId) => pushOnce('content.opened', contentId),
    readToEnd: (contentId) => pushOnce('content.text_read_to_end', contentId),
    linkClicked: (contentId) => pushOnce('content.link_clicked', contentId),

    /** A FILE fetched (opened, downloaded or previewed): the server completed it on the fetch. */
    fileFetched: (contentId) => notify(contentId, { completed: true }),

    /** Who hears onProgress from now on; returns the way to stop. */
    listen(fn) {
      listener = fn;
      return () => {
        if (listener === fn) listener = null;
      };
    },

    /** A YouTube player's position; queued only when it reaches a new tenth. */
    video(contentId, position, duration) {
      if (!(duration > 0) || duration > 24 * 60 * 60 || !(position >= 0)) return false;
      const reached = tenthOf(position, duration);
      if (reached <= (tenths.get(contentId) ?? 0)) return false;
      tenths.set(contentId, reached);
      push({ verb: 'content.video_progressed', contentId, position, duration });
      return true;
    },

    /** Sends what is queued; one flush at a time. */
    flush(options = {}) {
      if (!inFlight) inFlight = flushNow(options).finally(() => (inFlight = null));
      return inFlight;
    },

    pending: () => queue.length,
  };
}
