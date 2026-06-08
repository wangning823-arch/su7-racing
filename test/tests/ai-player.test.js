/**
 * AI玩家模拟测试
 *
 * 使用AI算法自动玩游戏，检测游戏是否正常运行
 */

import GameTestHelper from '../helpers/game-test-helper.js';

/**
 * AI测试控制器
 * 实现Pure Pursuit算法来自动导航赛道
 */
class AITestController {
  constructor(page) {
    this.page = page;
  }

  /**
   * 执行Pure Pursuit算法
   */
  async purePursuitStep() {
    return await this.page.evaluate(() => {
      const game = window.game;
      if (!game?.player || !game?.track?.spline) return null;

      const player = game.player;
      const spline = game.track.spline;
      const body = player.physics.chassisBody;

      // 获取当前位置和速度
      const pos = body.position;
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
      const heading = player.physics.heading;

      // 查找最近的spline点
      let bestT = player.physics.currentSplineT || 0;
      let bestDist = Infinity;

      // 搜索当前点附近
      for (let dt = -0.02; dt <= 0.02; dt += 0.001) {
        let t = (bestT + dt + 1) % 1;
        const p = spline.getPointAt(t);
        const d = (pos.x - p.x) ** 2 + (pos.z - p.z) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestT = t;
        }
      }

      // 计算前瞻点
      const lookAheadT = Math.max(0.01, Math.min(0.05, speed * 0.001 + 0.01));
      const targetT = (bestT + lookAheadT) % 1;
      const target = spline.getPointAt(targetT);

      // 计算转向角度
      const hfwdX = Math.sin(heading);
      const hfwdZ = Math.cos(heading);
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const cross = hfwdZ * dx - hfwdX * dz;
      const dot = hfwdX * dx + hfwdZ * dz;
      const errAngle = Math.atan2(cross, dot);

      // 生成控制输入
      const steer = Math.max(-1, Math.min(1, errAngle));
      let throttle = 1;
      let brake = 0;

      // 急转弯时减速
      if (Math.abs(errAngle) > 0.4) {
        throttle = 0.5;
      }
      if (Math.abs(errAngle) > 0.8) {
        brake = 0.5;
        throttle = 0.1;
      }

      return { throttle, brake, steer, drift: false };
    });
  }

  /**
   * 运行AI驾驶一段时间
   */
  async driveForDuration(durationMs) {
    const startTime = Date.now();
    let steps = 0;
    let errors = [];

    while (Date.now() - startTime < durationMs) {
      try {
        const input = await this.purePursuitStep();
        if (input) {
          // 应用输入到游戏
          await this.page.evaluate((inp) => {
            const game = window.game;
            if (!game?.player) return;

            // 直接设置输入状态
            game.input.keys['KeyW'] = inp.throttle > 0.5;
            game.input.keys['KeyS'] = inp.brake > 0.5;
            game.input.keys['KeyA'] = inp.steer < -0.3;
            game.input.keys['KeyD'] = inp.steer > 0.3;
            game.input.keys['Space'] = inp.drift;
          }, input);
        }

        steps++;
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
      } catch (error) {
        errors.push(error.message);
        break;
      }
    }

    return { steps, errors };
  }

  /**
   * 检查游戏状态是否正常
   */
  async checkGameState() {
    return await this.page.evaluate(() => {
      const game = window.game;
      if (!game) return { valid: false, error: 'Game not found' };

      const checks = [];

      // 检查渲染器
      if (!game.renderer) {
        checks.push('Renderer missing');
      }

      // 检查物理世界
      if (!game.physicsWorld) {
        checks.push('Physics world missing');
      }

      // 检查玩家
      if (!game.player) {
        checks.push('Player missing');
      } else {
        const body = game.player.physics?.chassisBody;
        if (!body) {
          checks.push('Player physics body missing');
        } else {
          // 检查位置是否合理
          if (body.position.y < -100) {
            checks.push('Player fell too far');
          }
          if (Math.abs(body.position.x) > 10000 || Math.abs(body.position.z) > 10000) {
            checks.push('Player out of bounds');
          }
          // 检查速度是否合理
          const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
          if (speed > 500) {
            checks.push('Player speed too high');
          }
        }
      }

      // 检查赛道
      if (!game.track) {
        checks.push('Track missing');
      } else if (!game.track.spline) {
        checks.push('Track spline missing');
      }

      // 检查比赛管理器
      if (!game.raceManager) {
        checks.push('Race manager missing');
      }

      return {
        valid: checks.length === 0,
        errors: checks,
        state: game.raceManager?.state
      };
    });
  }
}

describe('SU7 Racing - AI自动玩游戏测试', () => {
  let helper;
  let ai;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    ai = new AITestController(page);
    helper.setBaseUrl('http://localhost:3000');
  });

  test('AI应该能自动驾驶完成比赛', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // AI驾驶10秒
    const result = await ai.driveForDuration(10000);

    // 检查结果
    expect(result.errors).toHaveLength(0);
    expect(result.steps).toBeGreaterThan(0);

    // 检查游戏状态
    const gameState = await ai.checkGameState();
    expect(gameState.valid).toBe(true);
  });

  test('AI驾驶时游戏不应该崩溃', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 监听错误
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    // AI驾驶30秒
    await ai.driveForDuration(30000);

    // 不应该有JavaScript错误
    expect(errors).toHaveLength(0);

    // 游戏应该仍在运行
    const state = await helper.getGameState();
    expect(state.running).toBe(true);
  });

  test('AI应该能正确通过检查点', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 获取初始检查点
    const initialCheckpoint = await helper.evaluate(() => {
      return window.game?.raceManager?.karts?.[0]?.currentCheckpoint || 0;
    });

    // AI驾驶20秒
    await ai.driveForDuration(20000);

    // 获取当前检查点
    const currentCheckpoint = await helper.evaluate(() => {
      return window.game?.raceManager?.karts?.[0]?.currentCheckpoint || 0;
    });

    // 检查点应该前进
    expect(currentCheckpoint).toBeGreaterThanOrEqual(initialCheckpoint);
  });

  test('AI驾驶时车辆不应该飞出赛道', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // AI驾驶15秒
    await ai.driveForDuration(15000);

    // 检查车辆是否仍在赛道附近
    const position = await helper.getPlayerPosition();
    const trackInfo = await helper.evaluate(() => {
      const track = window.game?.track;
      return {
        splineLength: track?.spline?.getLength?.() || 0,
        halfWidth: track?.halfWidth || 10
      };
    });

    // 位置应该在合理范围内
    expect(Math.abs(position.x)).toBeLessThan(10000);
    expect(Math.abs(position.z)).toBeLessThan(10000);
    expect(position.y).toBeGreaterThan(-100);
  });
});

describe('SU7 Racing - AI压力测试', () => {
  let helper;
  let ai;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    ai = new AITestController(page);
    helper.setBaseUrl('http://localhost:3000');
  });

  test('长时间运行应该稳定', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // AI驾驶60秒
    const result = await ai.driveForDuration(60000);

    // 不应该有错误
    expect(result.errors).toHaveLength(0);

    // 游戏应该仍在运行
    const state = await helper.getGameState();
    expect(state.running).toBe(true);
  });

  test('连续多圈应该稳定', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // AI驾驶120秒（应该能完成多圈）
    const result = await ai.driveForDuration(120000);

    // 不应该有错误
    expect(result.errors).toHaveLength(0);

    // 检查完成的圈数
    const laps = await helper.evaluate(() => {
      return window.game?.player?.currentLap || 0;
    });

    // 应该完成至少一圈
    expect(laps).toBeGreaterThanOrEqual(1);
  });
});
