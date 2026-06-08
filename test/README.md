# SU7 Racing 赛道自动测试

## 快速开始

### 方法1: 浏览器控制台测试（推荐）

1. 打开游戏页面（例如 `http://localhost:3000`）
2. 打开浏览器开发者工具（F12）
3. 切换到 Console 标签
4. 复制 `test/track-test.js` 的内容并粘贴
5. 按 Enter 执行
6. 运行测试：

```javascript
// 测试所有赛道
await runTrackTests()

// 测试单个赛道
await testSingleTrack(0)  // 测试第一个赛道
await testSingleTrack(5)  // 测试第六个赛道
```

---

## 测试流程

```
┌─────────────────────────────────────────┐
│  1. 自动选择赛道                          │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  2. 构建赛道和车辆                        │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  3. 开始比赛，AI自动驾驶                  │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  4. 实时检测卡住情况                      │
│  - 位置是否不变                           │
│  - 速度是否过低                           │
│  - 是否掉落出界                           │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  5. 如果卡住，自动重置位置                │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  6. 生成测试报告                          │
└─────────────────────────────────────────┘
```

---

## 卡住检测原理

### 检测条件

| 条件 | 阈值 | 说明 |
|------|------|------|
| 低速持续时间 | > 3秒 | 平均速度 < 0.5 持续3秒 |
| 位置不变 | > 3秒 | 移动距离 < 2 持续3秒 |
| 掉落出界 | Y < -50 | 玩家掉落到地图下方 |

### 自动修复

检测到卡住时，脚本会自动：
1. 重置玩家到赛道上最近的点
2. 重置AI位置
3. 清空检测历史
4. 继续测试

---

## 测试配置

修改 `TEST_CONFIG` 对象可以调整测试参数：

```javascript
const TEST_CONFIG = {
  maxLapTime: 60000,        // 单圈最大时间（毫秒）
  stuckThreshold: 3000,     // 判定卡住的时间（毫秒）
  stuckSpeedThreshold: 0.5, // 判定卡住的速度阈值
  checkInterval: 100,       // 检查间隔（毫秒）
};
```

---

## 测试报告

测试完成后会生成报告，包含：

- 总赛道数
- 完成数
- 超时数
- 失败数
- 每个赛道的卡住事件

示例输出：
```
========================================
   测试报告
========================================

总计: 20 个赛道
✅ 完成: 15
⚠️ 超时: 3
❌ 失败: 2

超时的赛道:
  - 蒙特卡洛: 5 次卡住
  - 巴库赛道: 3 次卡住
  - 铃鹿赛道: 2 次卡住

共检测到 10 次卡住事件
```

---

## 分析卡住原因

### 常见卡住原因

1. **急转弯**
   - AI转向角度不够
   - 赛道宽度太窄
   - **解决：** 增加 `aiLookaheads` 或调整转向灵敏度

2. **护栏碰撞**
   - AI无法正确避开护栏
   - 碰撞后卡住
   - **解决：** 改进碰撞检测和恢复逻辑

3. **赛道边界**
   - 赛道数据有问题
   - 边界检测太严格
   - **解决：** 检查赛道控制点和边界参数

4. **物理引擎问题**
   - 速度异常
   - 位置计算错误
   - **解决：** 检查物理参数和时间步长

### 调试方法

```javascript
// 1. 查看AI状态
const ai = game.aiControllers[0];
console.log('AI splineT:', ai.splineT);
console.log('AI frameCount:', ai.frameCount);

// 2. 查看玩家状态
const player = game.player;
console.log('Player position:', player.physics.chassisBody.position);
console.log('Player speed:', getPlayerSpeed(game));
console.log('Player splineT:', player.physics.currentSplineT);

// 3. 查看赛道信息
const track = game.track;
console.log('Track spline length:', track.spline.getLength());
console.log('Track half width:', track.halfWidth);
```

---

## 相关文件

- `test/track-test.js` - 主测试脚本
- `js/ai.js` - AI控制器
- `js/physics.js` - 物理引擎
- `js/track.js` - 赛道生成

---

## 常见问题

### Q: 测试很慢怎么办？

A: 可以调整测试配置：
```javascript
TEST_CONFIG.maxLapTime = 30000;  // 减少最大时间
TEST_CONFIG.checkInterval = 200; // 增加检查间隔
```

### Q: 如何只测试特定赛道？

A: 使用 `testSingleTrack(index)`：
```javascript
// 测试前5个赛道
for (let i = 0; i < 5; i++) {
  await testSingleTrack(i);
}
```

### Q: 测试中断了怎么办？

A: 脚本会自动保存已完成的测试结果，重新运行会覆盖之前的结果。

### Q: 如何查看详细的卡住位置？

A: 修改 `detectStuck` 函数，添加更多日志：
```javascript
console.log('Position:', pos);
console.log('Speed:', speed);
console.log('Last positions:', lastPositions.slice(-5));
```
