"""Render the original Web Audio loops with Python 3 and FFmpeg."""

import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import random
import subprocess
import tempfile
import wave


RATE = 48000
MUSIC_RATE = 24000
SECONDS = 52
OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'local'
WIND_REVIEW = Path(__file__).with_name('expanse-wind-review.json')
WIND_RATE = 24000
WIND_SECONDS = 58

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


def filter_wind(samples, cutoff, highpass):
    # Prime the Butterworth filter with half a second from the end of the loop.
    angle = math.tau * cutoff / WIND_RATE
    cosine = math.cos(angle)
    alpha = math.sin(angle) / math.sqrt(2)
    b0 = (1 + cosine if highpass else 1 - cosine) / (2 * (1 + alpha))
    b1 = (-2 if highpass else 2) * b0
    a1, a2 = -2 * cosine / (1 + alpha), (1 - alpha) / (1 + alpha)
    z1 = z2 = 0.
    for i in range(-WIND_RATE // 2, len(samples)):
        value = samples[i]
        output = b0 * value + z1
        z1, z2 = b1 * value - a1 * output + z2, b0 * value - a2 * output
        if i >= 0:
            samples[i] = output


def wind_band(rng, count, low, high):
    samples = array.array('f', (rng.uniform(-1, 1) for _ in range(count)))
    filter_wind(samples, low, highpass=True)
    filter_wind(samples, high, highpass=False)
    return samples


def wind_envelope(rng, durations, low, high):
    # Irregular periods and gentle slopes keep the gusts from beating in time.
    amplitudes = [rng.uniform(low, high) for _ in durations]
    for i, duration in enumerate(durations):
        start, end = amplitudes[i - 1], amplitudes[i]
        frames = round(duration * WIND_RATE)
        for frame in range(frames):
            weight = .5 - .5 * math.cos(math.pi * frame / frames)
            yield start + (end - start) * weight


def render_wind():
    rng = random.Random(20181123)
    frames = WIND_RATE * WIND_SECONDS
    air = wind_band(rng, frames, 55, 260)
    body = wind_band(rng, frames, 150, 780)
    grain = wind_band(rng, frames, 640, 3900)
    wake = wind_band(rng, frames, 245, 1850)
    gusts = wind_envelope(rng, [6, 12, 5, 8, 10, 4, 13], .52, 1.25)
    sand = wind_envelope(rng, [3, 6, 5, 4, 8, 2, 6, 3, 7, 4, 5, 5], .12, .58)
    delay = round(.016 * WIND_RATE)
    for i, (gust, grit) in enumerate(zip(gusts, sand)):
        bed = (.71 * air[i] + .36 * body[i]) * gust
        surface = .135 * grain[i] * grit
        yield (bed + surface + .14 * wake[i] * gust,
               bed + .135 * grain[i - delay] * grit + .14 * wake[i - delay] * gust)


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
            folder = OUTPUT if stem == 'ethereal-machinery' else OUTPUT.parent
            target = folder / f'{stem}.{extension}'
            muxer_options = ['-fflags', '+bitexact'] if stem == 'expanse-wind' else []
            subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(wav), *options, *muxer_options, str(target)], check=True)
            print(f'{target.name}: {len(pcm) / (2 * rate):.2f} s, {target.stat().st_size:,} bytes', flush=True)


def measure_wind(ffmpeg):
    results = {}
    for extension in ('opus', 'mp3'):
        path = OUTPUT.parent / f'expanse-wind.{extension}'
        samples = array.array('f')
        samples.frombytes(subprocess.check_output([
            ffmpeg, '-v', 'error', '-i', str(path), '-ar', str(WIND_RATE), '-ac', '2', '-f', 'f32le', '-'
        ]))
        start = WIND_RATE // 4 * 2
        end = len(samples) - start
        expected = WIND_SECONDS * WIND_RATE * 2
        if end - start != expected or not all(map(math.isfinite, samples)):
            raise ValueError(f'{path.name}: incorrect decoded length or nonfinite sample')
        loop = samples[start:end]
        rms = math.sqrt(sum(value * value for value in loop) / len(loop))
        peak = max(map(abs, loop))
        # The browser's last splice sample uses the wrap guard, not the encoded tail.
        seam = max(abs(samples[start + channel] - samples[start + channel - 2]) for channel in range(2))
        rms_db = 20 * math.log10(rms)
        peak_db = 20 * math.log10(peak)
        if not -25 <= rms_db <= -21 or peak_db > -3 or seam > .025:
            raise ValueError(f'{path.name}: RMS {rms_db:.2f}, peak {peak_db:.2f}, seam {seam:.5f}')
        results[path.name] = {
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'seconds': (end - start) / (2 * WIND_RATE),
            'rmsDbfs': round(rms_db, 2),
            'peakDbfs': round(peak_db, 2),
            'loopStep': round(seam, 5),
        }
    return json.dumps(results, indent=2) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--wind', action='store_true', help='Render and measure the first-party wind loop')
    parser.add_argument('--check-wind', action='store_true', help='Verify the measured release audio without rewriting it')
    parser.add_argument('--studies', action='store_true', help='Render both original audition loops')
    args = parser.parse_args()
    if not (args.wind or args.check_wind or args.studies):
        parser.error('Select --wind, --check-wind, or --studies.')
    if args.wind:
        encode(args.ffmpeg, 'expanse-wind', render_wind(), -23, 36, WIND_RATE)
        WIND_REVIEW.write_text(measure_wind(args.ffmpeg), encoding='utf-8')
    if args.check_wind:
        review = measure_wind(args.ffmpeg)
        if review != WIND_REVIEW.read_text(encoding='utf-8'):
            raise ValueError('The audio does not match the committed wind review.')
        print(review, end='')
    if args.studies:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for stem, score in STUDIES.items():
            encode(args.ffmpeg, stem, render_study(score, stem == 'ethereal-machinery'), -22.5, 40, MUSIC_RATE)


if __name__ == '__main__':
    main()
