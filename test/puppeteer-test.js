/**
 * Puppeteer 自动化测试核心 - v3
 *
 * 基于诊断结果优化：
 * 1. headless模式下游戏运行很慢（~3fps）
 * 2. 需要等待足够长的时间让比赛开始
 * 3. AI能正常移动和转弯
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export class PuppeteerTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.gameUrl = 'https://code2.wzx.homes/admin/su7-racing/';
    this.screenshotDir = path.join(process.cwd(), 'test', 'screenshots');
  }

  /**
   * 启动浏览器
   */
  async setup() {
    console.log('🚀 启动浏览器...');

    // 确保截图目录存在
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    this.browser = await puppeteer.launch({
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
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling',
        '--window-size=1280,720'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });

    this.page.setDefaultTimeout(60000);
    this.page.setDefaultNavigationTimeout(60000);

    // 收集控制台日志
    this.consoleLogs = [];
    this.page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      this.consoleLogs.push({ type, text, time: Date.now() });
      if (type === 'error') {
        console.error(`[Browser] ${text}`);
      }
    });

    this.page.on('pageerror', error => {
      console.error(`[PageError] ${error.message}`);
      this.consoleLogs.push({ type: 'pageerror', text: error.message, time: Date.now() });
    });

    console.log('✅ 浏览器启动完成');
  }

  /**
   * 劫持requestAnimationFrame并加载游戏
   */
  async loadGame() {
    console.log('🎮 加载游戏...');

    // 劫持rAF - 使用setInterval确保持续运行
    await this.page.evaluateOnNewDocument(() => {
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

    // 加载页面
    await this.page.goto(this.gameUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // 等待game对象可用
    await this.page.waitForFunction(
      'window.game && window.game.init',
      { timeout: 30000 }
    );

    console.log('✅ 游戏加载完成');
  }

  /**
   * 选择赛道并开始比赛
   */
  async selectTrack(trackId) {
    console.log(`🗺️  选择赛道: ${trackId}`);

    // 选择赛道
    await this.page.evaluate((id) => {
      window.game.showMapSelect();
      window.game.selectedTrackId = id;
      window.game.buildSelectedTrack();
    }, trackId);

    // 等待倒计时结束（headless模式下游戏运行很慢，需要等待很长时间）
    console.log('   等待倒计时结束（最多120秒）...');

    let raceStarted = false;
    for (let i = 0; i < 120; i++) {
      await this.delay(1000);
      const raceState = await this.page.evaluate(() => {
        return {
          raceState: window.game?.raceManager?.state,
          raceTime: window.game?.raceManager?.raceTime
        };
      });
      if (raceState.raceState === 'RACING') {
        console.log(`   ✅ 比赛开始 (${i+1}秒)`);
        raceStarted = true;
        break;
      }
      if (i % 10 === 0) {
        console.log(`   ⏳ 等待中... (${i+1}秒, state=${raceState.raceState})`);
      }
    }

    if (!raceStarted) {
      // 最后检查一次
      const finalState = await this.page.evaluate(() => ({
        raceState: window.game?.raceManager?.state,
        countdown: window.game?.raceManager?.countdown,
        raceTime: window.game?.raceManager?.raceTime
      }));
      throw new Error(`比赛未开始: state=${finalState.raceState}, countdown=${finalState.countdown}`);
    }

    console.log('✅ 比赛开始');
    return { raceState: 'RACING' };
  }

  /**
   * 监控AI状态 - 带轨迹记录
   */
  async monitorAI(trackId, maxDuration = 600000) {
    console.log(`👁️  开始监控AI (最长 ${maxDuration/1000} 秒)...`);

    const startTime = Date.now();
    const history = [];
    const trajectory = [];  // 轨迹记录：位置、速度、转向角度、splineT
    let lastSplineT = -1;
    let stuckFrameCount = 0;
    let lastScreenshotTime = 0;
    const screenshotInterval = 30000;

    while (Date.now() - startTime < maxDuration) {
      // 获取AI状态，包括转向信息
      const state = await this.page.evaluate(() => {
        if (!window.game || !window.game.karts || window.game.karts.length < 2) {
          return { error: 'game not ready' };
        }

        const ai = window.game.karts[1];
        if (!ai || !ai.physics) {
          return { error: 'ai kart not ready' };
        }

        const body = ai.physics.chassisBody;
        const pos = body.position;
        const vel = body.velocity;
        const heading = ai.physics.heading;

        // 计算车头方向
        const fwdX = Math.sin(heading);
        const fwdZ = Math.cos(heading);

        // 获取spline上前方目标点（用于判断转向意图）
        const sp = window.game.track.spline;
        const splineT = ai.physics.currentSplineT;
        const lookAheadT = Math.max(0.01, Math.min(0.05, ai.physics.speed * 0.001 + 0.01));
        const targetT = (splineT + lookAheadT) % 1;
        const target = sp.getPointAt(targetT);

        // 计算到目标点的转向角度
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const cross = fwdZ * dx - fwdX * dz;
        const dot = fwdX * dx + fwdZ * dz;
        const errAngle = Math.atan2(cross, dot);

        return {
          position: { x: pos.x, y: pos.y, z: pos.z },
          velocity: { x: vel.x, z: vel.z },
          speed: ai.physics.speed,
          heading: heading,
          splineT: splineT,
          lap: ai.lap,
          checkpoint: ai.checkpoint,
          totalCheckpoints: ai.totalCheckpoints,
          finished: ai.finished,
          raceState: window.game.raceManager?.state,
          raceTime: window.game.raceManager?.raceTime,
          targetPos: { x: target.x, z: target.z },
          errAngle: errAngle
        };
      });

      if (state.error) {
        await this.delay(1000);
        continue;
      }

      // 记录历史
      const elapsed = Date.now() - startTime;
      history.push({ ...state, elapsed });

      // 记录轨迹
      if (!state.error) {
        trajectory.push({
          time: elapsed,
          raceTime: state.raceTime,
          x: state.position.x,
          z: state.position.z,
          speed: state.speed,
          heading: state.heading,
          splineT: state.splineT,
          errAngle: state.errAngle,
          targetX: state.targetPos?.x,
          targetZ: state.targetPos?.z
        });
      }

      // 检查是否完赛
      if (state.finished) {
        console.log('🎉 AI完成比赛！');
        await this.takeScreenshot('ai-finished');
        return {
          passed: true,
          history,
          reason: 'completed',
          duration: elapsed
        };
      }

      // 检查比赛是否结束
      if (state.raceState === 'FINISHED') {
        console.log('🏁 比赛结束');
        await this.takeScreenshot('race-finished');
        return {
          passed: true,
          history,
          reason: 'race_finished',
          duration: elapsed
        };
      }

      // 检测卡住：splineT没有变化且速度很低
      if (lastSplineT >= 0) {
        const splineProgress = state.splineT - lastSplineT;

        if (Math.abs(splineProgress) < 0.0001 && state.speed < 2) {
          stuckFrameCount++;
          if (stuckFrameCount % 30 === 0) {
            console.log(`⚠️  AI可能卡住: splineT=${state.splineT.toFixed(4)}, speed=${state.speed.toFixed(2)}`);
            await this.takeScreenshot(`stuck-${stuckFrameCount}`);
          }
          if (stuckFrameCount > 100) {
            console.log('❌ AI确认卡住！');
            await this.takeScreenshot('ai-confirmed-stuck');

            // 保存轨迹数据
            const fs = await import('fs');
            const trajectoryPath = `/root/users/admin/projects/su7-racing/test/trajectory-${trackId}.json`;
            fs.writeFileSync(trajectoryPath, JSON.stringify(trajectory, null, 2));
            console.log(`📊 轨迹数据保存: ${trajectoryPath}`);

            return {
              passed: false,
              history,
              trajectory,
              reason: 'stuck',
              duration: elapsed,
              details: {
                position: state.position,
                speed: state.speed,
                splineT: state.splineT
              }
            };
          }
        } else {
          stuckFrameCount = 0;
        }

        // 检测掉落
        if (state.position.y < -10) {
          console.log('⚠️  AI掉落到赛道外！');
          await this.takeScreenshot('ai-fallen');
          return {
            passed: false,
            history,
            reason: 'fallen',
            duration: elapsed
          };
        }

        // 定期截图
        if (Date.now() - lastScreenshotTime > screenshotInterval) {
          await this.takeScreenshot(`running-${Math.floor(elapsed / 1000)}s`);
          lastScreenshotTime = Date.now();
        }
      }

      lastSplineT = state.splineT;
      await this.delay(1000); // headless模式下可以降低采样频率
    }

    // 超时
    console.log('⏰ 测试超时');
    await this.takeScreenshot('timeout');

    // 保存轨迹数据
    const fs = await import('fs');
    const trajectoryPath = `/root/users/admin/projects/su7-racing/test/trajectory-${trackId}.json`;
    fs.writeFileSync(trajectoryPath, JSON.stringify(trajectory, null, 2));
    console.log(`📊 轨迹数据保存: ${trajectoryPath}`);

    return {
      passed: false,
      history,
      trajectory,
      reason: 'timeout',
      duration: maxDuration
    };
  }

  /**
   * 截图
   */
  async takeScreenshot(name) {
    try {
      const filename = `${name}-${Date.now()}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      await this.page.screenshot({ path: filepath, fullPage: false });
      console.log(`📸 截图: ${filename}`);
      return filepath;
    } catch (e) {
      console.warn('⚠️  截图失败:', e.message);
      return null;
    }
  }

  /**
   * 延时
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 关闭浏览器
   */
  async teardown() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 浏览器已关闭');
    }
  }
}
