export const defaultLevels = { wind: .42, music: .55, ui: .32 };
export type AudioBus = keyof typeof defaultLevels;
export type MusicStudy = 'warm-atmosphere' | 'ethereal-machinery';
export type AudioCue = 'hover' | 'click' | 'confirm';

const masterLevel = .8;
const fadeSeconds = .24;
const musicFade = .65;
const codecGuardSeconds = .25; // Matches the circular padding in prepare-audio.py.
const cues = {
  hover: [[510, 486, .047, .036, 0]],
  click: [[390, 276, .085, .087, 0]],
  confirm: [[392, 398, .13, .066, 0], [587, 581, .16, .041, .036]],
} as const;

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
  private music?: Loop & { track: MusicStudy };
  private musicRequest = 0;
  private suspendTimer?: number;
  private hoverAt = -Infinity;

  constructor(levels: typeof defaultLevels, private readonly reportWind: (status: 'ready' | 'missing') => void) {
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    for (const bus of Object.keys(this.buses) as AudioBus[]) {
      this.buses[bus].gain.value = levels[bus];
      this.buses[bus].connect(this.master);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private get audible() {
    return this.enabled && !document.hidden && !this.abort.signal.aborted;
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

  private onVisibility = () => { void this.syncPlayback().catch(() => {}); };

  private async syncPlayback() {
    window.clearTimeout(this.suspendTimer);
    if (document.hidden) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(0, now);
      await this.context.suspend();
    } else if (!this.enabled) {
      this.fade(this.master.gain, 0);
      this.suspendTimer = window.setTimeout(() => {
        if (!this.enabled) void this.context.suspend().catch(() => {});
      }, (fadeSeconds + .04) * 1000);
    } else {
      await this.context.resume();
      if (!this.audible) return;
      this.fade(this.master.gain, masterLevel);
      if (this.windActive) void this.startWind();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    return this.syncPlayback();
  }

  setLevel(bus: AudioBus, level: number) {
    this.fade(this.buses[bus].gain, level, .12);
  }

  setWindActive(active: boolean) {
    this.windActive = active;
    if (this.wind) this.fade(this.wind.gain.gain, Number(active));
    else if (active && this.audible) void this.startWind();
  }

  private load(stem: string) {
    const cached = this.buffers.get(stem);
    if (cached) return cached;
    const decode = async (extension: string) => {
      const response = await fetch(`/audio/local/${stem}.${extension}`, { signal: this.abort.signal });
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
      const buffer = await this.load('expanse-wind');
      if (!this.audible || !this.windActive || this.wind) return;
      this.wind = this.loop(buffer, 'wind');
      this.fade(this.wind.gain.gain, 1);
      this.reportWind('ready');
    } catch {
      if (!this.abort.signal.aborted) this.reportWind('missing');
    }
  }

  async chooseMusic(track: MusicStudy | null) {
    const request = ++this.musicRequest;
    if (track === this.music?.track) return;
    const buffer = track ? await this.load(track) : null;
    if (request !== this.musicRequest || this.abort.signal.aborted) return;
    if (this.music) {
      this.fade(this.music.gain.gain, 0, musicFade);
      this.music.source.stop(this.context.currentTime + musicFade);
    }
    this.music = track && buffer ? { ...this.loop(buffer, 'music'), track } : undefined;
    if (this.music) this.fade(this.music.gain.gain, 1, musicFade);
  }

  cue(kind: AudioCue) {
    if (!this.audible || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (kind === 'hover') {
      if (now - this.hoverAt < .12) return;
      this.hoverAt = now;
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
      voice.connect(envelope).connect(this.buses.ui);
      voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
      voice.start(start);
      voice.stop(end);
    }
  }

  close() {
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.clearTimeout(this.suspendTimer);
    this.abort.abort();
    void this.context.close().catch(() => {});
  }
}
