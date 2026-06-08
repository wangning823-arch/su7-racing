/**
 * 单赛道测试脚本
 *
 * 用法：node test/run-test.js <trackId>
 * 示例：node test/run-test.js f1-shanghai
 *
 * 输出：JSON格式的测试结果
 */

import { PuppeteerTest } from './puppeteer-test.js';
import fs from 'fs/promises';

async function runTest() {
  const trackId = process.argv[2];

  if (!trackId) {
    console.error('用法: node test/run-test.js <trackId>');
    console.error('示例: node test/run-test.js f1-shanghai');
    process.exit(1);
  }

  const test = new PuppeteerTest();

  try {
    console.log(`\n🏁 测试赛道: ${trackId}\n`);

    // 启动浏览器
    await test.setup();

    // 加载游戏
    await test.loadGame();

    // 选择赛道
    await test.selectTrack(trackId);

    // 监控AI状态（最长5分钟）
    const result = await test.monitorAI(trackId, 300000);

    // 输出JSON结果
    console.log('\n📊 测试结果:');
    if (result.screenshot) {
      console.log(`📸 截图: ${result.screenshot}`);
    }
    console.log(JSON.stringify(result, null, 2));

    // 保存结果到文件
    await fs.writeFile(
      '/root/users/admin/projects/su7-racing/test/test-result.json',
      JSON.stringify(result, null, 2)
    );

    console.log(`\n${result.passed ? '✅ 测试通过' : '❌ 测试失败'}`);

    // 返回退出码
    process.exit(result.passed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ 测试出错:', error.message);
    console.error(JSON.stringify({
      passed: false,
      reason: 'error',
      error: error.message
    }));
    process.exit(1);
  } finally {
    await test.teardown();
  }
}

runTest();
