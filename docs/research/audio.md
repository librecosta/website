# LibreCosta 声音研究

## 参考与小样

Hubtown 附件的 `ambient-loop.wav` 长 56.22 秒。按 4 秒分段测量，RMS 约为 −31.3 至 −13.7 dBFS，高频也随乐句进出。4–12 秒和 28–32 秒有明显抬升，后段逐步回落。公开站点的浏览器 Network 中可见环境循环、Hover 和 Click 分别加载。小样从参考中提取乐句的疏密、明暗起伏与空间感，音色和乐句均由本项目合成。[Hubtown](https://hubtown.co.in/)

- **A · Warm Atmosphere** 已选为共用背景曲。逐段交叠不同的暖和声，稀疏短音随乐句出现，随后让出空间给尾音。
- **B · Ethereal Machinery** 保留为本地研究小样。以间距不等的成对共鸣声和更长的尾音形成应答，弱非整数谐波提供轻微机械感。

两首均无固定节拍。声音事件及立体声反射按 52 秒周期回卷，保留跨越循环点的尾音。Opus 解码后按 1 秒分段测得 RMS 起伏分别为 A 16.0 dB、B 12.9 dB。

## 生成与播放

使用 Python 3 和支持 `libopus`、`libmp3lame` 的 FFmpeg。若 FFmpeg 不在 PATH，使用 `--ffmpeg` 指定实际可执行文件。本次编码和测量使用 FFmpeg 7.1。

```sh
python scripts/prepare-audio.py --wind
python scripts/prepare-audio.py --check-wind
pnpm dev
```

A 与风声均由 LibreCosta 原创合成，成品以 Opus 和 MP3 存放在 `public/audio/`，随站点分发。`--wind` 仅更新风声与测量记录。`--studies` 可选，用于重新生成 A、B，B 保存在本地研究目录。站点初始静音。在 CN 开发环境打开 `/world/?debug=1`，展开「声音音量」可单独调节风声、背景曲和界面提示音。

| 声轨 | 有效循环 | Opus（字节） | MP3（字节） |
| --- | ---: | ---: | ---: |
| Expanse 风声 | 58.00 秒 | 238,209 | 468,692 |
| A · Warm Atmosphere | 52.00 秒 | 269,981 | 420,716 |
| B · Ethereal Machinery | 52.00 秒 | 269,588 | 420,716 |

风声由固定种子生成的低频气流、中频阵风和轻微砂砾噪声组成。每层滤波从循环尾部预热，阵风与砂砾使用各自的不规则周期和渐变包络。两种编码都预留 250 ms 首尾保护段。Web Audio 略过保护段，在解码后用其中相邻的波形修补末尾 18 ms。验收记录包含解码后的有效时长、RMS、峰值、循环边界采样差及 SHA-256，区域构建核对这些已测量的字节。[风声测量数据](../../scripts/expanse-wind-review.json)

## 播放

根布局持有一个延迟创建的 AudioContext。风声、环境音乐和 UI 合成音分别进入独立 Gain，再汇入 Master。背景曲由根布局共用，章节切换只控制局部风声。切换浏览器标签页时，已经开启的声音继续播放。手动静音使用 240ms 淡出。开启声音后，移入左上 LibreCosta 字标可触发双音 Hover。
