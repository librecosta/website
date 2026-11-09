"""Render the local Web Audio sources with Python 3 and FFmpeg."""

import argparse
import array
import math
from pathlib import Path
import subprocess
import tempfile
import wave


RATE = 48000
MUSIC_RATE = 24000
SECONDS = 52
OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'local'

# Beds: start, duration, MIDI voicing, level. Replies: start, duration, note, level, pan.
STUDIES = {
    'warm-atmosphere': {
        'beds': [(-3.4, 15.2, (50, 57, 61, 64), .66), (8.6, 16.8, (47, 54, 57, 62, 64), .91),
                 (22.1, 15.7, (43, 55, 59, 62, 66), .70), (34.6, 16.6, (45, 52, 57, 62, 64), .51)],
        'replies': [(.65, 4.2, 69, .58, -.31), (3.2, 4.1, 76, .32, .46), (6.2, 5.5, 73, .42, .12),
                    (11.7, 5.8, 66, .54, -.43), (14.6, 4.7, 74, .39, .38), (20.4, 5.4, 69, .42, -.13),
                    (25.9, 6.0, 71, .49, .39), (28.3, 4.7, 78, .25, -.47), (33.7, 5.8, 74, .45, -.22),
                    (39.8, 5.3, 76, .36, .30), (45.9, 6.5, 69, .37, -.35)],
    },
    'ethereal-machinery': {
        'beds': [(-2.3, 14.9, (49, 56, 63, 66), .62), (9.2, 14.8, (52, 59, 66, 73), .72),
                 (20.8, 17.0, (47, 54, 64, 68), .49), (34.4, 17.6, (44, 56, 61, 66), .73)],
        'replies': [(1.1, 4.8, 73, .58, -.48), (2.9, 4.1, 80, .27, .57), (7.1, 5.4, 68, .46, .25),
                    (11.0, 5.9, 71, .56, -.49), (14.1, 5.1, 78, .32, .61), (18.8, 4.9, 73, .41, -.21),
                    (23.4, 6.6, 64, .50, .42), (29.8, 5.4, 71, .32, -.52), (32.5, 4.1, 80, .24, .50),
                    (37.5, 5.7, 78, .55, -.46), (41.1, 4.7, 73, .44, .52), (46.6, 6.2, 68, .38, -.34)],
    },
}


def add_voice(left, right, start, duration, note, gain, pan, mechanical, reply=False):
    rate = MUSIC_RATE
    offset = round(start * rate)
    omega = math.tau * 440 * 2 ** ((note - 69) / 12) / rate
    attack = .31 if reply else 3.7
    release = .82 if reply else 4.5
    a = gain * math.sqrt((1 - pan) / 2)
    b = gain * math.sqrt((1 + pan) / 2)
    overtone = 2.76 if mechanical else 3
    ring = 4.12 if mechanical else 2
    sin, exp, cos = math.sin, math.exp, math.cos
    for i in range(round(duration * rate)):
        age = i / rate
        edge = min(1., age / attack, (duration - age) / release)
        envelope = edge * edge * (3 - 2 * edge)
        phase = omega * i + .11 * sin(age * 1.17 + note)
        if reply:
            # A rounded attack, then the bright partials disappear before the body.
            tone = (sin(phase) * exp(-age / 1.75)
                    + .34 * sin(phase * overtone) * exp(-age / .91)
                    + .15 * sin(phase * ring) * exp(-age / .62))
        else:
            breath = .66 + .34 * sin(math.pi * age / duration)
            tone = breath * (sin(phase) + .14 * sin(phase * 2) + .054 * cos(phase * overtone))
        value = envelope * tone
        # Wrapping the events and the reflections preserves the seam across phrases.
        j = (offset + i) % len(left)
        left[j] += value * a
        right[j] += value * b


