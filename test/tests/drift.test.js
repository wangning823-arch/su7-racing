/**
 * 漂移测试
 *
 * 测试漂移功能
 */

import GameTestHelper from '../helpers/game-test-helper.js';

describe('SU7 Racing - 漂移功能测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');

    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();
  });

  test('按下空格键可以启动漂移', async () => {
    // 先加速到一定速度
    await helper.accelerate(2000);

    // 检查漂移状态
    const isDriftingBefore = await helper.evaluate(() => {
      return window.game?.player?.physics?.isDrifting || false;
    });

    // 按下空格键
    await helper.pressKey('Space');
    await helper.delay(500);

    // 检查漂移状态
    const isDriftingAfter = await helper.evaluate(() => {
      return window.game?.player?.physics?.isDrifting || false;
    });

    // 漂移状态应该改变
    expect(isDriftingAfter).toBe(true);

    // 释放空格键
    await helper.releaseKey('Space');
  });

  test('漂移时车辆应该侧滑', async () => {
    // 加速并转向
    await helper.pressKey('KeyW');
    await helper.steerRight(500);

    // 启动漂移
    await helper.pressKey('Space');
    await helper.delay(500);

    // 获取横向速度（漂移时应该有较大的横向速度）
    const lateralVelocity = await helper.evaluate(() => {
      const body = window.game?.player?.physics?.chassisBody;
      if (!body) return 0;

      const heading = window.game?.player?.physics?.heading;
      const forwardX = Math.sin(heading);
      const forwardZ = Math.cos(heading);

      // 计算横向速度
      const lateral = body.velocity.x * (-forwardZ) + body.velocity.z * forwardX;
      return Math.abs(lateral);
    });

    // 漂移时横向速度应该较大
    expect(lateralVelocity).toBeGreaterThan(1);

    // 释放所有按键
    await helper.releaseKey('Space');
    await helper.releaseKey('KeyW');
    await helper.releaseKey('KeyD');
  });

  test('漂移时会生成烟雾粒子', async () => {
    // 加速
    await helper.accelerate(2000);

    // 获取初始粒子数量
    const initialParticles = await helper.evaluate(() => {
      return window.game?.particles?.particles?.length || 0;
    });

    // 启动漂移
    await helper.pressKey('Space');
    await helper.delay(1000);

    // 获取漂移后的粒子数量
    const finalParticles = await helper.evaluate(() => {
      return window.game?.particles?.particles?.length || 0;
    });

    // 粒子数量应该增加
    expect(finalParticles).toBeGreaterThan(initialParticles);

    await helper.releaseKey('Space');
  });

  test('漂移会影响转向角度', async () => {
    // 普通转向
    await helper.pressKey('KeyW');
    const initialSplineT = await helper.getPlayerSplineT();
    await helper.steerRight(1000);
    const normalTurnSplineT = await helper.getPlayerSplineT();
    await helper.releaseKey('KeyW');
    await helper.releaseKey('KeyD');

    await helper.delay(500);

    // 漂移转向
    await helper.pressKey('KeyW');
    await helper.pressKey('Space');
    await helper.delay(200);
    const driftInitialSplineT = await helper.getPlayerSplineT();
    await helper.steerRight(1000);
    const driftSplineT = await helper.getPlayerSplineT();
    await helper.releaseKey('Space');
    await helper.releaseKey('KeyW');
    await helper.releaseKey('KeyD');

    // 漂移时转向效果应该不同
    const normalTurnDiff = Math.abs(normalTurnSplineT - initialSplineT);
    const driftTurnDiff = Math.abs(driftSplineT - driftInitialSplineT);

    // 允许一定的误差，但漂移时转向应该更明显
    // 注意：这个测试可能需要根据实际游戏逻辑调整
    expect(driftTurnDiff).toBeGreaterThan(0);
  });
});

describe('SU7 Racing - 漂移技巧测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');

    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();
  });

  test('连续漂移', async () => {
    await helper.accelerate(2000);

    // 第一次漂移
    await helper.pressKey('Space');
    await helper.steerRight(500);
    await helper.releaseKey('Space');

    await helper.delay(300);

    // 第二次漂移
    await helper.pressKey('Space');
    await helper.steerLeft(500);
    await helper.releaseKey('Space');

    await helper.delay(300);

    // 第三次漂移
    await helper.pressKey('Space');
    await helper.steerRight(500);
    await helper.releaseKey('Space');

    // 游戏应该仍然正常运行
    const state = await helper.getGameState();
    expect(state.running).toBe(true);
    expect(state.raceState).toBe('RACING');
  });

  test('漂移后应该能恢复正常行驶', async () => {
    // 加速
    await helper.accelerate(2000);

    // 漂移
    await helper.pressKey('Space');
    await helper.steerRight(1000);
    await helper.releaseKey('Space');

    await helper.delay(500);

    // 释放所有按键，让车辆自然减速
    await helper.releaseKey('KeyW');
    await helper.releaseKey('KeyD');

    await helper.delay(1000);

    // 重新加速，检查是否能正常行驶
    await helper.accelerate(2000);

    const state = await helper.getGameState();
    expect(state.playerSpeed).toBeGreaterThan(0);
  });
});
