# 沿海台风实况预警台

面向沿海居民的台风实况信息与分级预警网站，已接入浙江省台风路径实时发布系统公开接口。

## 在线地址

- GitHub：[NinLonIX/typhoon-live-dashboard](https://github.com/NinLonIX/typhoon-live-dashboard)
- GitHub Pages：部署完成后会在仓库的 Actions 部署记录中显示页面地址。

## 当前内容

- [实时演示网页](index.html)：台风实况面板、路径示意图、预警信息和沿海城市影响列表。
- [项目计划书](docs/PROJECT_PLAN.md)：产品目标、功能范围、预警分级、数据方案、技术路线、里程碑和验收标准。
- [数据接入说明](docs/DATA_SOURCE.md)：官方接口、字段、刷新周期、失败降级和使用边界。

## 实时数据接入

页面由 `.github/workflows/update-and-deploy.yml` 每 15 分钟从浙江省台风路径实时发布系统抓取数据，标准化后生成 `data/typhoon.json`，再自动发布到 GitHub Pages。GitHub 的计划任务可能存在排队延迟，页面会显示最近一次同步时间和缓存状态。

浙江接口没有返回地方预警级别时，页面显示“未提供”，不会根据风力自行推断预警。正式预警和避险指令请以当地气象、海事和应急管理部门公告为准。

## 本地预览

这是无构建依赖的静态 HTML 页面，可直接双击 `index.html` 打开；也可以在仓库目录运行：

```powershell
npx serve .
```

手动刷新真实数据：

```powershell
node scripts/fetch-typhoon-data.mjs
```

## 技术约定

当前页面使用原生 HTML、CSS 和 JavaScript，地图使用内嵌 SVG 路径示意，避免外部依赖。数据抓取脚本使用 Node.js 内置 `fetch`，不需要 API 密钥。后续如果迁移到 TypeScript + React + Vite，仍应保留数据来源、发布时间、抓取时间、延迟和降级状态。

## 安全提示

这是面向公众的风险提示工具，不能替代当地政府、气象部门和应急管理部门发布的正式指令。正式上线前必须完成数据源授权、异常数据处理、移动端可读性和运行监控测试。
