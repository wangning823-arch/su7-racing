/**
 * GameTestHelper - 游戏自动化测试助手
 *
 * 提供模拟玩家操作、状态检查、截图等功能
 */

export class GameTestHelper {
  constructor(page) {
    this.page = page;
    this.baseUrl = 'http://localhost:3000'; // 默认本地服务器地址
    this.screenshotDir = './reports/screenshots';
  }

  /**
   * 设置基础URL
   */
  setBaseUrl(url) {
    this.baseUrl = url;
  }

  /**
   * 打开游戏页面
   */
  async openGame() {
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' });
    await this.page.waitForSelector('#startBtn', { visible: true });
    return this;
  }

  /**
   * 等待游戏加载完成
   */
  async waitForGameLoad() {
    // 等待加载动画消失或开始按钮可用
    await this.page.waitForFunction(() => {
      const startBtn = document.getElementById('startBtn');
      return startBtn && !startBtn.disabled;
    }, { timeout: 30000 });
    return this;
  }

  /**
   * 点击开始按钮
   */
  async clickStart() {
    await this.page.click('#startBtn');
    await this.page.waitForSelector('#map-select', { visible: true });
    return this;
  }

  /**
   * 选择赛道
   * @param {number} index - 赛道索引（从0开始）
   */
  async selectTrack(index = 0) {
    const cards = await this.page.$$('.map-card');
    if (cards.length > index) {
      await cards[index].click();
      // 等待赛道加载和比赛开始
      await this.page.waitForFunction(() => {
        const game = window.game;
        return game && game.running;
      }, { timeout: 30000 });
    }
    return this;
  }

  /**
   * 获取游戏状态
   */
  async getGameState() {
    return await this.page.evaluate(() => {
      const game = window.game;
      if (!game) return null;

      return {
        running: game.running,
        raceState: game.raceManager?.state,
        playerPosition: game.player?.position,
        playerSpeed: game.player?.physics?.chassisBody?.velocity
          ? Math.sqrt(
              game.player.physics.chassisBody.velocity.x ** 2 +
              game.player.physics.chassisBody.velocity.z ** 2
            )
          : 0,
        playerFinished: game.player?.finished,
        lap: game.player?.currentLap,
        raceTime: game.raceManager?.time,
        kartsCount: game.karts?.length,
        aiCount: game.aiControllers?.length
      };
    });
  }

  /**
   * 获取玩家位置（spline参数）
   */
  async getPlayerSplineT() {
    return await this.page.evaluate(() => {
      return window.game?.player?.physics?.currentSplineT || 0;
    });
  }

  /**
   * 获取玩家位置坐标
   */
  async getPlayerPosition() {
    return await this.page.evaluate(() => {
      const body = window.game?.player?.physics?.chassisBody;
      if (!body) return null;
      return {
        x: body.position.x,
        y: body.position.y,
        z: body.position.z
      };
    });
  }

  // ==================== 模拟输入 ====================

  /**
   * 按下键盘键
   */
  async pressKey(key) {
    await this.page.keyboard.down(key);
    return this;
  }

  /**
   * 释放键盘键
   */
  async releaseKey(key) {
    await this.page.keyboard.up(key);
    return this;
  }

  /**
   * 模拟加速（按住W）
   * @param {number} duration - 持续时间（毫秒）
   */
  async accelerate(duration = 1000) {
    await this.pressKey('KeyW');
    await this.delay(duration);
    await this.releaseKey('KeyW');
    return this;
  }

  /**
   * 模拟刹车（按住S）
   */
  async brake(duration = 1000) {
    await this.pressKey('KeyS');
    await this.delay(duration);
    await this.releaseKey('KeyS');
    return this;
  }

  /**
   * 模拟向左转向
   */
  async steerLeft(duration = 500) {
    await this.pressKey('KeyA');
    await this.delay(duration);
    await this.releaseKey('KeyA');
    return this;
  }

  /**
   * 模拟向右转向
   */
  async steerRight(duration = 500) {
    await this.pressKey('KeyD');
    await this.delay(duration);
    await this.releaseKey('KeyD');
    return this;
  }

  /**
   * 模拟漂移
   */
  async drift(duration = 1000) {
    await this.pressKey('Space');
    await this.delay(duration);
    await this.releaseKey('Space');
    return this;
  }

