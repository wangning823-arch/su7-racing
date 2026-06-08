/**
 * 游戏加载诊断测试 - 简化版
 *
 * 测试headless模式下游戏是否能正常加载和运行
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const GAME_URL = 'https://code2.wzx.homes/admin/su7-racing/';

async function diagnose() {
  console.log('🔍 游戏加载诊断测试\n');

  const screenshotDir = '/root/users/admin/projects/su7-racing/test/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-features=Vulkan',
      '--ignore-gpu-blocklist',
      '--window-size=1280,720'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // 收集所有日志
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Error') || text.includes('error')) {
      console.log(`  [Browser] ${text}`);
    }
  });

  page.on('pageerror', error => {
    console.error(`  [PageError] ${error.message}`);
  });

  try {
    // 1. 劫持rAF
    console.log('1️⃣  劫持requestAnimationFrame...');
    await page.evaluateOnNewDocument(() => {
      window._rAFCount = 0;
      window._rAFCallbacks = [];
      let timerId = null;

      window.requestAnimationFrame = function(callback) {
        window._rAFCallbacks.push(callback);
        if (!timerId) {
          timerId = setInterval(() => {
            window._rAFCount++;
            if (window._rAFCallbacks.length > 0) {
              const cbs = window._rAFCallbacks.splice(0);
              const now = performance.now();
              for (const cb of cbs) {
                try { cb(now); } catch(e) {}
              }
            }
          }, 16);
        }
        return window._rAFCallbacks.length;
      };
    });
    console.log('   ✅ 完成\n');

    // 2. 加载页面
    console.log('2️⃣  加载页面...');
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.waitForFunction('window.game && window.game.init', { timeout: 30000 });
    console.log('   ✅ 页面加载完成\n');

    // 3. 选择赛道
    console.log('3️⃣  选择赛道...');
    await page.evaluate(() => {
      window.game.showMapSelect();
      window.game.selectedTrackId = 'f1-shanghai';
      window.game.buildSelectedTrack();
    });
    console.log('   ✅ 赛道选择完成\n');

    // 4. 等待游戏运行（headless模式下游戏运行很慢）
    console.log('4️⃣  等待游戏运行（30秒）...');
    await new Promise(r => setTimeout(r, 30000));

    // 截图
    await page.screenshot({ path: `${screenshotDir}/after-30s.png` });
    console.log('   截图保存: after-30s.png\n');

    // 5. 检查游戏状态
    console.log('5️⃣  检查游戏状态...');
    const gameStatus = await page.evaluate(() => {
      const ai = window.game?.karts?.[1];
      return {
        running: window.game?.running,
        raceState: window.game?.raceManager?.state,
        countdown: window.game?.raceManager?.countdownTime,
        raceTime: window.game?.raceManager?.raceTime,
        rAFCount: window._rAFCount || 0,
        aiExists: !!ai,
        aiSpeed: ai?.physics?.speed || 0,
        aiSplineT: ai?.physics?.currentSplineT || 0,
        aiPosition: ai?.physics?.chassisBody?.position ? {
          x: ai.physics.chassisBody.position.x,
          z: ai.physics.chassisBody.position.z
        } : null
      };
    });
    console.log('   游戏状态:', gameStatus);
    console.log('');

    // 6. 再等待10秒
    console.log('6️⃣  再等待10秒...');
    await new Promise(r => setTimeout(r, 10000));

    // 截图
    await page.screenshot({ path: `${screenshotDir}/after-40s.png` });
    console.log('   截图保存: after-40s.png\n');

    // 7. 再次检查状态
    console.log('7️⃣  再次检查状态...');
    const gameStatus2 = await page.evaluate(() => {
      const ai = window.game?.karts?.[1];
      return {
        running: window.game?.running,
        raceState: window.game?.raceManager?.state,
        countdown: window.game?.raceManager?.countdownTime,
        raceTime: window.game?.raceManager?.raceTime,
        rAFCount: window._rAFCount || 0,
        aiSpeed: ai?.physics?.speed || 0,
        aiSplineT: ai?.physics?.currentSplineT || 0,
        aiPosition: ai?.physics?.chassisBody?.position ? {
          x: ai.physics.chassisBody.position.x,
          z: ai.physics.chassisBody.position.z
        } : null
      };
    });
    console.log('   游戏状态:', gameStatus2);
    console.log('');

    // 8. 总结
    console.log('8️⃣  总结...');
    if (gameStatus2.raceState === 'RACING' && gameStatus2.aiSpeed > 0) {
      console.log('\n✅ 游戏正常运行！AI正在移动。');
      console.log(`   AI速度: ${gameStatus2.aiSpeed.toFixed(2)}`);
      console.log(`   AI进度: ${(gameStatus2.aiSplineT * 100).toFixed(1)}%`);
    } else if (gameStatus2.raceState === 'COUNTDOWN') {
      console.log('\n⚠️  比赛仍在倒计时中。');
      console.log(`   倒计时: ${gameStatus2.countdown?.toFixed(2)}秒`);
    } else {
      console.log('\n❌ 游戏可能存在问题。');
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ 诊断出错:', error.message);
    await page.screenshot({ path: `${screenshotDir}/error.png` });
  } finally {
    await browser.close();
  }
}

diagnose();
