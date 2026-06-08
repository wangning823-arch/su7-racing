#!/usr/bin/env node

/**
 * 命令行自动测试脚本
 *
 * 无需打开浏览器，直接在Node.js中运行
 * 分析赛道数据和AI逻辑，检测潜在问题
 *
 * 使用方法：
 *   node test/cli-test.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// ==================== 赛道数据分析 ====================

/**
 * 加载赛道数据
 */
function loadTrackData() {
  const tracksPath = path.join(ROOT_DIR, 'data', 'tracks.json');
  const data = JSON.parse(fs.readFileSync(tracksPath, 'utf-8'));
  return data.tracks;
}

/**
 * 计算两点之间的距离
 */
function distance(p1, p2) {
  return Math.sqrt(
    Math.pow(p2[0] - p1[0], 2) +
    Math.pow(p2[2] - p1[2], 2)
  );
}

/**
 * 计算角度（弧度）
 */
function angle(p1, p2, p3) {
  const v1 = [p1[0] - p2[0], p1[2] - p2[2]];
  const v2 = [p3[0] - p2[0], p3[2] - p2[2]];

  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
  const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);

  if (mag1 === 0 || mag2 === 0) return Math.PI;

  const cosAngle = dot / (mag1 * mag2);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
}

/**
 * 分析赛道数据
 */
function analyzeTrack(track) {
  const issues = [];
  const points = track.points;
  const trackWidth = track.trackWidth || 14;

  // 计算赛道长度
  let totalLength = 0;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    totalLength += distance(points[i], points[next]);
  }

  // 检查急转弯
  const sharpTurns = [];
  for (let i = 0; i < points.length; i++) {
    const prev = (i - 1 + points.length) % points.length;
    const next = (i + 1) % points.length;
    const turnAngle = angle(points[prev], points[i], points[next]);

    // 角度小于60度认为是急转弯
    if (turnAngle < Math.PI / 3) {
      sharpTurns.push({
        index: i,
        angle: (turnAngle * 180 / Math.PI).toFixed(1),
        position: points[i]
      });
    }
  }

  // 检查赛道宽度
  if (trackWidth < 10) {
    issues.push({
      type: 'width',
      severity: 'high',
      message: `赛道宽度太窄: ${trackWidth}`,
      suggestion: '增加 trackWidth 到 12 或更大'
    });
  }

  // 检查急转弯数量
  if (sharpTurns.length > 5) {
    issues.push({
      type: 'turns',
      severity: 'high',
      message: `急转弯太多: ${sharpTurns.length} 个`,
      details: sharpTurns.slice(0, 5).map(t => `  位置 ${t.index}: ${t.angle}°`),
      suggestion: '减少急转弯或增加赛道宽度'
    });
  }

  // 检查连续急转弯
  let consecutiveSharp = 0;
  for (let i = 0; i < points.length; i++) {
    const prev = (i - 1 + points.length) % points.length;
    const next = (i + 1) % points.length;
    const turnAngle = angle(points[prev], points[i], points[next]);

    if (turnAngle < Math.PI / 3) {
      consecutiveSharp++;
      if (consecutiveSharp >= 3) {
        issues.push({
          type: 'consecutive',
          severity: 'critical',
          message: `连续急转弯: 位置 ${i - 2} 到 ${i}`,
          suggestion: 'AI很难通过连续急转弯'
        });
        break;
      }
    } else {
      consecutiveSharp = 0;
    }
  }

  // 检查赛道长度
  if (totalLength < 500) {
    issues.push({
      type: 'length',
      severity: 'low',
      message: `赛道太短: ${totalLength.toFixed(0)}`,
      suggestion: '赛道可能不够AI完成测试'
    });
  }

  return {
    trackId: track.id,
    trackName: track.name,
    difficulty: track.difficulty,
    trackWidth,
    totalLength: totalLength.toFixed(0),
    pointCount: points.length,
    sharpTurns: sharpTurns.length,
    issues
  };
}

// ==================== AI逻辑分析 ====================

/**
 * 分析AI控制器代码
 */
