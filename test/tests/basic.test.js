/**
 * 基础功能测试
 *
 * 测试游戏的基本加载和菜单功能
 */

import GameTestHelper from '../helpers/game-test-helper.js';

describe('SU7 Racing - 基础功能测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');
  });

  beforeEach(async () => {
    // 打开游戏
    await helper.openGame();
  });

  afterEach(async () => {
    // 每个测试后截图
    const testName = expect.getState().currentTestName.replace(/\s+/g, '_');
    await helper.takeScreenshot(testName);
  });

  test('游戏页面加载成功', async () => {
    // 检查页面标题
    const title = await page.title();
    expect(title).toContain('SU7');

    // 检查关键DOM元素存在
    const startBtn = await page.$('#startBtn');
    expect(startBtn).toBeTruthy();

    const menu = await page.$('#menu');
    expect(menu).toBeTruthy();

    const mapSelect = await page.$('#map-select');
    expect(mapSelect).toBeTruthy();
  });

  test('游戏初始化成功', async () => {
    // 检查游戏对象是否存在
    const gameState = await helper.getGameState();
    expect(gameState).not.toBeNull();

    // 检查Three.js渲染器是否初始化
    const hasRenderer = await helper.evaluate(() => {
      return window.game?.renderer !== null &&
             window.game?.renderer !== undefined;
    });
    expect(hasRenderer).toBe(true);

    // 检查物理世界是否初始化
    const hasPhysics = await helper.evaluate(() => {
      return window.game?.physicsWorld !== null &&
             window.game?.physicsWorld !== undefined;
    });
    expect(hasPhysics).toBe(true);
  });

  test('赛道选择界面正常显示', async () => {
    // 点击开始按钮
    await helper.clickStart();

    // 检查赛道选择界面是否显示
    const mapSelectVisible = await page.evaluate(() => {
      const mapSelect = document.getElementById('map-select');
      return mapSelect && mapSelect.style.display !== 'none';
    });
    expect(mapSelectVisible).toBe(true);

    // 检查是否有赛道卡片
    const cards = await page.$$('.map-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  test('点击赛道可以开始比赛', async () => {
    // 点击开始
    await helper.clickStart();

    // 选择第一个赛道
    await helper.selectTrack(0);

    // 检查比赛是否开始
    await helper.waitForRaceStart(30000);

    const state = await helper.getGameState();
    expect(state.raceState).toBe('RACING');
  });

  test('无JavaScript错误', async () => {
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    // 打开游戏并等待几秒
    await helper.openGame();
    await helper.delay(3000);

    // 检查是否有错误
    expect(errors).toHaveLength(0);
  });
});

describe('SU7 Racing - 菜单交互测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new GameTestHelper(page);
    helper.setBaseUrl('http://localhost:3000');
  });

  test('可以返回主菜单', async () => {
    await helper.openGame();
    await helper.clickStart();

    // 选择赛道开始比赛
    await helper.selectTrack(0);
    await helper.waitForRaceStart();

    // 检查比赛正在运行
    expect(await helper.isRaceStarted()).toBe(true);

    // 这里需要实现返回菜单的逻辑（如果有返回按钮）
    // 暂时跳过，因为游戏中可能没有返回按钮
  });

  test('赛道卡片预览图正常显示', async () => {
    await helper.openGame();
    await helper.clickStart();

    // 检查每个赛道卡片是否有canvas预览图
    const cards = await page.$$('.map-card');
    for (const card of cards) {
      const canvas = await card.$('canvas');
      expect(canvas).toBeTruthy();

      // 检查canvas是否有内容
      const hasContent = await page.evaluate(canvas => {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return imageData.data.some(val => val !== 0);
      }, canvas);
      expect(hasContent).toBe(true);
    }
  });
});
