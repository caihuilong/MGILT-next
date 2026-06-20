# MGILT 网站开发进度

## 项目信息
- **项目路径**: `g:/claude code/MGILT_Website/`
- **主文件**: `index.html` (单文件网站，含所有 HTML/CSS/JS)
- **编辑器文件**: `js/editor-3d.js` (Three.js ES6 module)
- **本地服务器**: http://localhost:8806
- **GitHub**: git@github.com:caihuilong/www.MGILT.com.git

---

## 已完成功能

### 基础架构
- [x] GitHub SSH 推送配置
- [x] 本地开发服务器 http://localhost:8806

### 导航结构
- 左侧：搜索图标 + MGILT logo
- 中间：首页 | 模块系统 | 空间灵感 | 设计你的MGILT | 关于MGILT | 合作伙伴
- 右侧：用户图标

### 首页 Hero 动画
- 六边形图片切片组合动画
- 左下角显示北京时间日期

### 模块系统页面
- Hero 区域：六边形模块化系统
- 对比表格：传统搭建 vs MGILT
- 六大核心模块展示
- 四步构建流程

### 编辑器 (MGILT 空间设计台)

#### 基础功能
- [x] 六大基础模块可放置在六边形网格上
- [x] 左键放置，右键移除
- [x] Ctrl+Z 撤销功能
- [x] 日光/夜景切换
- [x] 俯视/正面/侧面视图切换
- [x] 截图功能

#### 推荐组合（预设场景）
- [x] 餐厅外摆（含场景元素）
- [x] 办公交流（含场景元素）
- [x] 学校庭院（含场景元素）
- [ ] 咖啡店（待添加）
- [ ] 休闲 lounge（待添加）
- [ ] 零售店铺（待添加）

#### 场景元素功能
- [x] 阳伞、四人桌椅组合、单人高座椅、小圆桌
- [x] 商务人01/02/03
- [x] 学校白板、学生01/02/03
- [x] 放置、选择、拖拽移动、右键删除、旋转
- [x] 场景元素保存/加载
- [x] 清空功能同时清空场景元素

#### 导出功能
- [x] Excel 模块统计报表（含公式计算）
- [x] 总平面俯视图截图（自动缩放、隐藏场景元素）

### 用户中心 (我的设计)
- [x] 头像上传
- [x] 用户名编辑
- [x] 设计保存/更新/删除
- [x] localStorage 数据持久化

### 登录系统
- [x] 手机验证码登录（mock code: 1234）
- [x] 手机快速注册
- [ ] **正式版待接入后端**

### 合作伙伴页面
- [x] 六边形网格背景
- [x] 扩散光效动画
- [x] 合作伙伴申请表单

---

## 待上线功能

### 登录注册系统
- [ ] 国内版：手机验证码登录（LeanCloud 或短信 API）
- [ ] 国内版：邮箱注册登录
- [ ] 微信登录（需微信开放平台企业认证，300元/年）
- [ ] 海外版：Google 账号登录
- [ ] 海外版：邮箱登录
- [ ] **考虑分成国内版和海外版两个网站**

### 留言板功能
- [ ] 留言提交到数据库
- [ ] 邮件通知（EmailJS 方案）
- [ ] 留言管理后台

---

## 技术备注

### ES6 模块函数暴露
由于 `editor-3d.js` 是 ES6 模块，需要将函数暴露到 window 对象才能在 HTML 中调用：
```javascript
window.navigateTo = navigateTo;           // 路由跳转
window.loadDesignToEditor = loadDesignToEditor;  // 加载设计
window.showSaveModal = showSaveModal;     // 显示保存弹窗
window.showUpdateModal = showUpdateModal; // 显示更新弹窗
window.doSaveDesign = doSaveDesign;       // 执行保存/更新
window.exportDesignExcel = exportDesignExcel; // 导出报表
window.applyRecommend = applyRecommend;   // 应用推荐组合
window.exportDesignConfig = exportDesignConfig; // 导出模块配置
window.exportSceneElementsData = exportSceneElementsData; // 导出场景元素
window.loadSceneElementsData = loadSceneElementsData; // 加载场景元素
```

### localStorage 数据结构
- `mgilt_session`: 当前用户会话
- `mgilt_users`: 所有注册用户
- `mgilt_designs`: 用户保存的设计方案（含 modules、sceneElements、screenshot）

### 模块编码
| 编号 | 名称 | 编码 | 单价 |
|------|------|------|------|
| 0 | 踏面 | M-V4-PT-0-S | 699 |
| 1 | 低坐凳 | M-V4-BN-2-S | 1499 |
| 2 | 低种植 | M-V4-PL-3-S | 1699 |
| 3 | 高坐凳 | M-V4-BN-4-S | 1899 |
| 4 | 高种植 | M-V4-PL-5-S | 2099 |
| 5 | 桌台 | M-V4-TB-7-S | 2399 |

---

## 技术债务
- [ ] 清理 console.log 调试代码
- [ ] 浏览器兼容性测试
- [ ] 响应式布局优化

---

## 最近修改记录

### 2026-04-03
- 完成推荐组合预设场景（餐厅外摆、办公交流、学校庭院）
- 新增学校白板、学生01/02/03 场景元素
- 实现场景元素保存/加载功能
- 截图尺寸优化（解决 localStorage 满的问题）
- 导出 Excel 报表功能（含公式计算）
- 导出总平面俯视图（自动缩放、隐藏场景元素）
- 移除咖啡店、休闲 lounge、零售店铺预设（待后续添加）
