# 快速开始指南

本指南帮助您快速上手SU7 Racing游戏的自动化测试。

## 方案概览

我们提供了三种测试方案：

### 方案1: 浏览器控制台测试（最简单）

**优点：** 无需安装任何依赖，直接在浏览器中运行

**使用方法：**

1. 打开游戏页面（例如 `http://localhost:3000`）
2. 打开浏览器开发者工具（F12）
3. 切换到Console标签
4. 复制 `test/browser-test.js` 的内容并粘贴
5. 按Enter执行
6. 运行测试：

```javascript
// 运行单个测试
await testAcceleration()  // 测试加速
await testBraking()       // 测试刹车
await testSteering()      // 测试转向
await testDrift()         // 测试漂移
await testLap()           // 测试完整一圈

// 运行所有测试
await runAllTests()
```

### 方案2: 游戏内测试模式

**优点：** 可以在游戏运行时动态测试

**使用方法：**

1. 在 `index.html` 中添加测试脚本：
```html
<script type="module" src="test/in-game-test.js"></script>
```

2. 打开游戏页面
3. 在控制台中运行：
```javascript
// 创建测试实例
const tester = new InGameTest(window.game);

// 运行测试
await tester.startTest('acceleration');
await tester.startTest('drift');

// 获取测试报告
tester.getReport();
```

### 方案3: Puppeteer自动化测试（最完整）

**优点：** 可以完全自动化，无需手动操作

**使用方法：**

1. 安装依赖：
```bash
cd test
npm install
```

2. 启动测试服务器：
```bash
node test-server.js
```

3. 在另一个终端运行测试：
```bash
# 运行所有测试
npm test

# 运行特定测试
npm run test:speed
npm run test:steering
npm run test:drift
```

## 测试类型说明

### 基础功能测试 (`basic.test.js`)
- 游戏页面加载
- 游戏初始化
- 赛道选择界面
- 菜单交互

### 操控测试 (`steering.test.js`)
- 加速响应
- 刹车效果
- 转向灵敏度
- 组合操控

### 漂移测试 (`drift.test.js`)
- 漂移启动
- 漂移时的物理效果
- 漂移粒子效果
- 连续漂移

### 比赛流程测试 (`race.test.js`)
- 倒计时
- 比赛进行
- 检查点
- 比赛结束

### 赛道测试 (`track.test.js`)
- 不同赛道加载
- 赛道边界
- 赛道性能

### AI测试 (`ai-player.test.js`)
- AI自动驾驶
- AI稳定性
- AI压力测试

## 生成测试报告

```bash
# 生成HTML报告
npm run report
```

报告将保存在 `reports/` 目录。

## 常见问题

### Q: 游戏无法加载？
A: 检查是否启用了WebGL。可以在浏览器地址栏输入 `chrome://gpu` 查看。

### Q: 测试运行很慢？
A: 3D游戏测试需要实际渲染，速度取决于硬件性能。可以尝试在无头模式下运行。

### Q: 如何添加新的测试？
A: 在 `test/tests/` 目录下创建新的 `.test.js` 文件，使用 `GameTestHelper` 类进行操作。

## 测试示例

```javascript
// 完整的测试流程示例
async function fullTest() {
  const helper = new GameTestHelper(page);

  // 1. 打开游戏
  await helper.openGame();

  // 2. 开始比赛
  await helper.clickStart();
  await helper.selectTrack(0);
  await helper.waitForRaceStart();

  // 3. 测试操控
  await helper.accelerate(2000);
  await helper.steerLeft(1000);
  await helper.steerRight(1000);

  // 4. 测试漂移
  await helper.pressKey('Space');
  await helper.delay(1000);
  await helper.releaseKey('Space');

  // 5. 检查状态
  const state = await helper.getGameState();
  console.log('游戏状态:', state);

  // 6. 截图
  await helper.takeScreenshot('test_result');
}
```

## 相关文件

- `test/browser-test.js` - 浏览器控制台测试脚本
- `test/in-game-test.js` - 游戏内测试模式
- `test/helpers/game-test-helper.js` - 测试助手类
- `test/tests/` - 自动化测试用例
- `test/README.md` - 详细文档

## 获取帮助

如有问题，请查看：
1. `test/README.md` - 完整文档
2. 代码中的注释
3. 测试用例中的示例
