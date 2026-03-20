// サウンドエフェクト・BGM管理（昼夜別BGM・戦闘BGM・モブ音声対応）
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

    // BGM状態管理
    this._bgmMode = 'day'; // 'day' | 'night' | 'combat'
    this._bgmTargetMode = 'day';
    this._bgmTransitionTimer = null;
    this._schedulers = [];
    this._bgmPhase = 0; // 音楽の位相（コード進行制御用）
    this._combatTimeout = null;
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

  // ---- 汎用ヘルパー ----

  _playSweep({ from, to, duration, type = 'square', volume = 0.2, dest = null }) {
    if (!this.ctx || !this.seGain || this.ctx.state !== 'running') return;
    const target = dest || this.seGain;
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
    gain.connect(target);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // ノイズバーストを鳴らす（打撃音・爆発音に使用）
  _playNoise({ duration, volume = 0.1, filterFreq = 800, filterQ = 1 }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const bufSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.seGain);
    src.start(now);
    src.stop(now + duration + 0.01);
  }

  // 和音を鳴らす（BGMに使用）
  _playChord({ freqs, type = 'sine', volume = 0.08, duration = 1.5, attack = 0.15, release = 0.4, dest }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const target = dest || this.bgmGain;
    const now = this.ctx.currentTime;

    freqs.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.setValueAtTime(volume, now + duration - release);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(target);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    });
  }

  // ---- BGM システム ----

  startBGM() {
    if (!this.ctx || !this.bgmGain || this.bgmStarted) return;
    this.bgmStarted = true;
    this._startDayBGM();
  }

  // 昼間BGM: 明るく牧歌的なアルペジオ
  _startDayBGM() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this._stopCurrentBGM();
    this._bgmMode = 'day';

    // Cメジャースケールのコード進行: C - Am - F - G
    const chords = [
      [261.63, 329.63, 392.00],  // C major (C4, E4, G4)
      [220.00, 261.63, 329.63],  // A minor (A3, C4, E4)
      [174.61, 220.00, 261.63],  // F major (F3, A3, C4)
      [196.00, 246.94, 293.66],  // G major (G3, B3, D4)
    ];

    // ローパスフィルター（柔らかい音色）
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.5;
    filter.connect(this.bgmGain);

    // ドローン（持続低音）
    const droneA = this.ctx.createOscillator();
    const droneB = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    droneA.type = 'sine';
    droneB.type = 'triangle';
    droneA.frequency.value = 65.41; // C2
    droneB.frequency.value = 98.00; // G2
    droneGain.gain.value = 0.06;
    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneGain.connect(filter);
    droneA.start();
    droneB.start();

    this.bgmNodes = [droneA, droneB, droneGain, filter];

    // コード進行スケジューラ
    const chordDuration = 4.0; // 4秒ごとにコード切り替え
    let phase = 0;

    const scheduleChord = () => {
      if (this._bgmMode !== 'day') return;
      const chord = chords[phase % chords.length];

      // メロディー音（1オクターブ上）
      this._playChord({
        freqs: chord.map(f => f * 2),
        type: 'sine',
        volume: 0.04,
        duration: chordDuration,
        attack: 0.3,
        release: 0.8,
        dest: filter,
      });

      // 和音（柔らかいパッド音）
      this._playChord({
        freqs: chord,
        type: 'triangle',
        volume: 0.025,
        duration: chordDuration,
        attack: 0.5,
        release: 1.2,
        dest: filter,
      });

      phase++;
      const timerId = setTimeout(scheduleChord, chordDuration * 1000 - 200);
      this._schedulers.push(timerId);
    };

    scheduleChord();
  }

  // 夜間BGM: 不気味で緊張感のある音楽
  _startNightBGM() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this._stopCurrentBGM();
    this._bgmMode = 'night';

    // 夜のドローン（低い不気味な音）
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 2.0;
    filter.connect(this.bgmGain);

    const drone1 = this.ctx.createOscillator();
    const drone2 = this.ctx.createOscillator();
    const drone3 = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();

    drone1.type = 'sawtooth';
    drone2.type = 'square';
    drone3.type = 'sine';
    drone1.frequency.value = 55.00; // A1
    drone2.frequency.value = 55.00 * 1.01; // わずかにデチューン
    drone3.frequency.value = 82.41; // E2

    droneGain.gain.value = 0.035;
    [drone1, drone2, drone3].forEach(d => d.connect(droneGain));
    droneGain.connect(filter);
    [drone1, drone2, drone3].forEach(d => d.start());

    // LFOで揺れる不気味な効果
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12; // ゆっくり揺れる
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.bgmNodes = [drone1, drone2, drone3, droneGain, filter, lfo, lfoGain];

    // 不気味なアルペジオ（短調）
    const minorChords = [
      [110.00, 130.81, 164.81], // Am (A2, C3, E3)
      [98.00, 116.54, 146.83],  // Gm (G2, Bb2, D3)
      [92.50, 110.00, 138.59],  // F#dim
      [82.41, 98.00, 123.47],   // Em
    ];

    let phase = 0;
    const scheduleNightChord = () => {
      if (this._bgmMode !== 'night') return;
      const chord = minorChords[phase % minorChords.length];

      this._playChord({
        freqs: chord,
        type: 'sawtooth',
        volume: 0.02,
        duration: 5.0,
        attack: 0.8,
        release: 1.5,
        dest: filter,
      });

      phase++;
      const timerId = setTimeout(scheduleNightChord, 4800);
      this._schedulers.push(timerId);
    };

    scheduleNightChord();
  }

  // 戦闘BGM: 緊張感のある打撃的な音楽
  _startCombatBGM() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this._stopCurrentBGM();
    this._bgmMode = 'combat';

    // 戦闘のパルス音（緊張感）
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 1.5;
    filter.connect(this.bgmGain);

    // 緊迫したドローン
    const drone1 = this.ctx.createOscillator();
    const drone2 = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    drone1.type = 'sawtooth';
    drone2.type = 'square';
    drone1.frequency.value = 73.42; // D2
    drone2.frequency.value = 73.42 * 1.005;
    droneGain.gain.value = 0.04;
    [drone1, drone2].forEach(d => { d.connect(droneGain); d.start(); });
    droneGain.connect(filter);

    this.bgmNodes = [drone1, drone2, droneGain, filter];

    // パルスリズム（16分音符感覚）
    let step = 0;
    const bpm = 140;
    const interval = (60 / bpm) * 1000 * 0.5;

    const schedulePulse = () => {
      if (this._bgmMode !== 'combat') return;

      // 4ステップごとに強調
      if (step % 4 === 0) {
        this._playSweep({ from: 180, to: 90, duration: 0.15, type: 'sawtooth', volume: 0.03, dest: this.bgmGain });
      } else if (step % 2 === 0) {
        this._playSweep({ from: 140, to: 110, duration: 0.08, type: 'square', volume: 0.015, dest: this.bgmGain });
      }

      step++;
      const timerId = setTimeout(schedulePulse, interval);
      this._schedulers.push(timerId);
    };

    schedulePulse();
  }

  _stopCurrentBGM() {
    // スケジューラーをクリア
    this._schedulers.forEach(id => clearTimeout(id));
    this._schedulers = [];

    // オシレーターを停止
    const now = this.ctx ? this.ctx.currentTime : 0;
    this.bgmNodes.forEach(node => {
      try {
        if (node.stop) {
          node.gain && (node.gain.value = 0);
          node.stop(now + 0.1);
        } else if (node.disconnect) {
          node.disconnect();
        }
      } catch (_) { /* ignore */ }
    });
    this.bgmNodes = [];
  }

  // BGMモードを変更（フェードインアウト付き）
  setBGMMode(mode) {
    if (!this.ctx || !this.bgmStarted) return;
    if (this._bgmMode === mode) return;

    const now = this.ctx.currentTime;
    // フェードアウト
    this.bgmGain.gain.setTargetAtTime(0.0001, now, 0.5);

    setTimeout(() => {
      if (!this.ctx) return;
      this.bgmGain.gain.setTargetAtTime(this.bgmVolume * 0.2, this.ctx.currentTime, 0.8);
      if (mode === 'day') this._startDayBGM();
      else if (mode === 'night') this._startNightBGM();
      else if (mode === 'combat') this._startCombatBGM();
    }, 800);
  }

  // 戦闘中であることを通知（一定時間後に元のBGMに戻る）
  notifyCombat() {
    if (!this.bgmStarted) return;

    // 戦闘BGM以外の状態だった場合、元のモードを記憶
    if (this._bgmMode !== 'combat') {
      this._combatPrevMode = this._bgmMode;
      this.setBGMMode('combat');
    }

    // タイムアウトをリセット（戦闘が続く限り戦闘BGMを維持）
    if (this._combatTimeout) clearTimeout(this._combatTimeout);
    this._combatTimeout = setTimeout(() => {
      this._combatTimeout = null;
      // 戦闘終了後は元のBGMに戻る
      this.setBGMMode(this._combatPrevMode || 'day');
    }, 8000); // 8秒間戦闘BGM
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

  // ---- ブロック効果音 ----

  playBreak() {
    this._playSweep({ from: 170, to: 75, duration: 0.08, type: 'square', volume: 0.12 });
    this._playSweep({ from: 130, to: 55, duration: 0.1, type: 'triangle', volume: 0.06 });
    this._playNoise({ duration: 0.06, volume: 0.04, filterFreq: 600, filterQ: 0.8 });
  }

  playPlace() {
    this._playSweep({ from: 200, to: 250, duration: 0.06, type: 'square', volume: 0.1 });
    this._playNoise({ duration: 0.04, volume: 0.03, filterFreq: 400, filterQ: 1 });
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
    this._playNoise({ duration: 0.05, volume: 0.04 * clamped, filterFreq: 200, filterQ: 0.5 });
  }

  playError() {
    this._playSweep({ from: 180, to: 120, duration: 0.06, type: 'sawtooth', volume: 0.09 });
  }

  // ---- 食事効果音 ----

  playEat() {
    // 食べる音（モグモグ感）
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this._playNoise({ duration: 0.04, volume: 0.05, filterFreq: 500 + Math.random() * 300, filterQ: 2 });
      }, i * 80);
    }
    // 回復音（高めの心地よいビープ）
    setTimeout(() => {
      this._playSweep({ from: 440, to: 660, duration: 0.12, type: 'sine', volume: 0.06 });
    }, 250);
  }

  // ---- 攻撃・被弾効果音 ----

  playPlayerHit() {
    // プレイヤー被弾音
    this._playSweep({ from: 300, to: 150, duration: 0.1, type: 'sawtooth', volume: 0.18 });
    this._playNoise({ duration: 0.08, volume: 0.08, filterFreq: 400, filterQ: 1 });
  }

  playMeleeSwing() {
    // 近接攻撃スイング音
    this._playSweep({ from: 400, to: 200, duration: 0.07, type: 'square', volume: 0.08 });
  }

  playMeleeHit() {
    // 近接攻撃ヒット音
    this._playSweep({ from: 250, to: 100, duration: 0.09, type: 'sawtooth', volume: 0.14 });
    this._playNoise({ duration: 0.06, volume: 0.07, filterFreq: 500, filterQ: 1.2 });
  }

  // ---- モブ効果音 ----

  playZombieGroan() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    // ゾンビのうめき声（低い揺れる音）
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = 80 + Math.random() * 30;

    lfo.type = 'sine';
    lfo.frequency.value = 3 + Math.random() * 2;
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
    gain.gain.setValueAtTime(0.08, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.65);
    lfo.stop(now + 0.65);
  }

  playSkeletonRattle() {
    // スケルトンのカタカタ音（打撃音 + 高周波）
    this._playNoise({ duration: 0.04, volume: 0.06, filterFreq: 2000, filterQ: 3 });
    setTimeout(() => {
      this._playNoise({ duration: 0.03, volume: 0.04, filterFreq: 2500, filterQ: 4 });
    }, 60);
  }

  playArrowFly() {
    // 矢が飛ぶ音
    this._playSweep({ from: 800, to: 400, duration: 0.15, type: 'sine', volume: 0.05 });
  }

  playArrowHit() {
    // 矢が当たる音
    this._playNoise({ duration: 0.05, volume: 0.07, filterFreq: 1000, filterQ: 2 });
    this._playSweep({ from: 300, to: 150, duration: 0.06, type: 'square', volume: 0.06 });
  }

  playCreeperHiss() {
    // クリーパーのシュー音
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const bufSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.seGain);
    src.start(now);
    src.stop(now + 0.85);
  }

  playCreeperExplode() {
    // 爆発音（低い轟音）
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const bufSize = this.ctx.sampleRate * 0.6;
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.seGain);
    src.start(now);
    src.stop(now + 0.65);

    // 後続の余韻
    setTimeout(() => {
      this._playNoise({ duration: 0.3, volume: 0.08, filterFreq: 150, filterQ: 0.5 });
    }, 100);
  }

  playMobDeath() {
    // モブ死亡音
    this._playSweep({ from: 300, to: 80, duration: 0.3, type: 'sawtooth', volume: 0.1 });
    this._playNoise({ duration: 0.1, volume: 0.06, filterFreq: 400, filterQ: 1 });
  }

  playSpiderClick() {
    // クモのカチカチ音
    this._playNoise({ duration: 0.03, volume: 0.05, filterFreq: 3000, filterQ: 5 });
    setTimeout(() => {
      this._playNoise({ duration: 0.02, volume: 0.04, filterFreq: 3500, filterQ: 6 });
    }, 40);
  }

  // ---- UI効果音 ----

  playUIClick() {
    this._playSweep({ from: 800, to: 1000, duration: 0.04, type: 'sine', volume: 0.05 });
  }

  playUIOpen() {
    this._playSweep({ from: 300, to: 500, duration: 0.08, type: 'sine', volume: 0.06 });
  }

  playUIClose() {
    this._playSweep({ from: 500, to: 300, duration: 0.08, type: 'sine', volume: 0.05 });
  }

  playLevelUp() {
    // レベルアップ・達成音
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this._playSweep({ from: freq, to: freq * 1.05, duration: 0.15, type: 'sine', volume: 0.08 });
      }, i * 80);
    });
  }
}
