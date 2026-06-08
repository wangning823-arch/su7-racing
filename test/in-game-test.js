/**
 * 游戏内测试模式
 *
 * 这个文件提供了游戏内测试功能，可以直接在浏览器中运行测试。
 * 使用方法：
 * 1. 打开游戏页面
 * 2. 在控制台中运行：game.test.startTest('drift')
 * 3. 查看测试结果
 */

export class InGameTest {
  constructor(game) {
    this.game = game;
    this.results = [];
    this.isRunning = false;
    this.currentTest = null;
  }

  /**
   * 开始测试
   */
  async startTest(testName) {
    if (this.isRunning) {
      console.warn('Test already running');
      return;
    }

    this.isRunning = true;
    this.currentTest = testName;
    this.results = [];

    console.log(`Starting test: ${testName}`);

    try {
      switch (testName) {
        case 'acceleration':
          await this.testAcceleration();
          break;
        case 'braking':
          await this.testBraking();
          break;
        case 'steering':
          await this.testSteering();
          break;
        case 'drift':
          await this.testDrift();
          break;
        case 'lap':
          await this.testLap();
          break;
        case 'stability':
          await this.testStability();
          break;
        default:
          console.error(`Unknown test: ${testName}`);
      }
    } catch (error) {
      console.error('Test failed:', error);
      this.results.push({
        test: testName,
        status: 'FAIL',
        error: error.message
      });
    }

    this.isRunning = false;
    this.currentTest = null;

    console.log('Test completed:', this.results);
    return this.results;
  }

  /**
   * 测试加速
   */
  async testAcceleration() {
    const player = this.game.player;
    if (!player) throw new Error('Player not found');

    // 获取初始速度
    const initialSpeed = this.getPlayerSpeed();

    // 按住油门
    this.game.input.keys['KeyW'] = true;
    await this.delay(2000);
    this.game.input.keys['KeyW'] = false;

    // 获取加速后的速度
    const finalSpeed = this.getPlayerSpeed();

    const passed = finalSpeed > initialSpeed;
    this.results.push({
      test: 'acceleration',
      status: passed ? 'PASS' : 'FAIL',
      details: {
        initialSpeed,
        finalSpeed,
        difference: finalSpeed - initialSpeed
      }
    });

    return passed;
  }

  /**
   * 测试刹车
   */
  async testBraking() {
    const player = this.game.player;
    if (!player) throw new Error('Player not found');

    // 先加速
    this.game.input.keys['KeyW'] = true;
    await this.delay(2000);
    this.game.input.keys['KeyW'] = false;

    const speedBeforeBrake = this.getPlayerSpeed();

    // 刹车
    this.game.input.keys['KeyS'] = true;
    await this.delay(1000);
    this.game.input.keys['KeyS'] = false;

    const speedAfterBrake = this.getPlayerSpeed();

    const passed = speedAfterBrake < speedBeforeBrake;
    this.results.push({
      test: 'braking',
      status: passed ? 'PASS' : 'FAIL',
      details: {
        speedBeforeBrake,
        speedAfterBrake,
        difference: speedBeforeBrake - speedAfterBrake
      }
    });

    return passed;
  }

  /**
   * 测试转向
   */
  async testSteering() {
    const player = this.game.player;
    if (!player) throw new Error('Player not found');

    const initialPos = this.getPlayerPosition();

    // 加速并转向
    this.game.input.keys['KeyW'] = true;
    this.game.input.keys['KeyA'] = true;
    await this.delay(1000);
    this.game.input.keys['KeyA'] = false;
    this.game.input.keys['KeyW'] = false;

    const finalPos = this.getPlayerPosition();

    // 位置应该改变
    const posChanged = initialPos.x !== finalPos.x || initialPos.z !== finalPos.z;

    this.results.push({
      test: 'steering',
      status: posChanged ? 'PASS' : 'FAIL',
      details: {
        initialPos,
        finalPos,
        posChanged
      }
    });

    return posChanged;
  }

