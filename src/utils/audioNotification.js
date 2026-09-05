/**
 * 🔔 WEB AUDIO API SOUND NOTIFICATION UTILITY
 * Pure Synthesized Audio - Zero external MP3 downloads, 0ms latency, 100% offline-ready.
 */

class AudioNotificationService {
  constructor() {
    this.ctx = null;
  }

  getAudioContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // 🔓 Explicit Browser Autoplay Unlock via User Gesture (ปุ่มเริ่มกะครัว / เปิดเสียง)
  async unlockAudio() {
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
      return ctx ? ctx.state === 'running' : false;
    } catch (err) {
      console.warn('Audio unlock warning:', err);
      return false;
    }
  }

  isUnlocked() {
    return !!(this.ctx && this.ctx.state === 'running');
  }

  // 🍜 1. Order Ready Chime (เสียงแจ้งเตือนอาหารปรุงเสร็จ พร้อมรับประทาน)
  playOrderReadyChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6 Arpeggio

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.65);
      });
    } catch (err) {
      console.warn('Audio notification warning:', err);
    }
  }

  // 👨‍🍳 2. New Order Kitchen Alert (เสียงกระดิ่งออเดอร์ใหม่เข้าครัว KDS)
  playNewOrderAlert() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [880.00, 1046.50]; // A5, C6 Bell

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0, now + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.4, now + idx * 0.15 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.85);
      });
    } catch (err) {
      console.warn('Audio notification warning:', err);
    }
  }

  // 🎟️ 3. Success / Queue Issued Sound (เสียงออกตั๋วคิวสำเร็จ)
  playQueueIssuedSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch (err) {
      console.warn('Audio notification warning:', err);
    }
  }
}

export const soundManager = new AudioNotificationService();
export default soundManager;
