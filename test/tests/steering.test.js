/**
 * 操控测试
 *
 * 测试玩家输入响应：加速、刹车、转向
 */

import GameTestHelper from '../helpers/game-test-helper.js';

describe('SU7 Racing - 加速测试', () => {
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

  test('按下W键可以加速', async () => {
    // 获取初始速度
    const initialSpeed = (await helper.getGameState()).playerSpeed;

    // 按住W加速2秒
    await helper.accelerate(2000);

    // 获取加速后的速度
    const finalSpeed = (await helper.getGameState()).playerSpeed;

    // 速度应该增加
    expect(finalSpeed).toBeGreaterThan(initialSpeed);
  });

  test('速度应该在合理范围内', async () => {
    // 加速3秒
    await helper.accelerate(3000);

    const state = await helper.getGameState();

    // 速度应该在0-300之间（单位取决于游戏实现）
    expect(state.playerSpeed).toBeGreaterThanOrEqual(0);
    expect(state.playerSpeed).toBeLessThanOrEqual(300);
  });

  test('松开油门后应该减速', async () => {
    // 先加速
    await helper.accelerate(2000);
    const speedAfterAccel = (await helper.getGameState()).playerSpeed;

    // 等待2秒不按任何键
    await helper.delay(2000);

    // 获取当前速度
    const speedAfterCoast = (await helper.getGameState()).playerSpeed;

    // 速度应该降低（由于空气阻力和滚动阻力）
    expect(speedAfterCoast).toBeLessThan(speedAfterAccel);
  });
});

describe('SU7 Racing - 刹车测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');

    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 先加速到一定速度
    await helper.accelerate(3000);
  });

  test('按下S键可以刹车', async () => {
    // 获取刹车前的速度
    const speedBefore = (await helper.getGameState()).playerSpeed;

    // 刹车1秒
    await helper.brake(1000);

    // 获取刹车后的速度
    const speedAfter = (await helper.getGameState()).playerSpeed;

    // 速度应该降低
    expect(speedAfter).toBeLessThan(speedBefore);
  });

  test('刹车应该能让车停下来', async () => {
    // 持续刹车
    await helper.brake(5000);

    const state = await helper.getGameState();

    // 速度应该很低或为0
    expect(state.playerSpeed).toBeLessThan(10);
  });
});

describe('SU7 Racing - 转向测试', () => {
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

  test('按下A键可以向左转', async () => {
    // 获取初始位置
    const initialPos = await helper.getPlayerPosition();
    const initialSplineT = await helper.getPlayerSplineT();

    // 加速并左转
    await helper.pressKey('KeyW');
    await helper.steerLeft(1000);
    await helper.releaseKey('KeyW');

    // 获取转向后的位置
    const finalPos = await helper.getPlayerPosition();

    // 位置应该改变
    expect(finalPos.x).not.toBe(initialPos.x);
    expect(finalPos.z).not.toBe(initialPos.z);
  });

  test('按下D键可以向右转', async () => {
    // 获取初始位置
    const initialPos = await helper.getPlayerPosition();

    // 加速并右转
    await helper.pressKey('KeyW');
    await helper.steerRight(1000);
    await helper.releaseKey('KeyW');

    // 获取转向后的位置
    const finalPos = await helper.getPlayerPosition();

    // 位置应该改变
    expect(finalPos.x).not.toBe(initialPos.x);
    expect(finalPos.z).not.toBe(initialPos.z);
  });

  test('转向应该影响spline位置', async () => {
    // 获取初始spline位置
    const initialSplineT = await helper.getPlayerSplineT();

    // 加速并转向
    await helper.pressKey('KeyW');
    await helper.steerLeft(2000);
    await helper.releaseKey('KeyW');

    // 获取转向后的spline位置
    const finalSplineT = await helper.getPlayerSplineT();

    // spline位置应该改变
    expect(finalSplineT).not.toBe(initialSplineT);
  });
});

describe('SU7 Racing - 组合操控测试', () => {
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

  test('同时加速和转向', async () => {
    const initialPos = await helper.getPlayerPosition();

    // 同时按住W和A
    await helper.pressKey('KeyW');
    await helper.pressKey('KeyA');
    await helper.delay(1000);
    await helper.releaseKey('KeyA');
    await helper.releaseKey('KeyW');

    const finalPos = await helper.getPlayerPosition();

    // 位置应该改变
    expect(finalPos.x).not.toBe(initialPos.x);
    expect(finalPos.z).not.toBe(initialPos.z);
  });

  test('转向时速度应该保持', async () => {
    // 先加速
    await helper.accelerate(2000);
    const speedBeforeTurn = (await helper.getGameState()).playerSpeed;

    // 转向时继续加速
    await helper.pressKey('KeyW');
    await helper.steerLeft(1000);
    await helper.releaseKey('KeyW');

    const speedAfterTurn = (await helper.getGameState()).playerSpeed;

    // 速度应该保持（不会大幅下降）
    // 允许20%的误差
    expect(speedAfterTurn).toBeGreaterThan(speedBeforeTurn * 0.8);
  });
});
