# LibreCosta 声音研究

## 参考与小样

Hubtown 附件的 `ambient-loop.wav` 长 56.22 秒。按 4 秒分段测量，RMS 约为 −31.3 至 −13.7 dBFS，高频也随乐句进出。4–12 秒和 28–32 秒有明显抬升，后段逐步回落。公开站点的浏览器 Network 中可见环境循环、Hover 和 Click 分别加载。小样从参考中提取乐句的疏密、明暗起伏与空间感，音色和乐句均由本项目合成。[Hubtown](https://hubtown.co.in/)

- **A · Warm Atmosphere** 已选为共用背景曲。逐段交叠不同的暖和声，稀疏短音随乐句出现，随后让出空间给尾音。
- **B · Ethereal Machinery** 保留为本地研究小样。以间距不等的成对共鸣声和更长的尾音形成应答，弱非整数谐波提供轻微机械感。

两首均无固定节拍。声音事件及立体声反射按 52 秒周期回卷，保留跨越循环点的尾音。Opus 解码后按 1 秒分段测得 RMS 起伏分别为 A 16.0 dB、B 12.9 dB。

## 生成与播放

使用 Python 3 和支持 `libopus`、`libmp3lame` 的 FFmpeg。传入已取得的 Mixkit WAV。若 FFmpeg 不在 PATH，使用 `--ffmpeg` 指定实际可执行文件。

```sh
python scripts/prepare-audio.py --wind /path/to/mixkit-arctic-winds-1154.wav --studies
pnpm dev
```

A 是项目原创合成的正式背景曲。Opus 和 MP3 回退存放在 `public/audio/`，供静态站点在用户开启声音后加载。B 和风声输出到被 Git 忽略的 `public/audio/local/`。普通模式初始静音。打开 `/lab/expanse?debug=1`，展开「声音音量」可单独调节风声、背景曲和界面提示音。默认风声与背景曲增益各降低三分之一，界面提示音增益提高三分之一。第三方来源和使用条件见 [Mixkit 许可记录](../../public/License/mixkit-arctic-winds.txt)。

| 声轨 | 有效循环 | Opus（字节） | MP3（字节） |
| --- | ---: | ---: | ---: |
| Expanse 风声 | 29.50 秒 | 132,445 | 240,428 |
| A · Warm Atmosphere | 52.00 秒 | 269,981 | 420,716 |
| B · Ethereal Machinery | 52.00 秒 | 269,588 | 420,716 |

风声去除录音头尾后，用 4.5 秒等功率交叠衔接，并清理低频轰鸣。两种编码都预留 250ms 首尾保护段。Web Audio 略过保护段，在解码后用其中相邻的波形修补末尾 18ms，避免编码器边界造成点击声。

## 播放

根布局持有一个延迟创建的 AudioContext。风声、环境音乐和 UI 合成音分别进入独立 Gain，再汇入 Master。背景曲由根布局共用，章节切换只控制局部风声。切换浏览器标签页时，已经开启的声音继续播放。手动静音使用 240ms 淡出。开启声音后，移入左上 LibreCosta 字标可触发双音 Hover。
