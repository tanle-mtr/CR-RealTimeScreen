# 国铁实时信息屏

一个实时显示中国铁路车站车次信息的大屏幕软件，UI风格参考 [CRSim](https://github.com/denglihong2007/CRSim)，数据来源为12306官方接口。

## 功能特性

- 🚄 **实时数据**：直接调用12306官方微信小程序接口，真实车次信息
- 🖥️ **大屏UI**：纯黑背景、大字体，完全参考CRSim国铁大屏风格
- 🎨 **车次配色**：严格按照CRSim默认配置
  - G字头高铁：洋红 #FF00FF
  - D字头动车：钢蓝 #4682B4
  - C字头城际：青色 #008080
  - T字头特快：蓝色 #0000FF
  - Z字头直达：鞍棕 #8B4513
  - K/Y字头快速/旅游：红色 #FF0000
  - L字头临客：绿色 #00FF00
- 📍 **全国车站**：支持全国所有车站，按 省份→城市→车站 三级筛选
- ⏱️ **智能状态**：根据当前时间自动计算剩余时间，显示实时状态
  - 始发站：候车中 → 可以检票 → 检票中 → 停止检票 → 已发车
  - 过路站：正点 → 即将到达 → 正在进站 → 停车中 → 已发车
  - 终到站：正点 → 即将到达 → 正在进站 → 已到达
- 🔄 **自动刷新**：可配置刷新间隔（默认60秒）
- 📦 **单文件exe**：无需安装Python，双击即可运行

## 快速开始

### 方式一：直接运行exe（推荐）

1. 从 [Releases](https://github.com/tanle-mtr/CR-RealTimeScreen/releases) 下载最新版 `国铁实时信息屏.exe`
2. 双击运行
3. 程序自动启动并打开浏览器显示大屏

### 方式二：从源码运行

```bash
# 克隆仓库
git clone https://github.com/tanle-mtr/CR-RealTimeScreen.git
cd CR-RealTimeScreen

# 安装依赖
pip install flask requests

# 运行
python app.py
```

然后访问 http://localhost:5000

## 使用说明

1. **选择车站**：点击右下角 ⚙ 设置，通过三级下拉（省份→城市→车站）选择，或直接搜索
2. **全屏显示**：按 F11 或点击 ⛶ 全屏按钮
3. **自动刷新**：默认每60秒自动刷新数据，可在设置中调整

## 项目结构

```
CR-RealTimeScreen/
├── app.py                  # Flask后端服务
├── templates/
│   └── index.html          # 主页面
├── static/
│   ├── style.css           # 样式（CRSim风格）
│   ├── script.js           # 前端逻辑
│   └── data/
│       ├── stations.json          # 车站电报码数据
│       └── stations_region.json   # 省市区三级车站数据
└── README.md
```

## 技术栈

- **后端**：Python + Flask
- **前端**：HTML + CSS + JavaScript
- **数据源**：12306微信小程序公开接口
- **打包**：PyInstaller

## 参考项目

- [CRSim](https://github.com/denglihong2007/CRSim) - 车站信息显示模拟软件（UI风格参考）
- [12306-wechat-apis](https://github.com/CyrilSLi/12306-wechat-apis) - 12306微信API逆向（接口参考）

## 免责声明

本项目仅供学习交流使用，数据来源于12306官方公开接口，与中国铁路12306官方无关。请勿用于商业用途。

## License

[MIT](LICENSE)
