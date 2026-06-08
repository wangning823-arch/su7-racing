/**
 * 赛道自动测试脚本
 *
 * 让AI自动跑每个赛道，检测是否卡住
 *
 * 使用方法：
 * 1. 打开游戏页面
 * 2. 在控制台粘贴此脚本
 * 3. 运行：await runTrackTests()
 */

// 测试配置
const TEST_CONFIG = {
  maxLapTime: 60000,        // 单圈最大时间（毫秒）
  stuckThreshold: 3000,     // 判定卡住的时间（毫秒）
  stuckSpeedThreshold: 0.5, // 判定卡住的速度阈值
  checkInterval: 100,       // 检查间隔（毫秒）
};

// 测试结果存储
let testResults = [];

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取玩家速度
 */
function getPlayerSpeed(game) {
  const body = game.player?.physics?.chassisBody;
  if (!body) return 0;
  return Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
}

/**
 * 获取玩家位置
 */
function getPlayerPosition(game) {
  const body = game.player?.physics?.chassisBody;
  if (!body) return null;
  return {
    x: body.position.x,
    y: body.position.y,
    z: body.position.z
  };
}

/**
 * 检测是否卡住
 * 返回：{ stuck: boolean, reason: string }
 */
function detectStuck(game, lastPositions, lastSpeeds) {
  const pos = getPlayerPosition(game);
  const speed = getPlayerSpeed(game);

  if (!pos) return { stuck: false };

  // 记录位置和速度
  lastPositions.push({ x: pos.x, z: pos.z, time: Date.now() });
  lastSpeeds.push({ speed, time: Date.now() });

  // 保留最近100个数据点
  if (lastPositions.length > 100) lastPositions.shift();
  if (lastSpeeds.length > 100) lastSpeeds.shift();

  // 检测1：长时间低速
  const recentSpeeds = lastSpeeds.slice(-30); // 最近30个数据点
  if (recentSpeeds.length >= 30) {
    const avgSpeed = recentSpeeds.reduce((a, b) => a + b.speed, 0) / recentSpeeds.length;
    const timeSpan = recentSpeeds[recentSpeeds.length - 1].time - recentSpeeds[0].time;

    if (timeSpan > TEST_CONFIG.stuckThreshold && avgSpeed < TEST_CONFIG.stuckSpeedThreshold) {
      return {
        stuck: true,
        reason: `长时间低速: 平均速度 ${avgSpeed.toFixed(2)} 持续 ${(timeSpan / 1000).toFixed(1)}秒`
      };
    }
  }

  // 检测2：位置几乎不变
  if (lastPositions.length >= 50) {
    const recentPositions = lastPositions.slice(-50);
    const firstPos = recentPositions[0];
    const lastPos = recentPositions[recentPositions.length - 1];
    const distance = Math.sqrt(
      Math.pow(lastPos.x - firstPos.x, 2) +
      Math.pow(lastPos.z - firstPos.z, 2)
    );
    const timeSpan = lastPos.time - firstPos.time;

    if (timeSpan > TEST_CONFIG.stuckThreshold && distance < 2) {
      return {
        stuck: true,
        reason: `位置几乎不变: 移动距离 ${distance.toFixed(2)} 持续 ${(timeSpan / 1000).toFixed(1)}秒`
      };
    }
  }

  // 检测3：掉落出界
  if (pos.y < -50) {
    return {
      stuck: true,
      reason: `掉落出界: Y坐标 ${pos.y.toFixed(2)}`
    };
  }

  return { stuck: false };
}

/**
 * 测试单个赛道
 */
