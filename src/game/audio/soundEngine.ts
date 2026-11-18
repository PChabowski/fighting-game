import type { AudioMixerConfig } from '../types.ts';

type MusicCategory = 'menu' | 'battle';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private tracks: Record<string, HTMLAudioElement> = {};
  private swoshes: HTMLAudioElement[] = [];
  private currentTrack: HTMLAudioElement | null = null;
  private currentCategory: MusicCategory | null = null;
  private mixer: AudioMixerConfig = {
    muted: false,
    master: 0.7,
    music: 0.45,
    sfx: 0.85,
    ambient: 0.75,
  };
  private initialized = false;

  init(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    const trackMap: Record<string, string> = {
      menu_1: '/assets/music/menu_1.ogg',
      menu_2: '/assets/music/menu_2.ogg',
      battle_1: '/assets/music/battle_1.ogg',
      battle_2: '/assets/music/battle_2.ogg',
    };

    for (const [key, src] of Object.entries(trackMap)) {
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = this.getEffectiveMusicVolume();
      this.tracks[key] = audio;
    }

    for (let i = 1; i <= 8; i++) {
      const sfx = new Audio(`/assets/sound-effect/swoshes/swosh-${i}.flac`);
      sfx.volume = this.getEffectiveSfxVolume();
      this.swoshes.push(sfx);
    }
  }

  private getEffectiveMusicVolume(): number {
    if (this.mixer.muted) return 0;
    return Math.max(0, Math.min(1, this.mixer.master * this.mixer.music * 0.55));
  }

  private getEffectiveSfxVolume(): number {
    if (this.mixer.muted) return 0;
    return Math.max(0, Math.min(1, this.mixer.master * this.mixer.sfx));
  }

  private getEffectiveAmbientVolume(): number {
    if (this.mixer.muted) return 0;
    return Math.max(0, Math.min(1, this.mixer.master * this.mixer.ambient));
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  applyMixer(next: AudioMixerConfig): void {
    this.mixer = { ...next };
    if (this.currentTrack) {
      this.currentTrack.volume = this.getEffectiveMusicVolume();
    }
  }

  getMixer(): AudioMixerConfig {
    return { ...this.mixer };
  }

  playMusic(category: MusicCategory): void {
    if (typeof window === 'undefined') return;
    this.init();
    if (this.currentCategory === category && this.currentTrack) {
      this.currentTrack.volume = this.getEffectiveMusicVolume();
      this.currentTrack.play().catch(() => {});
      return;
    }

    const pool = category === 'menu' ? ['menu_1', 'menu_2'] : ['battle_1', 'battle_2'];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const nextTrack = this.tracks[pick];
    if (!nextTrack) return;

    if (this.currentTrack && this.currentTrack !== nextTrack) {
      this.currentTrack.pause();
      this.currentTrack.currentTime = 0;
    }

    this.currentCategory = category;
    this.currentTrack = nextTrack;
    nextTrack.volume = this.getEffectiveMusicVolume();
    nextTrack.play().catch(() => {
      const unlock = () => {
        if (this.currentTrack) {
          this.currentTrack.volume = this.getEffectiveMusicVolume();
          this.currentTrack.play().catch(() => {});
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    });
  }

  playReadyCue(heavy = false): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(heavy ? 320 : 540, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 480 : 760, now + 0.045);
    gain.gain.setValueAtTime(vol * 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playSwing(heavy = false): void {
    if (typeof window === 'undefined') return;
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0 || this.swoshes.length === 0) return;
    const base = this.swoshes[Math.floor(Math.random() * this.swoshes.length)];
    const clone = base.cloneNode() as HTMLAudioElement;
    clone.volume = Math.min(1, vol * (heavy ? 0.95 : 0.72));
    clone.playbackRate = heavy ? 0.85 : 1.15;
    clone.play().catch(() => {});
  }

  playBlock(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.11);
    gain.gain.setValueAtTime(vol * 0.48, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playParry(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const f of [980, 1480, 2220]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 0.36);
      gain.gain.setValueAtTime(vol * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.37);
    }
  }

  playCounterHit(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.22);
    gain.gain.setValueAtTime(vol * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  playHit(heavy = false): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(heavy ? 155 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + (heavy ? 0.16 : 0.1));
    gain.gain.setValueAtTime(vol * (heavy ? 0.42 : 0.28), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.17 : 0.11));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playLadderStep(): void {
    const vol = this.getEffectiveAmbientVolume();
    if (vol <= 0) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.06);
    gain.gain.setValueAtTime(vol * 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playZoneCapture(): void {
    const vol = this.getEffectiveAmbientVolume();
    if (vol <= 0) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 554.37, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(vol * 0.32, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.27);
    });
  }
}

export const soundEngine = new SoundEngine();
