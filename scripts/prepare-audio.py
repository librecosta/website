"""Render the local Web Audio sources with Python 3 and FFmpeg."""

import argparse
import array
import math
from pathlib import Path
import subprocess
import tempfile
import wave


RATE = 48000
SECONDS = 52
CODEC_GUARD = RATE // 4
OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'local'

# Each voice has a pitch, gain, stereo position, and harmonic strengths.
STUDIES = {
    'warm-atmosphere': (
        (73.416, .70, -.10, (1, .31, .10, .03)),
        (110.000, .43, .25, (1, .27, .07)),
        (146.832, .58, -.46, (1, .35, .15, .06)),
        (220.000, .38, .48, (1, .17, .08)),
        (293.665, .24, -.17, (1, .24, .09)),
        (329.628, .19, .31, (1, .14)),
        (369.994, .14, -.36, (1, .12, .04)),
    ),
    'ethereal-machinery': (
        (87.307, .55, .10, (1, .16, .10)),
        (130.813, .30, -.21, (1, .12, .15)),
        (174.614, .40, -.55, (1, .23, .05)),
        (261.626, .25, .49, (1, .07, .10)),
        (392.219, .14, .64, (1, .24, .07)),
        (527.400, .07, -.67, (1, .06)),
        (789.600, .031, .49, (1, .12)),
    ),
}


def render_pad(voices, mechanical):
    # Integer phase turns over the whole buffer keep carriers and modulation periodic.
    count = SECONDS * RATE
    left, right = (array.array('f', [0]) * count for _ in range(2))
    phase_step = math.tau / count
    for i, (pitch, gain, pan, harmonics) in enumerate(voices):
        voice = array.array('f', [0]) * count
        turns = round(pitch * SECONDS)
        phase = i * 2.399963
        motion = .21 if mechanical else .09
        for j in range(count):
            t = j * phase_step
            envelope = .80 + .14 * math.cos(t * (1 + i % 3) + phase) + .055 * math.sin(t * 4 - phase)
            carrier = turns * t + phase + motion * math.sin((2 + i % 4) * t - phase)
            voice[j] = gain * envelope * sum(a * math.sin(h * carrier) for h, a in enumerate(harmonics, 1))
        # Diffuse, circular reflections give the stereo image depth without a tail at the seam.
        taps = ((0, 1., pan), (.091 + i * .007, .20, -.73), (.173 + i * .009, .15, .75),
                (.331 + i * .013, .075, -pan))
        for seconds, level, position in taps:
            delay = round(seconds * RATE)
            a = level * math.sqrt((1 - position) / 2)
            b = level * math.sqrt((1 + position) / 2)
            for j in range(count):
                value = voice[j - delay]
                left[j] += value * a
                right[j] += value * b
    width = 1.65 if not mechanical else 2.2
    for a, b in zip(left, right):
        mid, side = (a + b) / 2, (a - b) / 2 * width
        yield mid + side, mid - side


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


def encode(ffmpeg, stem, frames, rms_db, opus_kbps):
    pcm = array.array('f', (sample for frame in frames for sample in frame))
    rms = math.sqrt(sum(sample * sample for sample in pcm) / len(pcm))
    gain = min(10 ** (rms_db / 20) / rms, .87 / max(map(abs, pcm)))
    quantized = array.array('h', (round(sample * gain * 32767) for sample in pcm))
    # Encode a little repeated signal on each end so the decoder is already
    # primed at the true loop point. The browser skips both margins.
    padded = quantized[-CODEC_GUARD*2:] + quantized + quantized[:CODEC_GUARD*2]
    with tempfile.TemporaryDirectory() as temp:
        wav = Path(temp) / 'loop.wav'
        with wave.open(str(wav), 'wb') as output:
            output.setparams((2, 2, RATE, 0, 'NONE', 'not compressed'))
            output.writeframes(padded.tobytes())
        for extension, options in (
            ('opus', ['-c:a', 'libopus', '-b:a', f'{opus_kbps}k', '-vbr', 'constrained']),
            ('mp3', ['-c:a', 'libmp3lame', '-b:a', '64k', '-write_xing', '1']),
        ):
            target = OUTPUT / f'{stem}.{extension}'
            subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(wav), *options, str(target)], check=True)
            print(f'{target.name}: {len(pcm) / (2 * RATE):.2f} s, {target.stat().st_size:,} bytes', flush=True)


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
        for stem, voices in STUDIES.items():
            encode(args.ffmpeg, stem, render_pad(voices, stem == 'ethereal-machinery'), -26, 40)


if __name__ == '__main__':
    main()
