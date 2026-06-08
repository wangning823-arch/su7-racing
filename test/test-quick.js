/**
 * 快速测试脚本
 * 测试 Puppeteer 是否能正常启动和加载游戏
 */

import { PuppeteerTest } from './puppeteer-test.js';

async function quickTest() {
  const test = new PuppeteerTest();

  try {
    console.log('=== 快速测试 ===');

    // 启动浏览器
    await test.setup();

    // 加载游戏
    await test.loadGame();

    // 检查游戏是否加载成功
    const gameLoaded = await test.page.evaluate(() => {
      return {
        hasGame: !!window.game,
        hasKarts: window.game?.karts !== undefined,
        running: window.game?.running
      };
    });

    console.log('游戏状态:', gameLoaded);

    if (gameLoaded.hasGame && gameLoaded.hasKarts) {
      console.log('✅ 快速测试通过！');
    } else {
      console.log('❌ 快速测试失败');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    await test.teardown();
  }
}

quickTest();
