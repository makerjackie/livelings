# 活宝 Livelings 宣传片

两支横版 1080p60 的片子，画面全部来自真实网站和引擎：

| 片子 | 时长 | 声音 | 用在 |
|---|---|---|---|
| `Short-zh` / `Short-en` | 约 42 秒 | 配乐 + 音效，无人声；中文版大字带英文小字，英文版英文字幕 | 小红书、抖音、视频号、X、Product Hunt |
| `Long-zh` | 约 76 秒 | MJ Voice 刘飞 2.0 旁白 + 低音量配乐 + 音效，跟旁白走的字幕 | B 站、公众号、YouTube |

网站镜头录的是线上的 https://livelings.makerjackie.com ，放在浏览器框里，地址栏就是网址；全屏场景右上角常驻网址。

## 怎么做的

- **逐帧录制**（`tools/capture.mjs`）：Playwright 的时钟被冻结，每帧推进 1/60 秒，CSS 动画和视频按同一时间对齐，再用 CDP 截图，所以 120Hz 的顺滑一帧不丢。网站镜头按 1440×810 的视口、1.2 倍像素录成 1728×972，正好放进浏览器框；场景录成 1920×1080。
- **镜头表**（`tools/shots.mjs`）：一个纯函数，算出每个镜头的起止、鼠标动作和场景参数。短片按配乐节拍算，旁白版按旁白的逐字时间算。录制和剪辑共用它，所以点击、转场、音效和字幕都对得上。
- **场景**（`scenes/scenes.js`）：绝活、状态卡、三行代码、「想要一个自己的？」和片尾，用真实引擎画在 1440×810 的画布上，所有时间由镜头表传入。
- **剪辑**（`src/`）：Remotion。`edl.ts` 放字幕、音效和音量；`Film.tsx` 画浏览器框、字幕和混音。
- **配乐**（`tools/stems.py`）：世界的形状曲库《小小发明》（`scene-chamber-40`，Lyria 生成，可商用，许可见 `public/music/`），115 BPM。只在小节线上剪：第 3–6 小节和 7–10 小节相似度 0.999。短片从第 8 小节（主旋律回来）用到结尾，约 42 秒；旁白版把第 3–6 小节多放一遍，约 75.7 秒。
- **旁白**：MJ Voice（火山 Seed TTS 2.0，刘飞，合成音色，不是作者本人的声音），整段一次合成，指令「轻快的产品发布宣传片旁白，像向朋友展示一个刚做好的好玩小东西……」。稿子在 `voice/script-zh.txt`；音频和时间戳在 `public/voice/`，不进 Git。
- **音效**：同一曲库的 `sfx-*`（CC0，原创合成）和原创合成的 pop / ding / stamp / whoosh / tick；`pop-1…7` 是 pop 按大调音阶升调。

## 重新生成

```bash
npm ci
(cd .. && pnpm install && pnpm build)      # 引擎、技能包
(cd .. && pnpm dev) &                      # :5280，技能包的工作台和插画卡片
npm run serve &                            # :5290，场景页
npm run stems                              # 配乐和节拍表（只在换曲时）
# 旁白（只在改稿时；需要 MJ Voice 凭证）
bash ~/.agents/skills/mj-voice/scripts/run.sh voice tts "$(cat voice/script-zh.txt)" --voice zh-male \
  --direction '这是一支轻快的产品发布宣传片旁白，像向朋友展示一个刚做好的好玩小东西：自然亲切，略带笑意，节奏明快，流畅连贯，不要播音腔，不要一字一顿。' \
  --subtitles --out "$PWD/public/voice/vo-zh.wav"
npm run capture -- --edit short --lang zh --all
npm run capture -- --edit short --lang en --all
npm run capture -- --edit long --lang zh --all
npm run render:short-zh && npm run render:short-en && npm run render:long-zh
npm run finish   # → renders/livelings-<片>-1080p60.mp4，-14 LUFS，真峰值 ≤ -1 dBTP
```

录制的坑（`tools/capture.mjs` 里都处理了）：

- 新版无头 Chrome 只重绘窗口里装得下的部分：用 CDP 把窗口放大，再用 `Emulation.setDeviceMetricsOverride` 把视口设回来。
- `Page.captureScreenshot` 的 `clip` 是页面坐标，页面滚动后要加上 `scrollX/scrollY`。
- 假时钟管不到 CSS 动画、过渡和 `<video>`：每帧把 `document.getAnimations()` 暂停并设到虚拟时间，视频逐帧 seek，在 Node 侧等 seek 完成再截图。
