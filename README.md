# 召唤师峡谷 · 十英雄练习版 v1.2

在原有网页项目上接入真实峡谷地形、导航网格和十位英雄的经典 3D 模型，提供本地 5V5 人机对局与训练场。当前为可玩还原版本，尚未完成原版游戏的全部数值、特效和联网规则。详细来源和差异见 [还原记录](docs/restoration-status.md)。

[在线试玩](https://liyucheng1997.github.io/198_game-league-of-legend/) · [v1.2 发布说明](https://github.com/Liyucheng1997/198_game-league-of-legend/releases/tag/v1.2)

## 启动

在项目目录运行：

```powershell
python -m http.server 8196 --bind 127.0.0.1
```

浏览器打开 [本地游戏](http://127.0.0.1:8196)。也可以运行 `start.ps1`。模型通过本地 HTTP 加载，请使用服务器启动。所有游戏素材和 Three.js 均已下载，运行时无需联网。

推荐先选英雄，再点「训练模式」和「进入训练模式」。训练场提供满级、金币、敌我训练目标、冷却重置、全图视野和兵线生成。

## 首批英雄

盖伦、德莱厄斯、艾希、凯特琳、阿狸、拉克丝、安妮、易、墨菲特、索拉卡。共 40 个可施放技能及主要被动机制。

## 操作

| 操作 | 功能 |
|---|---|
| 右键 | 移动 / 攻击 |
| Q W E R | 朝鼠标施法；指向型技能需要有效目标 |
| Ctrl + Q/W/E/R，或技能上方 + | 加点 |
| A，再左键 | 攻击移动 |
| D / F | 闪现 / 治疗；打野 F 为惩戒 |
| 4 | 放置守卫 |
| B / P | 回城 / 商店 |
| 右键装备 | 在商店出售；组件会自动抵扣升级价格 |
| Tab | 按住查看战绩 |
| S / 空格 / Y | 停止 / 镜头回中 / 锁定镜头 |
| M / Esc | 声音开关 / 暂停与返回选人 |

## 代码和素材

- `js/champions.js`：十位英雄与官方装备数据映射。
- `js/rift-terrain.js`、`rift-grid.js`、`rift-map.js`：真实网格、坐标、导航与草丛。
- `js/engine.js`、`rift-game.js`：战斗、兵线、建筑、AI 和训练模式。
- `js/champion-models.js`：GLB 骨骼动画，WebGL 渲染后合成至 Canvas。
- `js/rift-render.js`、`render.js`：地图、单位、特效、视野和小地图。
- `assets/riot`、`assets/models`、`assets/map`：本地素材与来源校验记录。
- `scripts`：素材下载和格式转换；`tests`：技能、导航、装备和完整对局回归检查。

运行 `node tests/rift.test.js` 检查核心机制，运行 `node tests/match.test.js` 验证完整人机对局。原有岚铎资料及 `tests/landuo.test.js` 保留，供原版本研究使用。

本项目为个人学习项目，非 Riot 官方游戏。原始游戏素材归 Riot Games；下载来源、版本差异与库许可证见 [还原记录](docs/restoration-status.md)。

## 发布部署

发布分支为 `master`，GitHub Pages 从仓库根目录自动部署。`.nojekyll` 保持纯静态文件原样发布；`version.json` 可用于核对线上版本。原始下载档案不进入 Git，运行所需地图、模型、图标、代码和来源清单随仓库发布。