async function testTrack(game, trackIndex, trackName) {
  console.log(`\n========== 测试赛道 ${trackIndex + 1}: ${trackName} ==========`);

  const result = {
    trackIndex,
    trackName,
    startTime: Date.now(),
    endTime: null,
    status: 'running',
    lapsCompleted: 0,
    errors: [],
    stuckEvents: []
  };

  try {
    // 选择赛道
    game.selectedTrackId = game.track.trackId || TRACKS[trackIndex]?.id;

    // 清除之前的赛道
    game.track.clear();

    // 获取赛道数据
    const trackData = TRACKS[trackIndex];
    if (!trackData) {
      throw new Error(`赛道 ${trackIndex} 不存在`);
    }

    // 应用主题
    const theme = trackData.theme || game.track.defaultTheme;
    game.applyTheme(theme);

    // 构建赛道
    game.track.build(trackData, theme);

    // 创建卡丁车
    const startPositions = game.track.getStartPositions();

    // 移除旧的卡丁车
    for (const kart of game.karts) {
      game.scene.remove(kart.renderer.group);
      game.physicsWorld.removeBody(kart.physics.chassisBody);
    }

    game.karts = [];

    // 创建玩家
    game.player = new Kart(
      game.scene,
      game.physicsWorld,
      startPositions[0].pos,
      startPositions[0].angle,
      CONFIG.colors[0],
      0,
      true,
      game.track
    );
    game.karts.push(game.player);

    // 创建AI
    game.aiControllers = [];
    for (let i = 0; i < CONFIG.numAI; i++) {
      const kart = new Kart(
        game.scene,
        game.physicsWorld,
        startPositions[i + 1].pos,
        startPositions[i + 1].angle,
        CONFIG.colors[i + 1],
        i + 1,
        false,
        game.track
      );
      game.karts.push(kart);

      const ai = new AIController(i, game.track);
      ai.initPosition(startPositions[i + 1].pos);
      game.aiControllers.push(ai);
    }

    // 创建比赛管理器
    game.raceManager = new RaceManager();
    game.raceManager.karts = game.karts;
    game.raceManager.track = game.track;

    // 创建小地图
    game.minimap = new MiniMap(document.getElementById('minimap'), game.track);

    // 开始比赛
    game.startRace();

    // 等待比赛开始
    await delay(500);

    // 等待倒计时结束
    while (game.raceManager.state === 'COUNTDOWN') {
      await delay(100);
    }

    console.log('比赛已开始，AI正在驾驶...');

    // 监控比赛
    const lastPositions = [];
    const lastSpeeds = [];
    const startTime = Date.now();

    while (game.raceManager.state === 'RACING') {
      await delay(TEST_CONFIG.checkInterval);

      // 检测是否卡住
      const stuckResult = detectStuck(game, lastPositions, lastSpeeds);

      if (stuckResult.stuck) {
        console.warn(`⚠️ 检测到卡住: ${stuckResult.reason}`);
        result.stuckEvents.push({
          time: Date.now() - startTime,
          reason: stuckResult.reason
        });

        // 尝试修复：重置玩家位置
        const currentT = game.player.physics.currentSplineT || 0;
        const point = game.track.spline.getPointAt(currentT);
        const tangent = game.track.spline.getTangentAt(currentT);
        const angle = Math.atan2(tangent.x, tangent.z);
        game.player.physics.reset(point, angle);

        // 重置AI
        for (const ai of game.aiControllers) {
          ai.initPosition(point);
        }

        // 清空历史记录
        lastPositions.length = 0;
        lastSpeeds.length = 0;

        console.log('已重置玩家位置');

        // 等待一段时间后继续
        await delay(1000);
      }

      // 检查超时
      if (Date.now() - startTime > TEST_CONFIG.maxLapTime) {
        console.warn('⚠️ 测试超时');
        result.errors.push('测试超时');
        break;
      }
    }

    // 比赛结束
    result.endTime = Date.now();
    result.duration = (result.endTime - result.startTime) / 1000;

    if (game.raceManager.state === 'FINISHED') {
      result.status = 'completed';
      result.lapsCompleted = game.player.currentLap || 0;
      console.log(`✅ 赛道测试完成: ${result.duration.toFixed(1)}秒`);
    } else {
      result.status = 'timeout';
      console.log(`⚠️ 赛道测试超时: ${result.duration.toFixed(1)}秒`);
    }

  } catch (error) {
    result.endTime = Date.now();
    result.duration = (result.endTime - result.startTime) / 1000;
    result.status = 'error';
    result.errors.push(error.message);
    console.error(`❌ 赛道测试失败: ${error.message}`);
  }

  // 记录结果
  testResults.push(result);

  return result;
}