  /**
   * 模拟完整驾驶动作：加速 + 转向 + 漂移
   */
  async simulateDriving(duration = 5000) {
    // 先加速
    await this.pressKey('KeyW');

    // 持续驾驶，偶尔转向和漂移
    const startTime = Date.now();
    while (Date.now() - startTime < duration) {
      const action = Math.random();

      if (action < 0.3) {
        // 30%概率转向
        await this.pressKey(Math.random() > 0.5 ? 'KeyA' : 'KeyD');
        await this.delay(200);
        await this.releaseKey(Math.random() > 0.5 ? 'KeyA' : 'KeyD');
      } else if (action < 0.4) {
        // 10%概率漂移
        await this.pressKey('Space');
        await this.delay(300);
        await this.releaseKey('Space');
      }

      await this.delay(100);
    }

    await this.releaseKey('KeyW');
    return this;
  }

  /**
   * 模拟绕赛道一圈的驾驶
   * 使用Pure Pursuit算法的简化版本
   */
  async simulateLap() {
    // 获取初始位置
    const startPos = await this.getPlayerPosition();
    const startSplineT = await this.getPlayerSplineT();

    // 加速开始
    await this.pressKey('KeyW');

    let lapComplete = false;
    let lastSplineT = startSplineT;
    let lapDetected = false;

    // 最多运行120秒
    const maxDuration = 120000;
    const startTime = Date.now();

    while (!lapComplete && Date.now() - startTime < maxDuration) {
      // 获取当前spline位置
      const currentSplineT = await this.getPlayerSplineT();

      // 检测是否完成一圈（spline从接近1回到接近0）
      if (lastSplineT > 0.9 && currentSplineT < 0.1) {
        lapDetected = true;
      }

      if (lapDetected && currentSplineT > 0.1 && currentSplineT < 0.3) {
        lapComplete = true;
        break;
      }

      // 获取速度和位置
      const state = await this.getGameState();
      const speed = state.playerSpeed;

      // 根据速度调整转向策略
      // 这里可以使用更复杂的Pure Pursuit算法
      const targetSplineT = (currentSplineT + 0.02) % 1;

      // 简化的转向控制
      await this.delay(50);

      lastSplineT = currentSplineT;
    }

    await this.releaseKey('KeyW');
    return lapComplete;
  }

  // ==================== 状态检查 ====================

  /**
   * 检查游戏是否正常运行
   */
  async isGameRunning() {
    const state = await this.getGameState();
    return state?.running === true;
  }

  /**
   * 检查比赛是否已开始
   */
  async isRaceStarted() {
    const state = await this.getGameState();
    return state?.raceState === 'RACING';
  }

  /**
   * 检查比赛是否已结束
   */
  async isRaceFinished() {
    const state = await this.getGameState();
    return state?.raceState === 'FINISHED';
  }

  /**
   * 检查玩家是否已完赛
   */
  async isPlayerFinished() {
    const state = await this.getGameState();
    return state?.playerFinished === true;
  }

  /**
   * 等待比赛开始
   */
  async waitForRaceStart(timeout = 30000) {
    await this.page.waitForFunction(() => {
      const game = window.game;
      return game?.raceManager?.state === 'RACING';
    }, { timeout });
    return this;
  }

  /**
   * 等待比赛结束
   */
  async waitForRaceEnd(timeout = 300000) {
    await this.page.waitForFunction(() => {
      const game = window.game;
      return game?.raceManager?.state === 'FINISHED';
    }, { timeout });
    return this;
  }

  // ==================== 截图和报告 ====================

  /**
   * 截图并保存
   */
  async takeScreenshot(name) {
    const timestamp = Date.now();
    const filename = `${this.screenshotDir}/${name}_${timestamp}.png`;
    await this.page.screenshot({ path: filename, fullPage: true });
    return filename;
  }

  /**
   * 获取游戏性能数据
   */
  async getPerformanceMetrics() {
    return await this.page.evaluate(() => {
      const game = window.game;
      if (!game) return null;

      // 获取渲染器信息
      const rendererInfo = game.renderer?.info;

      return {
        fps: game.clock?.getDelta() ? 1 / game.clock.getDelta() : 0,
        renderer: {
          calls: rendererInfo?.render?.calls || 0,
          triangles: rendererInfo?.render?.triangles || 0,
          points: rendererInfo?.render?.points || 0,
          lines: rendererInfo?.render?.lines || 0
        },
        memory: {
          geometries: rendererInfo?.memory?.geometries || 0,
          textures: rendererInfo?.memory?.textures || 0
        }
      };
    });
  }

  /**
   * 获取控制台错误
   */
  async getConsoleErrors() {
    const errors = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    return errors;
  }

  // ==================== 工具方法 ====================

  /**
   * 延迟
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 执行JavaScript代码
   */
  async evaluate(fn) {
    return await this.page.evaluate(fn);
  }
}

export default GameTestHelper;
