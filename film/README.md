# 活宝 Livelings · 发布宣传片（约 89 秒，横版 1080p60）

无旁白：配乐、音效、字幕。两个版本共用同一套剪辑：

- `zh`：网站中文界面，字幕中文大字 + 英文小字（小红书、公众号、视频号、即刻、B 站）。
- `en`：网站英文界面，英文字幕（X、YouTube、Product Hunt、Hacker News）。

画面全部是真实网站和引擎逐帧录下来的，不是录屏：Playwright 的时钟被冻结，每帧推进 1/60 秒，CSS 动画和视频也按同一时间对齐，再用 CDP 截图，所以 120Hz 的丝滑在片子里一帧不丢。

## 分镜（按小节；1 小节 ≈ 2.14 秒，bar k = 第 1+4k 拍）

| 小节 | 画面 | 来源 |
|---|---|---|
| 0–2 | 灰色转圈圈，「又在转圈圈？」→ 塌成一个点，墨团蹦出来开始思考 | `scenes` hook |
| 2–6 | 三张状态卡（思考中 / 出错了 / 完成），图标每小节换成一个会演的角色 | `scenes` states |
| 6–8 | 片名「活宝 Livelings」盖章落下，七个角色一拍一个弹出来 | `scenes` title |
| 8–16 | **网站首页**：卡片盖章入场，所有角色盯着鼠标；点空白处墨滴，全员吓一跳；往下滚看第二排；**点飘飘卡片 → 分裂成 16 格**；点一格放大，在胶片条里换成「穿墙」 | 真实网站 home |
| 16–20 | 工作台里的墨团：戳、拖、挠痒、连点 | 真实网站 play |
| 20–24 | 绝活：点点掷出六 / 飘飘吓你、嘎嘎翻身 / 垒垒塌了、月月变圆 / 豆豆打雷、墨团盖章 | `scenes` tricks |
| 24–28 | 「放进真实产品里」：墨团习惯 App 视频、小程序打卡、网站助手 | 真实网站 showcase |
| 28–30 | 三行代码，`state` 从 thinking 改成 done | `scenes` code |
| 30–31.75 | **音乐停**：「想要一个自己的？」，对话框里打出一句话 | `scenes` pause |
| 31.75–33 | 音乐回来那一下：吐吐从吐司机里弹出来，DING | `scenes` toasty |
| 33–35 | 活宝 Skill 工作台：16 个吐吐 | 技能包 studio.html |
| 35–37 | 用 Skill 做的文章插画卡片 | 技能包 card.html |
| 37–结束 | 片尾：八个角色庆祝，网址、GitHub、MakerJackie；音乐收尾时一起打哈欠睡着 | `scenes` end |

字幕和每个音效的时间都在 `src/edl.ts`，镜头里的鼠标动作在 `tools/shots.mjs`，两者都从 `beats.json` 算时间，所以点击、转场和字幕都落在拍子上。

## 素材与授权

- 配乐：世界的形状曲库「口袋相机 Pocket Camera · 90」（`scene-funk-90`，Lyria 生成，`lyria-commercial-2026-09`，可商用，许可见 `public/music/`）。112.2 BPM，第 30 小节整段停顿，正好放「想要一个自己的？」。
- 音效：同一曲库的 `sfx-*`（CC0，原创合成），加上原创合成的 pop / ding / stamp / whoosh / tick；`pop-1…7` 是 pop 按大调音阶升调。
- 字体：Bricolage Grotesque（OFL，渲染时由 `@remotion/google-fonts` 加载，需要联网）；中文用系统的苹方，所以只在 Mac 上渲染。
- 角色：活宝家族 CC BY 4.0，代码 MIT；吐吐是用活宝 Skill 做的示例角色。

## 重新生成

```bash
npm ci
# 1. 引擎和技能包（场景页直接用 Mascots 的构建产物）
(cd .. && pnpm skill)
# 2. 两个服务：网站 :5280，场景页 :5290
(cd .. && pnpm dev) &
npm run serve &
# 3. 节拍表（只在换配乐时）
npm run beats
# 4. 逐帧录制（每个语言约 6 分钟）→ footage/<lang>/<shot>.mp4 和每个镜头的总览图
npm run capture -- --lang zh --all
npm run capture -- --lang en --all
# 5. 剪辑和交付
npm run render:zh && npm run render:en
npm run finish   # → renders/livelings-launch-<lang>-1080p60.mp4，-14 LUFS，真峰值 ≤ -1.5 dBTP
```

录制的坑（都已在 `tools/capture.mjs` 里处理）：

- 新版无头 Chrome 只重绘窗口里装得下的部分，1440×810 的视口底部会留一条旧画面：用 CDP 把窗口放大，再用 `Emulation.setDeviceMetricsOverride` 把视口设回来（Playwright 以为没变，`setViewportSize` 不生效）。
- `Page.captureScreenshot` 的 `clip` 是页面坐标，页面滚动后要加上 `scrollX/scrollY`，否则画面整体错位。
- 假时钟管不到 CSS 动画、过渡和 `<video>`：每帧把 `document.getAnimations()` 暂停并设到虚拟时间，视频也逐帧 seek，等 seek 完成再截图（用 Node 侧轮询，页面里的 `setTimeout` 已被冻结）。
