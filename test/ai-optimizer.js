/**
 * AI优化工具
 *
 * 用于分析和修复AI卡住问题
 *
 * 使用方法：
 * 1. 打开游戏页面
 * 2. 在控制台粘贴此脚本
 * 3. 运行分析和优化
 */

/**
 * 分析AI卡住原因
 */
function analyzeAIIssues(game) {
  console.log('\n========== AI问题分析 ==========');

  const issues = [];

  // 检查1: AI速度配置
  const aiSpeeds = CONFIG.aiSpeeds;
  const aiLookaheads = CONFIG.aiLookaheads;

  console.log('\n1. AI配置:');
  console.log('   速度系数:', aiSpeeds);
  console.log('   前瞻距离:', aiLookaheads);

  if (aiLookaheads.some(l => l < 2)) {
    issues.push({
      type: 'config',
      severity: 'medium',
      message: '前瞻距离太小，可能导致急转弯时反应不及',
      suggestion: '增加 aiLookaheads 值（建议 >= 2）'
    });
  }

  // 检查2: 赛道宽度
  const track = game.track;
  if (track) {
    console.log('\n2. 赛道信息:');
    console.log('   赛道宽度:', track.halfWidth * 2);
    console.log('   赛道长度:', track.spline?.getLength()?.toFixed(2));

    if (track.halfWidth * 2 < 10) {
      issues.push({
        type: 'track',
        severity: 'high',
        message: '赛道宽度太窄，AI容易卡住',
        suggestion: '增加 trackWidth（建议 >= 12）'
      });
    }
  }

  // 检查3: AI控制器状态
  const aiControllers = game.aiControllers;
  if (aiControllers && aiControllers.length > 0) {
    console.log('\n3. AI控制器状态:');
    aiControllers.forEach((ai, i) => {
      console.log(`   AI ${i}:`);
      console.log(`     splineT: ${ai.splineT.toFixed(4)}`);
      console.log(`     frameCount: ${ai.frameCount}`);
      console.log(`     speedCoeff: ${ai.speedCoeff}`);
      console.log(`     lookahead: ${ai.lookahead}`);
    });
  }

  // 检查4: 物理参数
  console.log('\n4. 物理参数:');
  console.log('   最大速度:', CONFIG.maxSpeed);
  console.log('   转向角度:', CONFIG.steerAngle);

  if (CONFIG.steerAngle < 0.3) {
    issues.push({
      type: 'physics',
      severity: 'medium',
      message: '转向角度太小，可能导致急转弯时无法及时转向',
      suggestion: '增加 steerAngle（建议 >= 0.4）'
    });
  }

  // 输出问题
  console.log('\n========== 发现的问题 ==========');
  if (issues.length === 0) {
    console.log('未发现明显问题');
  } else {
    issues.forEach((issue, i) => {
      console.log(`\n${i + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
      console.log(`   建议: ${issue.suggestion}`);
    });
  }

  return issues;
}

/**
 * 优化AI参数
 */
function optimizeAIConfig(game, issues) {
  console.log('\n========== 优化AI配置 ==========');

  const changes = [];

  // 根据问题调整配置
  for (const issue of issues) {
    switch (issue.type) {
      case 'config':
        // 增加前瞻距离
        const newLookaheads = CONFIG.aiLookaheads.map(l => Math.max(l, 3));
        if (JSON.stringify(newLookaheads) !== JSON.stringify(CONFIG.aiLookaheads)) {
          CONFIG.aiLookaheads = newLookaheads;
          changes.push('增加前瞻距离到 ' + newLookaheads.join(', '));
        }
        break;

      case 'physics':
        // 增加转向角度
        if (CONFIG.steerAngle < 0.5) {
          CONFIG.steerAngle = 0.5;
          changes.push('增加转向角度到 0.5');
        }
        break;
    }
  }

  // 通用优化：增加速度系数
  if (CONFIG.aiSpeeds[0] < 0.7) {
    CONFIG.aiSpeeds = CONFIG.aiSpeeds.map(s => Math.min(s + 0.1, 1.0));
    changes.push('增加AI速度系数');
  }

  // 输出变更
  console.log('\n应用的优化:');
  if (changes.length === 0) {
    console.log('无需优化');
  } else {
    changes.forEach(change => {
      console.log(`  ✓ ${change}`);
    });
  }

  return changes;
}

/**
 * 测试AI在特定赛道的表现
 */
async function testAIOnTrack(game, trackIndex, duration = 30000) {
  console.log(`\n========== 测试AI在赛道 ${trackIndex} 的表现 ==========`);

  const tracks = window.TRACKS || [];
  if (trackIndex >= tracks.length) {
    console.error('赛道不存在');
    return null;
  }

  const track = tracks[trackIndex];
  console.log(`赛道: ${track.name}`);

  // 选择赛道
  game.selectedTrackId = track.id;
  game.buildSelectedTrack();

  // 等待比赛开始
  await delay(500);
  while (game.raceManager.state === 'COUNTDOWN') {
    await delay(100);
  }

  // 记录数据
  const data = {
    positions: [],
    speeds: [],
    stuckCount: 0,
    totalDistance: 0
  };

  let lastPos = null;
  const startTime = Date.now();

  // 监控AI
  while (Date.now() - startTime < duration && game.raceManager.state === 'RACING') {
    await delay(100);

    const pos = game.player?.physics?.chassisBody?.position;
    if (pos) {
      data.positions.push({ x: pos.x, y: pos.y, z: pos.z });

      // 计算移动距离
      if (lastPos) {
        const dist = Math.sqrt(
          Math.pow(pos.x - lastPos.x, 2) +
          Math.pow(pos.z - lastPos.z, 2)
        );
        data.totalDistance += dist;
      }
      lastPos = { x: pos.x, y: pos.y, z: pos.z };
    }

    const speed = getPlayerSpeed(game);
    data.speeds.push(speed);

    // 检测卡住
    if (data.speeds.length >= 30) {
      const recentSpeeds = data.speeds.slice(-30);
      const avgSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;
      if (avgSpeed < 0.5) {
        data.stuckCount++;
      }
    }
  }

  // 分析结果
  const avgSpeed = data.speeds.reduce((a, b) => a + b, 0) / data.speeds.length;
  const maxSpeed = Math.max(...data.speeds);

  console.log('\n测试结果:');
  console.log(`  总距离: ${data.totalDistance.toFixed(2)}`);
  console.log(`  平均速度: ${avgSpeed.toFixed(2)}`);
  console.log(`  最大速度: ${maxSpeed.toFixed(2)}`);
  console.log(`  卡住次数: ${data.stuckCount}`);

  return data;
}

/**
 * 批量测试所有赛道
 */
async function batchTestAllTracks(game, durationPerTrack = 30000) {
  console.log('\n========== 批量测试所有赛道 ==========');

  const tracks = window.TRACKS || [];
  const results = [];

  for (let i = 0; i < tracks.length; i++) {
    console.log(`\n[${i + 1}/${tracks.length}] 测试赛道: ${tracks[i].name}`);

    const result = await testAIOnTrack(game, i, durationPerTrack);
    results.push({
      trackIndex: i,
      trackName: tracks[i].name,
      ...result
    });

    // 赛道之间暂停
    await delay(1000);
  }

  // 生成报告
  console.log('\n========== 批量测试报告 ==========');
  console.log('赛道名称 | 总距离 | 平均速度 | 卡住次数');
  console.log('---------|--------|----------|----------');

  results.forEach(r => {
    const distance = r.totalDistance?.toFixed(0) || 'N/A';
    const avgSpeed = r.avgSpeed?.toFixed(2) || 'N/A';
    const stuck = r.stuckCount || 0;
    console.log(`${r.trackName} | ${distance} | ${avgSpeed} | ${stuck}`);
  });

  return results;
}

// 工具函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getPlayerSpeed(game) {
  const body = game.player?.physics?.chassisBody;
  if (!body) return 0;
  return Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
}

// 在浏览器控制台中暴露函数
if (typeof window !== 'undefined') {
  window.analyzeAIIssues = analyzeAIIssues;
  window.optimizeAIConfig = optimizeAIConfig;
  window.testAIOnTrack = testAIOnTrack;
  window.batchTestAllTracks = batchTestAllTracks;

  console.log('========================================');
  console.log('   AI优化工具已加载');
  console.log('========================================');
  console.log('可用的函数:');
  console.log('  - analyzeAIIssues(game)              分析AI问题');
  console.log('  - optimizeAIConfig(game, issues)     优化AI配置');
  console.log('  - testAIOnTrack(game, index, duration) 测试AI在赛道的表现');
  console.log('  - batchTestAllTracks(game, duration)  批量测试所有赛道');
  console.log('');
  console.log('示例:');
  console.log('  analyzeAIIssues(game)                // 分析问题');
  console.log('  const issues = analyzeAIIssues(game);');
  console.log('  optimizeAIConfig(game, issues);      // 优化配置');
  console.log('  await testAIOnTrack(game, 0);        // 测试单个赛道');
}

export {
  analyzeAIIssues,
  optimizeAIConfig,
  testAIOnTrack,
  batchTestAllTracks
};