function analyzeAIController() {
  const aiPath = path.join(ROOT_DIR, 'js', 'ai.js');
  const aiCode = fs.readFileSync(aiPath, 'utf-8');

  const issues = [];

  // 检查前瞻距离
  const lookaheadMatch = aiCode.match(/lookAheadT\s*=\s*Math\.max\((\d+\.?\d*),\s*Math\.min\((\d+\.?\d*)/);
  if (lookaheadMatch) {
    const minLookahead = parseFloat(lookaheadMatch[1]);
    const maxLookahead = parseFloat(lookaheadMatch[2]);

    if (minLookahead < 0.01) {
      issues.push({
        type: 'lookahead',
        severity: 'medium',
        message: `最小前瞻距离太小: ${minLookahead}`,
        suggestion: '增加到 0.015 或更大'
      });
    }

    if (maxLookahead < 0.04) {
      issues.push({
        type: 'lookahead',
        severity: 'medium',
        message: `最大前瞻距离太小: ${maxLookahead}`,
        suggestion: '增加到 0.05 或更大'
      });
    }
  }

  // 检查转向限制
  const steerMatch = aiCode.match(/steer\s*=\s*Math\.max\(-1,\s*Math\.min\(1,\s*errAngle\)\)/);
  if (steerMatch) {
    issues.push({
      type: 'steering',
      severity: 'low',
      message: '转向角度没有平滑处理',
      suggestion: '考虑添加转向平滑或限制'
    });
  }

  // 检查急转弯处理
  if (!aiCode.includes('Math.abs(errAngle) > 0.8')) {
    issues.push({
      type: 'sharp_turn',
      severity: 'medium',
      message: '没有急转弯特殊处理',
      suggestion: '为急转弯添加减速和刹车逻辑'
    });
  }

  return {
    issues,
    recommendations: [
      '增加前瞻距离以提前反应',
      '为急转弯添加减速逻辑',
      '添加转向平滑处理',
      '考虑使用更复杂的路径规划算法'
    ]
  };
}

/**
 * 分析物理引擎配置
 */
function analyzePhysics() {
  const physicsPath = path.join(ROOT_DIR, 'js', 'physics.js');
  const physicsCode = fs.readFileSync(physicsPath, 'utf-8');

  const issues = [];

  // 检查转向角度
  const steerMatch = physicsCode.match(/heading\s*\+=\s* steer\s*\*\s*(\d+\.?\d*)/);
  if (steerMatch) {
    const steerFactor = parseFloat(steerMatch[1]);
    if (steerFactor < 0.3) {
      issues.push({
        type: 'steer_factor',
        severity: 'medium',
        message: `转向系数太小: ${steerFactor}`,
        suggestion: '增加到 0.4 或更大'
      });
    }
  }

  // 检查边界处理
  if (!physicsCode.includes('effectiveHalf')) {
    issues.push({
      type: 'boundary',
      severity: 'low',
      message: '没有动态边界处理',
      suggestion: '考虑根据赛道宽度动态调整边界'
    });
  }

  return {
    issues,
    recommendations: [
      '增加转向系数以提高机动性',
      '优化边界碰撞检测',
      '添加碰撞后的恢复逻辑'
    ]
  };
}

// ==================== 配置分析 ====================

/**
 * 分析游戏配置
 */
function analyzeConfig() {
  const configPath = path.join(ROOT_DIR, 'js', 'config.js');
  const configCode = fs.readFileSync(configPath, 'utf-8');

  const issues = [];

  // 提取配置值
  const maxSpeedMatch = configCode.match(/maxSpeed:\s*(\d+\.?\d*)/);
  const steerAngleMatch = configCode.match(/steerAngle:\s*(\d+\.?\d*)/);
  const aiSpeedsMatch = configCode.match(/aiSpeeds:\s*\[([^\]]+)\]/);
  const aiLookaheadsMatch = configCode.match(/aiLookaheads:\s*\[([^\]]+)\]/);

  if (maxSpeedMatch) {
    const maxSpeed = parseFloat(maxSpeedMatch[1]);
    if (maxSpeed > 100) {
      issues.push({
        type: 'speed',
        severity: 'medium',
        message: `最大速度可能太高: ${maxSpeed}`,
        suggestion: '考虑降低到 80-90 以提高可控性'
      });
    }
  }

  if (steerAngleMatch) {
    const steerAngle = parseFloat(steerAngleMatch[1]);
    if (steerAngle < 0.4) {
      issues.push({
        type: 'steer_angle',
        severity: 'high',
        message: `转向角度太小: ${steerAngle}`,
        suggestion: '增加到 0.5 或更大'
      });
    }
  }

  if (aiLookaheadsMatch) {
    const lookaheads = aiLookaheadsMatch[1].split(',').map(Number);
    if (lookaheads.some(l => l < 2)) {
      issues.push({
        type: 'ai_lookahead',
        severity: 'high',
        message: `AI前瞻距离太小: ${lookaheads.join(', ')}`,
        suggestion: '增加所有值到 3 或更大'
      });
    }
  }

  return {
    issues,
    config: {
      maxSpeed: maxSpeedMatch ? parseFloat(maxSpeedMatch[1]) : null,
      steerAngle: steerAngleMatch ? parseFloat(steerAngleMatch[1]) : null,
      aiSpeeds: aiSpeedsMatch ? aiSpeedsMatch[1] : null,
      aiLookaheads: aiLookaheadsMatch ? aiLookaheadsMatch[1] : null
    }
  };
}

