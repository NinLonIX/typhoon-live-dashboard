# 实时数据接入说明

## 数据源

网页由 GitHub Actions 定时从[浙江省台风路径实时发布系统](https://typhoon.slt.zj.gov.cn/wap.htm)读取数据。

脚本使用的公开 JSON 接口：

- `https://typhoon.slt.zj.gov.cn/Api/TyphoonList/{年份}`：获取当年台风列表并筛选 `isactive = 1`。
- `https://typhoon.slt.zj.gov.cn/Api/TyphoonInfo/{tfid}`：获取实况点、移动方向、风速、气压、风圈和各机构预报路径。
- `https://typhoon.slt.zj.gov.cn/Api/TyphoonEvent/{tfid}/False`：获取台风事件记录。

请求带有官方站点 Referer，脚本只读取公开数据，不保存密钥。

## 更新方式

`.github/workflows/update-and-deploy.yml` 使用 GitHub Actions：

- `push` 到 `main` 时构建和部署。
- 每 15 分钟按 `*/15 * * * *` 触发一次（GitHub 的计划任务可能存在排队延迟）。
- 支持 `workflow_dispatch` 手动触发。
- 每次运行把标准化数据写入 `data/typhoon.json`，再打包静态文件发布到 GitHub Pages。

## 预警说明

浙江台风路径接口可能返回台风自身的 `warnlevel`，但不一定提供浙江省地方气象预警。页面只展示接口明确返回的蓝、黄、橙、红级别；没有返回时显示“未提供”，并引导用户查看当地气象和应急部门公告，不根据风力自行推断预警级别。

## 数据降级

如果抓取失败，脚本会保留最近一次有效台风数据，并把 JSON 的 `status` 标记为 `stale`。页面会显示缓存状态和数据源异常提示，避免把旧数据伪装成实时数据。

## 使用边界

该网站是非官方转发和展示页面，不能替代气象、海事、应急管理部门的正式预警、疏散命令或救援指令。正式长期运行前，应确认数据源授权、访问频率、服务条款和站点备案要求。
