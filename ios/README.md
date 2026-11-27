# Folia iOS 构建

GitHub Actions 的 **Build iOS** 使用 `macos-26` 和仓库指定的 Node 版本。App 面向 iOS 16.4 及以上。分支 push 和 PR 会触发构建。将 workflow 放到 fork 的默认分支后，可以在 **Actions → Build iOS → Run workflow** 手动构建。

在 `zitons/folia-android` 中，由 push 或手动运行触发的每次成功构建都会将 `Folia-iOS-unsigned.ipa` 发布到 GitHub Releases。标签格式为 `ios-build-<运行编号>-<重试编号>`。PR 构建的 IPA 可以在运行详情的 **Artifacts** 下载。构建无需 Apple 证书或仓库 Secrets。在普通 iPhone 上安装前需要自行签名。

iOS 的 WebView 由原生控制器约束在 UIKit 安全区内。`capacitor.config.json` 的 iOS 插件列表排除了会自行调整 WebView 坐标的 StatusBar 插件。

### 音源和实测范围

iOS 使用 Web 播放路径。此 fork 的 Actions 构建默认接入 `https://api-enhanced-eosin-one.vercel.app` 作为网易云后端。可在 Actions 的 **Variables** 中用 `IOS_NETEASE_API_BASE` 覆盖该地址，或通过 `IOS_KUGOU_API_BASE`、`IOS_QQ_API_BASE` 接入对应的自托管音源。也可在应用内配置 HTTPS Navidrome。需要 Folia 的歌词代理时，把 `IOS_LYRIC_PROXY_BASE` 设为部署 `/api/lyric-proxy` 的 HTTPS 站点根地址。服务端需允许来自应用 WebView 的跨域请求。这些地址会编进前端包，凭据应在运行时登录时输入。

这个版本提供 iOS 工程和 IPA 构建。原生后台播放、锁屏切歌和本地曲库属于后续移植范围，各音源的登录、播放和歌词同步需要在 iPhone 上验收。
