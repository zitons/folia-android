# Folia iOS 构建

GitHub Actions 的 **Build iOS** 使用 `macos-26` 和仓库指定的 Node 版本。App 面向 iOS 16.4 及以上。将 workflow 放到 fork 的默认分支后，可以在 **Actions → Build iOS → Run workflow** 手动构建。涉及 iOS 工程的 push 和相关 PR 也会触发构建。

构建完成后，在运行详情的 **Artifacts** 中下载 `Folia-iOS-unsigned`，解压得到 `Folia-iOS-unsigned.ipa`。构建无需 Apple 证书或 GitHub Secrets。在普通 iPhone 上安装前需要自行签名。

### 音源和实测范围

iOS 使用 Web 播放路径。可先在应用内配置 HTTPS Navidrome。使用自托管的网易云、酷狗或 QQ API 时，可在 Actions 的 **Variables** 中分别设置 `IOS_NETEASE_API_BASE`、`IOS_KUGOU_API_BASE`、`IOS_QQ_API_BASE`。需要 Folia 的歌词代理时，把 `IOS_LYRIC_PROXY_BASE` 设为部署 `/api/lyric-proxy` 的 HTTPS 站点根地址。服务端需允许来自应用 WebView 的跨域请求。这些地址会编进前端包，凭据应在运行时登录时输入。

这个版本提供 iOS 工程和 IPA 构建。原生后台播放、锁屏切歌和本地曲库属于后续移植范围，各音源的登录、播放和歌词同步需要在 iPhone 上验收。
