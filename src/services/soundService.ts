// Web Audio and Speech Synthesis service for QueueUp Digital Buzzer & KDS Chimes

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    console.warn('AudioContext not available:', err);
    return null;
  }
}

/**
 * Plays a pleasant restaurant bell / chime (3-tone ascending chord)
 */
export function playChimeSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const startTime = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.12);

      gain.gain.setValueAtTime(0.001, startTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.28, startTime + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * 0.12 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + idx * 0.12);
      osc.stop(startTime + idx * 0.12 + 0.85);
    });
  } catch (err) {
    console.warn('Failed to play chime:', err);
  }
}

/**
 * Plays an alert beep/buzzer for kitchen notifications
 */
export function playUrgentBuzzer(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const startTime = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, startTime);
    osc.frequency.setValueAtTime(440, startTime + 0.2);

    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.5);
  } catch (err) {
    console.warn('Failed to play buzzer:', err);
  }
}

/**
 * Announces queue number in Thai speech if supported
 */
export function announceQueueCall(queueNumber: string, storeName?: string): void {
  // First play the melodic chime
  playChimeSound();

  // Then speak if SpeechSynthesis is supported
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel(); // cancel any ongoing speech

      const text = storeName 
        ? `ขอเชิญคิว ${queueNumber} รับอาหารที่ร้าน ${storeName} ค่ะ`
        : `ขอเชิญหมายเลขคิว ${queueNumber} รับอาหารที่เคาน์เตอร์ค่ะ`;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 1.0;
      utterance.pitch = 1.1;

      // Small delay after the chime
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 500);
    } catch (err) {
      console.warn('Speech synthesis failed:', err);
    }
  }
}

/**
 * Request user permission for HTML5 Web / OS Push notifications
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.warn('Failed to request notification permission:', err);
      return 'denied';
    }
  }
  return 'denied';
}

/**
 * Check current browser notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission;
  }
  return 'denied';
}

/**
 * Dispatches an OS / Browser level notification banner even when tab is backgrounded
 */
export function sendBrowserNotification(title: string, options?: NotificationOptions): Notification | null {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notifOptions: NotificationOptions & { renotify?: boolean } = {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'queue-call-alert',
        renotify: true,
        ...options
      };
      const notif = new Notification(title, notifOptions as NotificationOptions);

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      return notif;
    } catch (err) {
      console.warn('Failed to create browser notification:', err);
      return null;
    }
  }
  return null;
}
