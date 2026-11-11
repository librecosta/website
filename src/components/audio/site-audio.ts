export const defaultLevels = { wind: .42 * 2 / 3, music: .64 * 2 / 3, ui: .68 * 4 / 3 };
export type AudioBus = keyof typeof defaultLevels;
export type AudioCue = 'hover' | 'click' | 'confirm' | 'text' | 'scanBones' | 'scanRuin' | 'scanRing';

const masterLevel = .8;
const fadeSeconds = .24;
const musicFade = .65;
const codecGuardSeconds = .25; // Matches the circular padding in prepare-audio.py.
const cues = {
  hover: [[760, 712, .098, .14, 0], [1320, 1210, .052, .045, .007]],
  click: [[585, 388, .11, .22, 0], [1040, 820, .058, .060, .006]],
  confirm: [[528, 516, .17, .17, 0], [785, 773, .23, .12, .049]],
  scanBones: [[1175, 1090, .14, .052, 0], [1760, 1620, .11, .016, .028]],
  scanRuin: [[670, 1130, .094, .042, 0], [1520, 810, .118, .041, .092]],
  scanRing: [[185, 176, .264, .055, 0], [370, 352, .22, .030, .012], [554, 530, .15, .012, .029]],
} as const;
const scanFilters: Partial<Record<AudioCue, readonly [BiquadFilterType, number, number]>> = {
  scanBones: ['lowpass', 2550, .7],
  scanRuin: ['bandpass', 1050, 2.1],
  scanRing: ['lowpass', 950, .8],
};

type Loop = { source: AudioBufferSourceNode; gain: GainNode };

export class SiteAudio {
  private readonly context = new AudioContext();
  private readonly master = this.context.createGain();
  private readonly buses = {
    wind: this.context.createGain(), music: this.context.createGain(), ui: this.context.createGain(),
  };
  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private readonly abort = new AbortController();
  private readonly preferOpus = !!document.createElement('audio').canPlayType('audio/ogg; codecs="opus"');
  private enabled = false;
  private windActive = false;
  private wind?: Loop;
  private music?: Loop;
  private suspendTimer?: number;
  private hoverAt = -Infinity;
  private textAt = -Infinity;
  private scanAt = -Infinity;
  private textBuffer?: AudioBuffer;
  private textPulse?: { voice: AudioBufferSourceNode; envelope: GainNode };

  constructor(levels: typeof defaultLevels, private readonly reportWind: (status: 'ready' | 'missing') => void) {
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    for (const bus of Object.keys(this.buses) as AudioBus[]) {
      this.buses[bus].gain.value = levels[bus];
      this.buses[bus].connect(this.master);
    }
  }

  private get audible() {
    return this.enabled && !this.abort.signal.aborted;
  }

  private fade(param: AudioParam, level: number, seconds = fadeSeconds) {
    const now = this.context.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else {
      const current = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
    param.linearRampToValueAtTime(level, now + seconds);
  }

  private async syncPlayback() {
    window.clearTimeout(this.suspendTimer);
    if (!this.enabled) {
      this.fade(this.master.gain, 0);
      this.suspendTimer = window.setTimeout(() => {
        if (!this.enabled) void this.context.suspend().catch(() => {});
      }, (fadeSeconds + .04) * 1000);
    } else {
      await this.context.resume();
      if (!this.audible) return;
      this.fade(this.master.gain, masterLevel);
      void this.startMusic();
      if (this.windActive) void this.startWind();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stopTextCue();
    return this.syncPlayback();
  }

  setLevel(bus: AudioBus, level: number) {
    this.fade(this.buses[bus].gain, level, .12);
  }

  setWindActive(active: boolean) {
    this.windActive = active;
    if (this.wind) this.fade(this.wind.gain.gain, active ? 1 : 0, musicFade);
    else if (active && this.audible) void this.startWind();
  }

  private load(stem: string) {
    const cached = this.buffers.get(stem);
    if (cached) return cached;
    const decode = async (extension: string) => {
      const response = await fetch(`/audio/${stem}.${extension}`, { signal: this.abort.signal });
      if (!response.ok) throw new Error('Audio asset unavailable');
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      // Both margins contain wrapped samples. Match the end to the samples
      // just before loopStart so separate codec frames cannot click at the join.
      const guard = Math.round(codecGuardSeconds * buffer.sampleRate);
      const end = buffer.length - guard;
      const overlap = Math.round(.018 * buffer.sampleRate);
      if (end <= guard + overlap) throw new Error('Audio loop is too short');
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel);
        for (let i = 0; i < overlap; i++) {
          const weight = .5 - .5 * Math.cos(Math.PI * i / (overlap - 1));
          const tail = end - overlap + i;
          samples[tail] += (samples[guard - overlap + i] - samples[tail]) * weight;
        }
      }
      return buffer;
    };
    const pending = (this.preferOpus ? decode('opus').catch(() => decode('mp3')) : decode('mp3')).catch(error => {
      this.buffers.delete(stem);
      throw error;
    });
    this.buffers.set(stem, pending);
    return pending;
  }

