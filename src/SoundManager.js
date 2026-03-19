// Sound effects and BGM management
import { clamp, DEFAULT_SETTINGS } from './config.js';

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.seGain = null;
    this.bgmGain = null;
    this.bgmNodes = [];
    this.bgmStarted = false;
    this.seVolume = DEFAULT_SETTINGS.seVolume;
    this.bgmVolume = DEFAULT_SETTINGS.bgmVolume;
  }

  async ensureStarted() {
    if (!window.AudioContext && !window.webkitAudioContext) return;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.45;

      this.seGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.seGain.connect(this.masterGain);
      this.bgmGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.setSEVolume(this.seVolume);
      this.setBGMVolume(this.bgmVolume);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.startBGM();
  }

  _playSweep({ from, to, duration, type = 'square', volume = 0.2 }) {
    if (!this.ctx || !this.seGain || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  startBGM() {
    if (!this.ctx || !this.bgmGain || this.bgmStarted) return;

    const now = this.ctx.currentTime;
    const padA = this.ctx.createOscillator();
    const padB = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();

    padA.type = 'sine';
    padB.type = 'triangle';
    padA.frequency.setValueAtTime(82.41, now);
    padB.frequency.setValueAtTime(123.47, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.Q.value = 0.7;

    padA.connect(filter);
    padB.connect(filter);
    filter.connect(this.bgmGain);

    padA.start(now);
    padB.start(now);

    this.bgmNodes = [padA, padB, filter];
    this.bgmStarted = true;
  }

  setSEVolume(volume) {
    this.seVolume = clamp(Number(volume) || 0, 0, 1);
    if (!this.seGain || !this.ctx) return;
    this.seGain.gain.setTargetAtTime(this.seVolume, this.ctx.currentTime, 0.02);
  }

  setBGMVolume(volume) {
    this.bgmVolume = clamp(Number(volume) || 0, 0, 1);
    if (!this.bgmGain || !this.ctx) return;
    this.bgmGain.gain.setTargetAtTime(this.bgmVolume * 0.2, this.ctx.currentTime, 0.04);
  }

  playBreak() {
    this._playSweep({ from: 170, to: 75, duration: 0.08, type: 'square', volume: 0.12 });
    this._playSweep({ from: 130, to: 55, duration: 0.1, type: 'triangle', volume: 0.06 });
  }

  playPlace() {
    this._playSweep({ from: 200, to: 250, duration: 0.06, type: 'square', volume: 0.1 });
  }

  playJump() {
    this._playSweep({ from: 220, to: 360, duration: 0.09, type: 'square', volume: 0.12 });
  }

  playLand(intensity = 1) {
    const clamped = Math.min(Math.max(intensity, 0.5), 2);
    this._playSweep({
      from: 140,
      to: 85,
      duration: 0.07,
      type: 'triangle',
      volume: 0.08 * clamped,
    });
  }

  playError() {
    this._playSweep({ from: 180, to: 120, duration: 0.06, type: 'sawtooth', volume: 0.09 });
  }
}
