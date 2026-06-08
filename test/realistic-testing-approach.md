# 可行的游戏测试方案

## 问题分析

**为什么AI实时操控不可行：**
- 3D游戏需要60fps（16.7ms/帧）的响应速度
- AI模型推理需要几百ms甚至几秒
- 浏览器自动化本身有延迟
- 根本跟不上游戏节奏

---

## 方案1: 利用现有AI系统（推荐）

**思路：** 游戏已经有AIController（Pure Pursuit算法），直接让AI玩游戏

**优点：**
- 不需要额外工具
- 60fps实时运行（代码直接运行）
- 可以检测物理、碰撞、状态机等

**实现方式：**
```javascript
// 在游戏代码中添加测试模式
class GameTester {
  constructor(game) {
    this.game = game;
  }

  // 让AI自动玩一圈
  async runAITest() {
    // 启动比赛
    this.game.startRace();

    // 等待比赛结束（AI会自动玩）
    while (this.game.raceManager.state === 'RACING') {
      // 检查异常
      if (this.hasError()) {
        return { success: false, error: '...' };
      }
      await this.delay(100);
    }

    return { success: true };
  }

  // 检测异常
  hasError() {
    const player = this.game.player;
    const pos = player.physics.chassisBody.position;

    // 检查1: 位置异常
    if (pos.y < -100) return 'Player fell off world';
    if (Math.abs(pos.x) > 10000) return 'Player out of bounds';

    // 检查2: 速度异常
    const speed = Math.sqrt(player.physics.chassisBody.velocity.x ** 2 +
                           player.physics.chassisBody.velocity.z ** 2);
    if (speed > 500) return 'Speed too high';

    // 检查3: 控制台错误
    // ...

    return null;
  }
}
```

---

## 方案2: 预录制输入回放（传统方法）

**思路：** 预先录制正常游戏过程，回放时对比状态

**实现方式：**
```javascript
// 1. 录制阶段：记录正常输入序列
const recordedInputs = [];
game.on('frame', (input, state) => {
  recordedInputs.push({ input, state });
});

// 2. 回放阶段：应用输入并对比
function replayAndCompare(recordedInputs) {
  const errors = [];

  for (const { input } of recordedInputs) {
    // 应用输入
    applyInput(input);

    // 运行一帧
    game.step();

    // 对比状态
    const currentState = getState();
    const expectedState = getExpectedState();

    if (hasSignificantDifference(currentState, expectedState)) {
      errors.push({
        frame: i,
        expected: expectedState,
        actual: currentState
      });
    }
  }

  return errors;
}
```

**优点：**
- 不需要实时AI
- 可以精确对比每帧状态
- 适合回归测试

**缺点：**
- 需要预先录制"正确"的输入
- 游戏更新后可能需要重新录制

---

## 方案3: 状态空间检查（最实用）

**思路：** 不测试实时操控，只检查游戏状态是否在合理范围内

**实现方式：**
```javascript
class StateValidator {
  // 检查物理状态
  static validatePhysics(physics) {
    const body = physics.chassisBody;
    const errors = [];

    // 位置检查
    if (body.position.y < -50) {
      errors.push('Player too deep underground');
    }

    // 速度检查
    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
    if (speed > 300) {  // 假设最大速度300
      errors.push(`Speed ${speed} exceeds maximum`);
    }

    // 加速度检查
    const acc = body.velocity.length() / (1/60);
    if (acc > 100) {  // 假设最大加速度100
      errors.push(`Acceleration ${acc} too high`);
    }

    return errors;
  }

  // 检查赛道状态
  static validateTrack(track) {
    const errors = [];

    // 检查spline是否有效
    if (!track.spline || track.spline.getPointAt(0) === undefined) {
      errors.push('Track spline invalid');
    }

    // 检查检查点
    if (!track.checkpoints || track.checkpoints.length === 0) {
      errors.push('No checkpoints defined');
    }

    return errors;
  }

  // 检查比赛状态
  static validateRace(raceManager) {
    const errors = [];

    // 状态机检查
    const validStates = ['MENU', 'COUNTDOWN', 'RACING', 'FINISHED'];
    if (!validStates.includes(raceManager.state)) {
      errors.push(`Invalid race state: ${raceManager.state}`);
    }

    // 时间检查
    if (raceManager.time < 0) {
      errors.push('Race time is negative');
    }

    return errors;
  }
}
```

