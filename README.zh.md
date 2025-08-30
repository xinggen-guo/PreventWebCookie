📖 项目描述（中文）

Cookie Guard – Chrome 插件

概述：
Cookie Guard 是一款轻量级、开源的 Chrome 插件，旨在保护用户隐私。它能自动拒绝非必要 Cookie 并消除 Cookie 同意弹窗。与普通“弹窗移除器”不同，Cookie Guard 结合了 网络层拦截、Cookie 清理和同意自动化，确保只保留网站运行所需的必要 Cookie。

核心功能：
•	🚫 自动拒绝 Cookie 弹窗 – 识别常见 CMP（同意管理平台）弹窗，自动点击“全部拒绝 / 仅必要”。
•	🍪 Cookie 管控 – 监控新设置的 Cookie，清除非白名单内的 Cookie。
•	🌐 网络拦截 – 通过 Chrome Declarative Net Request API 阻止已知跟踪域名。
•	📊 本地统计 – 显示已阻止的 Cookie 数量和已处理的弹窗次数。
•	🔒 隐私优先 – 所有处理均在本地完成，不上传用户数据。
•	⚙️ 站点级控制 – 支持暂停插件或为信任站点放行 Cookie。
•	💻 跨平台 – 运行于 Chrome 桌面端，包括 Windows、macOS、Linux 和 ChromeOS。

技术栈：
•	Manifest V3（Chrome 扩展 API）
•	JavaScript（后台脚本、内容脚本、弹窗 UI）
•	HTML/CSS（界面）
•	Chrome API: storage, cookies, declarativeNetRequest, contentSettings, privacy

适用场景：
•	注重隐私的用户，避免被追踪。
•	在欧盟地区需要符合 GDPR 友好浏览的学生与专业人士。
•	想要学习现代 Chrome 扩展开发的程序员。

未来计划：
•	🔄 多设备同步（chrome.storage.sync）。
•	📈 高级统计报表。
•	🌍 支持 Firefox / Edge / Safari WebExtension。