// ==================== 生成报告 ====================

/**
 * 生成测试报告
 */
function generateReport(trackResults, aiAnalysis, physicsAnalysis, configAnalysis) {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              SU7 Racing 自动测试报告                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // 配置分析
  console.log('\n📊 配置分析');
  console.log('─'.repeat(60));
  if (configAnalysis.config.maxSpeed) {
    console.log(`  最大速度: ${configAnalysis.config.maxSpeed}`);
  }
  if (configAnalysis.config.steerAngle) {
    console.log(`  转向角度: ${configAnalysis.config.steerAngle}`);
  }
  if (configAnalysis.config.aiLookaheads) {
    console.log(`  AI前瞻: ${configAnalysis.config.aiLookaheads}`);
  }

  if (configAnalysis.issues.length > 0) {
    console.log('\n  ⚠️  配置问题:');
    configAnalysis.issues.forEach(issue => {
      console.log(`    [${issue.severity.toUpperCase()}] ${issue.message}`);
      console.log(`      建议: ${issue.suggestion}`);
    });
  }

  // AI分析
  console.log('\n🤖 AI控制器分析');
  console.log('─'.repeat(60));
  if (aiAnalysis.issues.length > 0) {
    aiAnalysis.issues.forEach(issue => {
      console.log(`  [${issue.severity.toUpperCase()}] ${issue.message}`);
      console.log(`    建议: ${issue.suggestion}`);
    });
  } else {
    console.log('  ✅ 未发现明显问题');
  }

  // 物理分析
  console.log('\n⚙️  物理引擎分析');
  console.log('─'.repeat(60));
  if (physicsAnalysis.issues.length > 0) {
    physicsAnalysis.issues.forEach(issue => {
      console.log(`  [${issue.severity.toUpperCase()}] ${issue.message}`);
      console.log(`    建议: ${issue.suggestion}`);
    });
  } else {
    console.log('  ✅ 未发现明显问题');
  }

  // 赛道分析
  console.log('\n🏎️  赛道分析');
  console.log('─'.repeat(60));
  console.log(`  共 ${trackResults.length} 个赛道\n`);

  // 按难度分组
  const byDifficulty = {
    easy: trackResults.filter(t => t.difficulty === 'easy'),
    medium: trackResults.filter(t => t.difficulty === 'medium'),
    hard: trackResults.filter(t => t.difficulty === 'hard')
  };

  for (const [diff, tracks] of Object.entries(byDifficulty)) {
    if (tracks.length === 0) continue;

    const diffLabel = { easy: '简单', medium: '中等', hard: '困难' }[diff];
    console.log(`  ${diffLabel}赛道 (${tracks.length}):`);

    tracks.forEach(track => {
      const status = track.issues.length === 0 ? '✅' :
                     track.issues.some(i => i.severity === 'critical') ? '❌' :
                     track.issues.some(i => i.severity === 'high') ? '⚠️' : '✅';

      console.log(`    ${status} ${track.trackName}`);
      console.log(`       宽度: ${track.trackWidth} | 长度: ${track.totalLength} | 急转弯: ${track.sharpTurns}`);

      if (track.issues.length > 0) {
        track.issues.forEach(issue => {
          console.log(`       [${issue.severity}] ${issue.message}`);
        });
      }
    });
    console.log('');
  }

  // 问题汇总
  const allIssues = [
    ...configAnalysis.issues,
    ...aiAnalysis.issues,
    ...physicsAnalysis.issues,
    ...trackResults.flatMap(t => t.issues)
  ];

  const criticalIssues = allIssues.filter(i => i.severity === 'critical');
  const highIssues = allIssues.filter(i => i.severity === 'high');
  const mediumIssues = allIssues.filter(i => i.severity === 'medium');

  console.log('\n📋 问题汇总');
  console.log('─'.repeat(60));
  console.log(`  ❌ 严重问题: ${criticalIssues.length}`);
  console.log(`  ⚠️  高级问题: ${highIssues.length}`);
  console.log(`  💡 中级问题: ${mediumIssues.length}`);

  // 修复建议
  console.log('\n🔧 修复建议');
  console.log('─'.repeat(60));

  const recommendations = new Set();

  if (criticalIssues.length > 0 || highIssues.length > 0) {
    recommendations.add('1. 优先修复严重和高级问题');
  }

  if (configAnalysis.issues.some(i => i.type === 'steer_angle')) {
    recommendations.add('2. 增加转向角度到 0.5 或更大');
  }

  if (aiAnalysis.issues.some(i => i.type === 'lookahead')) {
    recommendations.add('3. 增加AI前瞻距离');
  }

  const sharpTrackCount = trackResults.filter(t => t.sharpTurns > 5).length;
  if (sharpTrackCount > 0) {
    recommendations.add(`4. ${sharpTrackCount} 个赛道急转弯太多，考虑增加赛道宽度`);
  }

  const narrowTrackCount = trackResults.filter(t => t.trackWidth < 10).length;
  if (narrowTrackCount > 0) {
    recommendations.add(`5. ${narrowTrackCount} 个赛道宽度太窄，考虑增加到 12+`);
  }

  recommendations.add('6. 考虑实现AI路径预计算和避障逻辑');

  recommendations.forEach(rec => console.log(`  ${rec}`));

  // 结论
  console.log('\n📝 结论');
  console.log('─'.repeat(60));

  if (criticalIssues.length === 0 && highIssues.length === 0) {
    console.log('  ✅ 整体状态良好，AI应该能正常运行大部分赛道');
  } else {
    console.log('  ⚠️  发现一些问题，可能导致AI在部分赛道卡住:');
    if (criticalIssues.length > 0) {
      console.log(`     - ${criticalIssues.length} 个严重问题需要立即修复`);
    }
    if (highIssues.length > 0) {
      console.log(`     - ${highIssues.length} 个高级问题建议修复`);
    }
  }

  console.log('\n' + '═'.repeat(60));

  return {
    trackResults,
    aiAnalysis,
    physicsAnalysis,
    configAnalysis,
    summary: {
      totalIssues: allIssues.length,
      critical: criticalIssues.length,
      high: highIssues.length,
      medium: mediumIssues.length
    }
  };
}

// ==================== 主函数 ====================

function main() {
  console.log('SU7 Racing 自动测试工具');
  console.log('正在分析...\n');

  try {
    // 加载赛道数据
    const tracks = loadTrackData();
    console.log(`加载了 ${tracks.length} 个赛道`);

    // 分析每个赛道
    const trackResults = tracks.map(track => analyzeTrack(track));

    // 分析AI控制器
    const aiAnalysis = analyzeAIController();

    // 分析物理引擎
    const physicsAnalysis = analyzePhysics();

    // 分析配置
    const configAnalysis = analyzeConfig();

    // 生成报告
    const report = generateReport(trackResults, aiAnalysis, physicsAnalysis, configAnalysis);

    // 保存报告到文件
    const reportPath = path.join(ROOT_DIR, 'test', 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n报告已保存到: ${reportPath}`);

    // 返回退出码
    if (report.summary.critical > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

// 运行主函数
main();
