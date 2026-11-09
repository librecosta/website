# LibreCosta 声音研究

## 参考与小样

Hubtown 附件的 `ambient-loop.wav` 长 56.22 秒。将本地附件解码到 48 kHz 后，35–180 Hz 与 180–600 Hz 两段的 RMS 分别约为 −22.8 与 −22.2 dBFS，600–2500 Hz 约为 −32.9 dBFS。两声道相关系数为 −0.17，首尾样本接近零。研究取用的是持续低中频、较宽的空间和循环尺度。未使用附件的波形、采样或旋律。

- **A · Warm Atmosphere** 用缓慢浮动的低音、温暖叠音与柔和的立体声反射形成稳定和声。
- **B · Ethereal Machinery** 增加少量偏离整数谐波的弱共振与更宽的反射，形成轻微机械质感。两首均无鼓组或节拍。振荡器与调制在 52 秒内走完整周期，循环反射也在同一缓冲中闭合。

## 生成与试听

使用 Python 3 和支持 `libopus`、`libmp3lame` 的 FFmpeg。传入已取得的 Mixkit WAV。若 FFmpeg 不在 PATH，使用 `--ffmpeg` 指定实际可执行文件。

```sh
python scripts/prepare-audio.py --wind /path/to/mixkit-arctic-winds-1154.wav --studies
pnpm dev
```

输出到被 Git 忽略的 `public/audio/local/`。打开 `/lab/expanse?debug=1`，展开「声音与小样」，点击 A 或 B。可单独调低风声来比较。普通模式初始静音，开启后仅播放风声与交互提示音。离开试听页会淡出实验音乐。第三方来源和使用条件见 [Mixkit 许可记录](../../public/License/mixkit-arctic-winds.txt)。

| 声轨 | 有效循环 | Opus（字节） | MP3（字节） |
| --- | ---: | ---: | ---: |
| Expanse 风声 | 29.50 秒 | 132,445 | 240,428 |
| A · Warm Atmosphere | 52.00 秒 | 269,518 | 420,524 |
| B · Ethereal Machinery | 52.00 秒 | 269,784 | 420,524 |

风声去除录音头尾后，用 4.5 秒等功率交叠衔接，并清理低频轰鸣。两种编码都预留 250ms 首尾保护段。Web Audio 略过保护段，在解码后用其中相邻的波形修补末尾 18ms，避免编码器边界造成点击声。

## 播放与浏览器验证

根布局持有一个延迟创建的 AudioContext。风声、环境音乐和 UI 合成音分别进入独立 Gain，再汇入 Master。未来章节可切换局部风声，不必重建音乐声源。已有的音乐缓冲按曲目缓存。页面隐藏时挂起上下文，恢复时从原位继续。静音使用 240ms 淡出，切换小样使用 650ms 交叠。

Chrome 157 实测首屏 0 个音频请求。开启声音仅请求风声 Opus。试听 A → B → A 共额外请求两个文件。切到后台时音频时钟停止，恢复和静音切回均沿用原声源。模拟不支持 Opus 时仅请求 MP3，成功解码出相同长度的风声循环。