def render_study(score, mechanical):
    count = SECONDS * MUSIC_RATE
    left, right = (array.array('f', [0]) * count for _ in range(2))
    for start, duration, notes, gain in score['beds']:
        for i, note in enumerate(notes):
            level = (.53, .32, .25, .19, .11)[i] * gain
            pan = (-.06, -.47, .44, -.29, .31)[i]
            delay = i * .31
            add_voice(left, right, start + delay, duration - delay, note, level, pan, mechanical)
    for start, duration, note, gain, pan in score['replies']:
        add_voice(left, right, start, duration, note, gain, pan, mechanical, reply=True)

    short, long, late = (round(t * MUSIC_RATE) for t in ((.113, .267, .442) if mechanical else (.096, .213, .364)))
    for i, (a, b) in enumerate(zip(left, right)):
        yield (a + .21 * right[i - short] + .12 * left[i - long] + .063 * right[i - late],
               b + .21 * left[i - short] + .12 * right[i - long] + .063 * left[i - late])


def render_wind(ffmpeg, path):
    raw = subprocess.check_output([ffmpeg, '-v', 'error', '-ss', '2.5', '-i', str(path), '-t', '34',
                                   '-af', 'highpass=f=65,lowpass=f=6700', '-ar', str(RATE), '-ac', '2',
                                   '-f', 'f32le', '-'])
    samples = array.array('f')
    samples.frombytes(raw)
    frames = len(samples) // 2
    overlap = round(4.5 * RATE)
    if frames < 3 * overlap:
        raise ValueError('Wind input is too short for the authored loop.')
    for i in range(overlap, frames - overlap):
        yield samples[i*2], samples[i*2+1]
    for i in range(overlap):
        weight = i / (overlap - 1) * math.pi / 2
        a, b = math.cos(weight), math.sin(weight)
        tail = (frames - overlap + i) * 2
        head = i * 2
        yield samples[tail] * a + samples[head] * b, samples[tail+1] * a + samples[head+1] * b


def encode(ffmpeg, stem, frames, rms_db, opus_kbps, rate=RATE):
    pcm = array.array('f', (sample for frame in frames for sample in frame))
    rms = math.sqrt(sum(sample * sample for sample in pcm) / len(pcm))
    gain = min(10 ** (rms_db / 20) / rms, .87 / max(map(abs, pcm)))
    quantized = array.array('h', (round(sample * gain * 32767) for sample in pcm))
    # Encode a little repeated signal on each end so the decoder is already
    # primed at the true loop point. The browser skips both margins.
    guard_samples = rate // 4 * 2
    padded = quantized[-guard_samples:] + quantized + quantized[:guard_samples]
    with tempfile.TemporaryDirectory() as temp:
        wav = Path(temp) / 'loop.wav'
        with wave.open(str(wav), 'wb') as output:
            output.setparams((2, 2, rate, 0, 'NONE', 'not compressed'))
            output.writeframes(padded.tobytes())
        for extension, options in (
            ('opus', ['-c:a', 'libopus', '-b:a', f'{opus_kbps}k', '-vbr', 'constrained']),
            ('mp3', ['-c:a', 'libmp3lame', '-b:a', '64k', '-write_xing', '1']),
        ):
            folder = OUTPUT.parent if stem == 'warm-atmosphere' else OUTPUT
            target = folder / f'{stem}.{extension}'
            subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(wav), *options, str(target)], check=True)
            print(f'{target.name}: {len(pcm) / (2 * rate):.2f} s, {target.stat().st_size:,} bytes', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--wind', type=Path, help='Local copy of mixkit-arctic-winds-1154.wav')
    parser.add_argument('--studies', action='store_true', help='Render both original audition loops')
    args = parser.parse_args()
    if not args.wind and not args.studies:
        parser.error('Select --wind, --studies, or both.')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if args.wind:
        encode(args.ffmpeg, 'expanse-wind', render_wind(args.ffmpeg, args.wind), -23, 36)
    if args.studies:
        for stem, score in STUDIES.items():
            encode(args.ffmpeg, stem, render_study(score, stem == 'ethereal-machinery'), -22.5, 40, MUSIC_RATE)


if __name__ == '__main__':
    main()