---

## 方案4: 自动化冒烟测试（最简单）

**思路：** 只检查游戏能否正常启动和运行，不测试操控

**实现方式：**
```javascript
// smoke-test.js
async function smokeTest() {
  const errors = [];

  // 1. 检查页面加载
  const title = document.title;
  if (!title.includes('SU7')) {
    errors.push('Page title incorrect');
  }

  // 2. 检查关键元素
  const elements = ['startBtn', 'menu', 'map-select', 'hud', 'minimap'];
  for (const id of elements) {
    if (!document.getElementById(id)) {
      errors.push(`Element #${id} not found`);
    }
  }

  // 3. 检查游戏初始化
  if (!window.game) {
    errors.push('Game not initialized');
  } else {
    // 检查Three.js
    if (!window.game.renderer) {
      errors.push('Renderer not initialized');
    }

    // 检查物理世界
    if (!window.game.physicsWorld) {
      errors.push('Physics world not initialized');
    }
  }

  // 4. 检查控制台错误
  const consoleErrors = [];
  const originalError = console.error;
  console.error = (...args) => {
    consoleErrors.push(args.join(' '));
    originalError.apply(console, args);
  };

  // 等待一段时间
  await new Promise(r => setTimeout(r, 3000));

  console.error = originalError;

  if (consoleErrors.length > 0) {
    errors.push(`Console errors: ${consoleErrors.join(', ')}`);
  }

  return errors;
}
```

---

## 推荐方案

### 对于你的需求（让AI调试游戏能否正常进行）

**最佳方案：方案1 + 方案3 组合**

1. **让现有AI自动玩**（方案1）
   - 游戏已经有AIController
   - 直接让AI跑完整比赛
   - 不需要实时操控

2. **同时进行状态检查**（方案3）
   - 每帧检查物理状态
   - 检查位置、速度是否异常
   - 检查是否有控制台错误

3. **记录测试结果**
   - 记录每帧的状态
   - 生成测试报告
   - 发现异常时报警

**实现示例：**
```javascript
// 自动测试函数
async function autoTest(trackIndex = 0) {
  const tester = new GameTester(game);

  // 选择赛道
  game.selectedTrackId = TRACKS[trackIndex].id;
  game.buildSelectedTrack();

  // 等待比赛开始
  await waitForState('RACING');

  // 让AI自动玩
  const startTime = Date.now();
  const maxDuration = 300000; // 最多5分钟

  while (game.raceManager.state === 'RACING' &&
         Date.now() - startTime < maxDuration) {

    // 检查异常
    const error = tester.hasError();
    if (error) {
      console.error('Test failed:', error);
      return { success: false, error };
    }

    // 等待下一帧
    await new Promise(r => setTimeout(r, 100));
  }

  // 检查是否完赛
  if (game.raceManager.state === 'FINISHED') {
    return { success: true, time: game.raceManager.time };
  } else {
    return { success: false, error: 'Race did not finish' };
  }
}
```

---

## 总结

| 方案 | 适用场景 | 复杂度 | 推荐度 |
|------|----------|--------|--------|
| 方案1: 利用现有AI | 检测物理/逻辑错误 | 低 | ⭐⭐⭐⭐⭐ |
| 方案2: 输入回放 | 回归测试 | 中 | ⭐⭐⭐ |
| 方案3: 状态检查 | 实时监控异常 | 低 | ⭐⭐⭐⭐ |
| 方案4: 冒烟测试 | 快速验证启动 | 最低 | ⭐⭐⭐⭐⭐ |

**结论：** 不要用AI实时操控，而是让现有AI自动玩 + 状态检查。
