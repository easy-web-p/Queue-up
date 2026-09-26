import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Typing presence for a chat thread.
 *
 * The previous indicator was a local 2.4 second timer started when the customer
 * pressed send: it showed "the shop is typing" whether or not anyone was, and
 * the merchant's own indicator was never triggered at all. This publishes what
 * is actually happening.
 *
 * Presence lives in `chats/{chatId}/typing/{uid}`, one document per person, so
 * a heartbeat never contends with the thread document that message sends
 * update. Entries carry an expiry rather than relying on a clean disconnect,
 * because a closed tab or a dead battery never gets to send one.
 */

/** A heartbeat is republished at most this often while someone keeps typing. */
const HEARTBEAT_INTERVAL_MS = 2500;

/** Presence older than this is treated as stale and ignored. */
export const TYPING_TTL_MS = 6000;

export interface TypingPresence {
  uid: string;
  displayName: string;
  role: 'customer' | 'merchant';
  expiresAt: number;
}

function typingDoc(chatId: string, uid: string) {
  return doc(db, 'chats', chatId, 'typing', uid);
}

/**
 * Publishes that someone is typing, throttled so a fast typist does not write
 * once per keystroke. Call it on every input change; it decides when to write.
 */
export class TypingPublisher {
  private lastPublishedAt = 0;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly chatId: string,
    private readonly uid: string,
    private readonly displayName: string,
    private readonly role: 'customer' | 'merchant'
  ) {}

  /** Signals a keystroke. Safe to call on every change event. */
  keystroke(): void {
    const now = Date.now();

    if (now - this.lastPublishedAt >= HEARTBEAT_INTERVAL_MS) {
      this.lastPublishedAt = now;
      void this.publish(now + TYPING_TTL_MS);
    }

    // Stop publishing shortly after the last keystroke, so the indicator clears
    // when someone pauses rather than waiting out the full TTL.
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => this.stop(), HEARTBEAT_INTERVAL_MS);
  }

  /** Clears presence immediately: on send, on blur, on unmount. */
  stop(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.lastPublishedAt = 0;
    void deleteDoc(typingDoc(this.chatId, this.uid)).catch(() => {
      // A thread the user can no longer write to, or an offline tab. The entry
      // expires on its own, so there is nothing to recover here.
    });
  }

  private async publish(expiresAt: number): Promise<void> {
    try {
      await setDoc(typingDoc(this.chatId, this.uid), {
        uid: this.uid,
        displayName: this.displayName,
        role: this.role,
        expiresAt
      });
    } catch {
      // Presence is decorative: never let it break sending a message.
    }
  }
}

/**
 * Subscribes to everyone else's typing presence in a thread.
 *
 * @param chatId thread to watch
 * @param selfUid the viewer, whose own presence is filtered out
 * @param onChange receives the list of other people currently typing
 * @returns an unsubscribe function, or a no-op when the thread id is missing
 */
export function subscribeToTyping(
  chatId: string,
  selfUid: string,
  onChange: (typers: TypingPresence[]) => void
): Unsubscribe {
  if (!chatId) return () => {};

  let expiryTimer: ReturnType<typeof setInterval> | null = null;
  let latest: TypingPresence[] = [];

  const emitFresh = () => {
    const now = Date.now();
    onChange(latest.filter((t) => t.expiresAt > now));
  };

  const unsubscribe = onSnapshot(
    collection(db, 'chats', chatId, 'typing'),
    (snapshot) => {
      latest = snapshot.docs
        .map((d) => d.data() as TypingPresence)
        .filter((t) => t && t.uid && t.uid !== selfUid);
      emitFresh();
    },
    () => {
      // Read denied or offline: show nobody rather than a stuck indicator.
      latest = [];
      onChange([]);
    }
  );

  // Firestore only notifies on writes, so an entry that simply expires would
  // otherwise leave the indicator on screen forever.
  expiryTimer = setInterval(emitFresh, 1000);

  return () => {
    if (expiryTimer) clearInterval(expiryTimer);
    unsubscribe();
  };
}