  /**
   * 测试漂移
   */
  async testDrift() {
    const player = this.game.player;
    if (!player) throw new Error('Player not found');

    // 先加速
    this.game.input.keys['KeyW'] = true;
    await this.delay(2000);

    // 转向
    this.game.input.keys['KeyD'] = true;
    await this.delay(500);

    // 启动漂移
    this.game.input.keys['Space'] = true;
    await this.delay(1000);

    // 检查漂移状态
    const isDrifting = player.physics.isDrifting;

    // 检查横向速度
    const lateralVelocity = this.getLateralVelocity();

    this.game.input.keys['Space'] = false;
    this.game.input.keys['KeyD'] = false;
    this.game.input.keys['KeyW'] = false;

    const passed = isDrifting && Math.abs(lateralVelocity) > 1;
    this.results.push({
      test: 'drift',
      status: passed ? 'PASS' : 'FAIL',
      details: {
        isDrifting,
        lateralVelocity
      }
    });

    return passed;
  }

  /**
   * 测试完整一圈
   */
  async testLap() {
    const player = this.game.player;
    if (!player) throw new Error('Player not found');

    const startSplineT = player.physics.currentSplineT;
    const startTime = Date.now();

    // 加速并自动驾驶
    this.game.input.keys['KeyW'] = true;

    let lapCompleted = false;
    let lastSplineT = startSplineT;
    let crossZero = false;

    // 最多运行120秒
    while (Date.now() - startTime < 120000) {
      await this.delay(100);

      const currentSplineT = player.physics.currentSplineT;

      // 检测是否经过0点
      if (lastSplineT > 0.9 && currentSplineT < 0.1) {
        crossZero = true;
      }

      // 检测是否完成一圈
      if (crossZero && currentSplineT > 0.1 && currentSplineT < 0.3) {
        lapCompleted = true;
        break;
      }

      lastSplineT = currentSplineT;
    }

    this.game.input.keys['KeyW'] = false;

    const duration = (Date.now() - startTime) / 1000;
    this.results.push({
      test: 'lap',
      status: lapCompleted ? 'PASS' : 'FAIL',
      details: {
        lapCompleted,
        duration: `${duration.toFixed(2)}s`,
        startSplineT,
        finalSplineT: player.physics.currentSplineT
      }
    });

    return lapCompleted;
  }

  /**
   * 稳定性测试
   */
  async testStability() {
    const player = this.game.player;
    if (!player) throw new Error('Player not found');

    const startTime = Date.now();
    let frameCount = 0;
    let errorCount = 0;

    // 监听错误
    const originalConsoleError = console.error;
    console.error = (...args) => {
      errorCount++;
      originalConsoleError.apply(console, args);
    };

    // 运行30秒
    this.game.input.keys['KeyW'] = true;

    while (Date.now() - startTime < 30000) {
      await this.delay(16); // ~60fps
      frameCount++;

      // 随机操作
      if (Math.random() < 0.1) {
        this.game.input.keys['KeyA'] = Math.random() > 0.5;
        this.game.input.keys['KeyD'] = !this.game.input.keys['KeyA'];
      }

      if (Math.random() < 0.05) {
        this.game.input.keys['Space'] = Math.random() > 0.5;
      }
    }

    this.game.input.keys['KeyW'] = false;
    this.game.input.keys['KeyA'] = false;
    this.game.input.keys['KeyD'] = false;
    this.game.input.keys['Space'] = false;

    console.error = originalConsoleError;

    const duration = (Date.now() - startTime) / 1000;
    const passed = errorCount === 0 && this.game.running;

    this.results.push({
      test: 'stability',
      status: passed ? 'PASS' : 'FAIL',
      details: {
        duration: `${duration.toFixed(2)}s`,
        frameCount,
        errorCount,
        gameRunning: this.game.running
      }
    });

    return passed;
  }

  // ==================== 工具方法 ====================

  getPlayerSpeed() {
    const body = this.game.player?.physics?.chassisBody;
    if (!body) return 0;
    return Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
  }

  getPlayerPosition() {
    const body = this.game.player?.physics?.chassisBody;
    if (!body) return { x: 0, y: 0, z: 0 };
    return {
      x: body.position.x,
      y: body.position.y,
      z: body.position.z
    };
  }

  getLateralVelocity() {
    const body = this.game.player?.physics?.chassisBody;
    if (!body) return 0;

    const heading = this.game.player.physics.heading;
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);

    // 计算横向速度
    const lateral = body.velocity.x * (-forwardZ) + body.velocity.z * forwardX;
    return lateral;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取测试报告
   */
  getReport() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    return {
      total: this.results.length,
      passed,
      failed,
      results: this.results
    };
  }
}

// 在浏览器中暴露测试接口
if (typeof window !== 'undefined') {
  window.InGameTest = InGameTest;
}
