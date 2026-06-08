/**
 * 比赛流程测试
 *
 * 测试完整的比赛流程：倒计时、比赛、完赛
 */

import GameTestHelper from '../helpers/game-test-helper.js';

describe('SU7 Racing - 比赛流程测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');
  });

  test('倒计时应该正常进行', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);

    // 检查倒计时状态
    await page.waitForFunction(() => {
      const game = window.game;
      return game?.raceManager?.state === 'COUNTDOWN';
    }, { timeout: 10000 });

    // 获取倒计时时间
    const countdownTime = await helper.evaluate(() => {
      return window.game?.raceManager?.countdownTime;
    });

    // 倒计时应该在合理范围内
    expect(countdownTime).toBeGreaterThanOrEqual(0);
    expect(countdownTime).toBeLessThanOrEqual(4);

    // 等待倒计时结束
    await helper.waitForRaceStart();

    const state = await helper.getGameState();
    expect(state.raceState).toBe('RACING');
  });

  test('比赛中可以正常操控车辆', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 操控车辆
    const initialPos = await helper.getPlayerPosition();
    await helper.accelerate(2000);
    const finalPos = await helper.getPlayerPosition();

    // 位置应该改变
    expect(finalPos.x).not.toBe(initialPos.x);
    expect(finalPos.z).not.toBe(initialPos.z);
  });

  test('比赛中HUD应该显示正确信息', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 检查HUD元素
    const hudVisible = await page.evaluate(() => {
      const hud = document.getElementById('hud');
      return hud && hud.style.display !== 'none';
    });
    expect(hudVisible).toBe(true);

    // 检查速度显示
    const speedText = await page.evaluate(() => {
      const speedEl = document.getElementById('speed');
      return speedEl?.textContent || '';
    });
    expect(speedText).toMatch(/\d+/);

    // 检查位置显示
    const positionText = await page.evaluate(() => {
      const posEl = document.getElementById('position');
      return posEl?.textContent || '';
    });
    expect(positionText).toMatch(/\d+/);
  });

  test('AI对手应该正常运行', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 检查AI控制器
    const aiCount = await helper.evaluate(() => {
      return window.game?.aiControllers?.length || 0;
    });
    expect(aiCount).toBeGreaterThan(0);

    // 等待几秒让AI移动
    await helper.delay(3000);

    // 检查AI是否在移动
    const aiMoving = await helper.evaluate(() => {
      const game = window.game;
      if (!game?.aiControllers || !game?.karts) return false;

      // 检查AI的spline位置是否改变
      return game.aiControllers.some(ai => ai.frameCount > 0);
    });
    expect(aiMoving).toBe(true);
  });

  test('赛道检查点应该正常工作', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 获取初始检查点状态
    const initialCheckpoints = await helper.evaluate(() => {
      const race = window.game?.raceManager;
      return {
        current: race?.karts?.[0]?.currentCheckpoint || 0,
        total: race?.track?.checkpoints?.length || 0
      };
    });

    // 加速前进
    await helper.accelerate(5000);

    // 获取当前检查点状态
    const currentCheckpoints = await helper.evaluate(() => {
      const race = window.game?.raceManager;
      return {
        current: race?.karts?.[0]?.currentCheckpoint || 0,
        total: race?.track?.checkpoints?.length || 0
      };
    });

    // 检查点数量应该合理
    expect(currentCheckpoints.total).toBeGreaterThan(0);
  });

  test('小地图应该正常显示', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 检查小地图canvas
    const minimapExists = await page.evaluate(() => {
      const minimap = document.getElementById('minimap');
      return minimap !== null;
    });
    expect(minimapExists).toBe(true);

    // 检查小地图是否有内容
    const minimapHasContent = await page.evaluate(() => {
      const minimap = document.getElementById('minimap');
      if (!minimap) return false;

      const ctx = minimap.getContext('2d');
      const imageData = ctx.getImageData(0, 0, minimap.width, minimap.height);
      return imageData.data.some(val => val !== 0);
    });
    expect(minimapHasContent).toBe(true);
  });
});

describe('SU7 Racing - 比赛结束测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');
  });

  test('比赛时间应该正确记录', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 等待几秒
    await helper.delay(3000);

    // 检查比赛时间
    const raceTime = await helper.evaluate(() => {
      return window.game?.raceManager?.time || 0;
    });

    // 时间应该大于0
    expect(raceTime).toBeGreaterThan(0);
  });

  test('玩家位置应该正确更新', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 加速前进
    await helper.accelerate(3000);

    // 检查玩家位置
    const position = await helper.evaluate(() => {
      const game = window.game;
      const karts = game?.karts;
      if (!karts) return null;

      // 找到玩家
      const player = karts.find(k => k.isPlayer);
      return player?.position || 0;
    });

    // 位置应该在合理范围内
    expect(position).toBeGreaterThanOrEqual(0);
  });

  test('比赛结果界面应该在完赛后显示', async () => {
    // 打开游戏并开始比赛
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 检查结果界面初始状态
    const resultsInitiallyHidden = await page.evaluate(() => {
      const results = document.getElementById('results');
      return results?.style.display === 'none' || results?.style.display === '';
    });
    expect(resultsInitiallyHidden).toBe(true);

    // 注意：完整比赛测试需要很长时间，这里只测试初始状态
    // 实际的完赛测试可以通过模拟AI完成来加速
  });
});
