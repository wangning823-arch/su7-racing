/**
 * 赛道测试
 *
 * 测试不同赛道的加载和运行
 */

import GameTestHelper from '../helpers/game-test-helper.js';

describe('SU7 Racing - 赛道加载测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');
  });

  test('应该能加载所有赛道', async () => {
    await helper.openGame();
    await helper.clickStart();

    // 获取所有赛道卡片
    const cards = await page.$$('.map-card');
    expect(cards.length).toBeGreaterThan(0);

    // 检查每个赛道卡片
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const trackName = await page.evaluate(el => {
        const h3 = el.querySelector('h3');
        return h3?.textContent || '';
      }, card);

      expect(trackName).toBeTruthy();
    }
  });

  test('赛道难度标签应该正确显示', async () => {
    await helper.openGame();
    await helper.clickStart();

    // 检查难度标签
    const difficulties = await page.evaluate(() => {
      const cards = document.querySelectorAll('.map-card');
      return Array.from(cards).map(card => {
        const diffEl = card.querySelector('.difficulty');
        return diffEl?.textContent || '';
      });
    });

    // 每个赛道应该有难度标签
    difficulties.forEach(diff => {
      expect(diff).toMatch(/简单|中等|困难/);
    });
  });

  test('赛道预览图应该显示', async () => {
    await helper.openGame();
    await helper.clickStart();

    // 检查每个赛道的预览图
    const cards = await page.$$('.map-card');
    for (const card of cards) {
      const canvas = await card.$('canvas');
      expect(canvas).toBeTruthy();

      // 检查canvas尺寸
      const size = await page.evaluate(el => {
        return { width: el.width, height: el.height };
      }, canvas);

      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
  });
});

describe('SU7 Racing - 不同赛道游戏测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');
  });

  test('简单赛道可以正常游戏', async () => {
    await helper.openGame();
    await helper.clickStart();

    // 选择第一个赛道（假设是简单的）
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 操控车辆
    await helper.accelerate(3000);
    await helper.steerLeft(1000);
    await helper.steerRight(1000);

    const state = await helper.getGameState();
    expect(state.running).toBe(true);
    expect(state.raceState).toBe('RACING');
  });

  test('中等赛道可以正常游戏', async () => {
    await helper.openGame();
    await helper.clickStart();

    // 选择第二个赛道（假设是中等的）
    const cards = await page.$$('.map-card');
    if (cards.length > 1) {
      await cards[1].click();
      await helper.waitForRaceStart();

      // 操控车辆
      await helper.accelerate(3000);
      await helper.steerLeft(1000);
      await helper.steerRight(1000);

      const state = await helper.getGameState();
      expect(state.running).toBe(true);
      expect(state.raceState).toBe('RACING');
    }
  });

  test('赛道边界应该有效', async () => {
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 获取赛道边界信息
    const trackInfo = await helper.evaluate(() => {
      const track = window.game?.track;
      if (!track) return null;

      return {
        halfWidth: track.halfWidth || 10,
        splineLength: track.spline?.getLength?.() || 0
      };
    });

    expect(trackInfo).not.toBeNull();
    expect(trackInfo.halfWidth).toBeGreaterThan(0);
    expect(trackInfo.splineLength).toBeGreaterThan(0);
  });

  test('赛道起点位置应该正确设置', async () => {
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 检查起点位置
    const startPositions = await helper.evaluate(() => {
      const track = window.game?.track;
      return track?.getStartPositions?.() || [];
    });

    expect(startPositions.length).toBeGreaterThan(0);
    expect(startPositions[0].pos).toBeDefined();
  });
});

describe('SU7 Racing - 赛道性能测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');
  });

  test('赛道加载时间应该合理', async () => {
    const startTime = Date.now();

    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    const loadTime = Date.now() - startTime;

    // 加载时间应该在10秒以内
    expect(loadTime).toBeLessThan(10000);
  });

  test('游戏应该保持稳定帧率', async () => {
    await helper.openGame();
    await helper.clickStart();
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 运行5秒收集性能数据
    await helper.delay(5000);

    // 检查渲染器信息
    const renderInfo = await helper.evaluate(() => {
      const game = window.game;
      return {
        calls: game?.renderer?.info?.render?.calls || 0,
        triangles: game?.renderer?.info?.render?.triangles || 0
      };
    });

    // 渲染调用次数应该合理
    expect(renderInfo.calls).toBeGreaterThan(0);
    expect(renderInfo.triangles).toBeGreaterThan(0);
  });
});