/**
 * 运行所有赛道测试
 */
async function runTrackTests() {
  console.log('========================================');
  console.log('   SU7 Racing 赛道自动测试');
  console.log('========================================');

  testResults = [];

  // 获取游戏实例
  const game = window.game;
  if (!game) {
    console.error('游戏未初始化，请先打开游戏');
    return;
  }

  // 获取所有赛道
  const tracks = window.TRACKS || [];
  console.log(`\n共 ${tracks.length} 个赛道待测试`);

  // 测试每个赛道
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    await testTrack(game, i, track.name);

    // 赛道之间暂停一下
    await delay(1000);
  }

  // 生成报告
  generateReport();

  return testResults;
}

/**
 * 测试指定赛道
 */
async function testSingleTrack(trackIndex) {
  const game = window.game;
  if (!game) {
    console.error('游戏未初始化');
    return;
  }

  const tracks = window.TRACKS || [];
  if (trackIndex >= tracks.length) {
    console.error(`赛道 ${trackIndex} 不存在`);
    return;
  }

  return await testTrack(game, trackIndex, tracks[trackIndex].name);
}

/**
 * 生成测试报告
 */
function generateReport() {
  console.log('\n========================================');
  console.log('   测试报告');
  console.log('========================================');

  const completed = testResults.filter(r => r.status === 'completed');
  const failed = testResults.filter(r => r.status === 'error');
  const timeout = testResults.filter(r => r.status === 'timeout');

  console.log(`\n总计: ${testResults.length} 个赛道`);
  console.log(`✅ 完成: ${completed.length}`);
  console.log(`⚠️ 超时: ${timeout.length}`);
  console.log(`❌ 失败: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n失败的赛道:');
    failed.forEach(r => {
      console.log(`  - ${r.trackName}: ${r.errors.join(', ')}`);
    });
  }

  if (timeout.length > 0) {
    console.log('\n超时的赛道:');
    timeout.forEach(r => {
      console.log(`  - ${r.trackName}: ${r.stuckEvents.length} 次卡住`);
    });
  }

  // 统计卡住事件
  const allStuckEvents = testResults.flatMap(r => r.stuckEvents);
  if (allStuckEvents.length > 0) {
    console.log(`\n共检测到 ${allStuckEvents.length} 次卡住事件`);
  }

  // 返回结果对象
  return {
    total: testResults.length,
    completed: completed.length,
    failed: failed.length,
    timeout: timeout.length,
    results: testResults
  };
}

/**
 * 获取测试结果
 */
function getTestResults() {
  return testResults;
}

// 在浏览器控制台中暴露函数
if (typeof window !== 'undefined') {
  window.runTrackTests = runTrackTests;
  window.testSingleTrack = testSingleTrack;
  window.getTestResults = getTestResults;
  window.TEST_CONFIG = TEST_CONFIG;

  console.log('========================================');
  console.log('   赛道测试脚本已加载');
  console.log('========================================');
  console.log('可用的函数:');
  console.log('  - runTrackTests()          运行所有赛道测试');
  console.log('  - testSingleTrack(index)   测试指定赛道');
  console.log('  - getTestResults()         获取测试结果');
  console.log('  - TEST_CONFIG              测试配置');
  console.log('');
  console.log('示例:');
  console.log('  await runTrackTests()      // 测试所有赛道');
  console.log('  await testSingleTrack(0)   // 测试第一个赛道');
}

export {
  runTrackTests,
  testSingleTrack,
  getTestResults,
  TEST_CONFIG
};