  private loop(buffer: AudioBuffer, bus: 'wind' | 'music'): Loop {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = codecGuardSeconds;
    source.loopEnd = buffer.duration - codecGuardSeconds;
    source.connect(gain).connect(this.buses[bus]);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(0, source.loopStart);
    return { source, gain };
  }

  private async startWind() {
    if (this.wind) return;
    try {
      const buffer = await this.load('local/expanse-wind');
      if (!this.audible || !this.windActive || this.wind) return;
      this.wind = this.loop(buffer, 'wind');
      this.fade(this.wind.gain.gain, 1, musicFade);
      this.reportWind('ready');
    } catch {
      if (!this.abort.signal.aborted) this.reportWind('missing');
    }
  }

  private async startMusic() {
    if (this.music) return;
    try {
      const buffer = await this.load('warm-atmosphere');
      if (!this.audible || this.music) return;
      this.music = this.loop(buffer, 'music');
      this.fade(this.music.gain.gain, 1, musicFade);
    } catch {
      // Keep wind and UI cues available if the music file cannot load.
    }
  }

  private typeTick(now: number) {
    if (now - this.textAt < .045) return;
    this.textAt = now;
    if (!this.textBuffer) {
      const rate = this.context.sampleRate;
      const buffer = this.context.createBuffer(1, Math.round(rate * .032), rate);
      const samples = buffer.getChannelData(0);
      let seed = 731;
      for (let index = 0; index < samples.length; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const time = index / rate;
        const noise = seed / 0x80000000 - 1;
        const strike = noise * .56 * Math.exp(-time / .0038);
        const body = .48 * Math.sin(time * 2 * Math.PI * 645) * Math.exp(-time / .006);
        samples[index] = (strike + body) * Math.min(1, time / .0007, (samples.length - index) / (rate * .004));
      }
      this.textBuffer = buffer;
    }
    const voice = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    voice.buffer = this.textBuffer;
    voice.playbackRate.value = .96 + Math.random() * .08;
    filter.type = 'lowpass';
    filter.frequency.value = 2500;
    filter.Q.value = .5;
    envelope.gain.value = .052;
    voice.connect(filter).connect(envelope).connect(this.buses.ui);
    this.textPulse = { voice, envelope };
    voice.onended = () => {
      if (this.textPulse?.voice === voice) this.textPulse = undefined;
      voice.disconnect(); filter.disconnect(); envelope.disconnect();
    };
    voice.start(now);
  }

  cue(kind: AudioCue) {
    if (!this.audible || document.hidden || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (kind === 'hover') {
      if (now - this.hoverAt < .12) return;
      this.hoverAt = now;
    }
    if (kind === 'text') {
      this.typeTick(now);
      return;
    }
    const scan = scanFilters[kind];
    if (scan) {
      if (now - this.scanAt < .29) return;
      this.scanAt = now;
    }
    for (const [from, to, length, peak, delay] of cues[kind]) {
      const start = now + delay, end = start + length;
      const voice = this.context.createOscillator();
      const envelope = this.context.createGain();
      voice.type = 'sine';
      voice.frequency.setValueAtTime(from, start);
      voice.frequency.exponentialRampToValueAtTime(to, end);
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.linearRampToValueAtTime(peak, start + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, end);
      const filter = scan ? this.context.createBiquadFilter() : null;
      if (filter && scan) {
        [filter.type, filter.frequency.value, filter.Q.value] = scan;
        voice.connect(filter).connect(envelope);
      } else voice.connect(envelope);
      envelope.connect(this.buses.ui);
      voice.onended = () => {
        voice.disconnect(); filter?.disconnect(); envelope.disconnect();
      };
      voice.start(start);
      voice.stop(end);
    }
  }

  stopTextCue() {
    const pulse = this.textPulse;
    if (!pulse) return;
    this.textPulse = undefined;
    this.fade(pulse.envelope.gain, .0001, .012);
    pulse.voice.stop(this.context.currentTime + .012);
  }

  close() {
    window.clearTimeout(this.suspendTimer);
    this.abort.abort();
    void this.context.close().catch(() => {});
  }
}
