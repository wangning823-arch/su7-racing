#!/usr/bin/env node

/**
 * 赛道自动修复脚本
 *
 * 自动修复宽度太窄的赛道
 *
 * 使用方法：
 *   node test/fix-tracks.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// 最小推荐赛道宽度
const MIN_TRACK_WIDTH = 12;

/**
 * 加载赛道数据
 */
function loadTrackData() {
  const tracksPath = path.join(ROOT_DIR, 'data', 'tracks.json');
  return JSON.parse(fs.readFileSync(tracksPath, 'utf-8'));
}

/**
 * 保存赛道数据
 */
function saveTrackData(data) {
  const tracksPath = path.join(ROOT_DIR, 'data', 'tracks.json');
  fs.writeFileSync(tracksPath, JSON.stringify(data, null, 2));
}

/**
 * 修复赛道宽度
 */
function fixTrackWidths(data) {
  const tracks = data.tracks;
  const fixed = [];

  for (const track of tracks) {
    const currentWidth = track.trackWidth || 14;

    if (currentWidth < MIN_TRACK_WIDTH) {
      const oldWidth = currentWidth;
      track.trackWidth = MIN_TRACK_WIDTH;
      fixed.push({
        name: track.name,
        oldWidth,
        newWidth: MIN_TRACK_WIDTH
      });
    }
  }

  return fixed;
}

/**
 * 主函数
 */
function main() {
  console.log('赛道自动修复工具');
  console.log('─'.repeat(60));

  try {
    // 加载数据
    const data = loadTrackData();
    console.log(`加载了 ${data.tracks.length} 个赛道`);

    // 修复宽度
    const fixed = fixTrackWidths(data);

    if (fixed.length === 0) {
      console.log('\n✅ 所有赛道宽度已符合要求，无需修复');
      return;
    }

    // 显示修复结果
    console.log(`\n修复了 ${fixed.length} 个赛道:\n`);
    console.log('赛道名称 | 原宽度 | 新宽度');
    console.log('---------|--------|-------');

    fixed.forEach(track => {
      console.log(`${track.name} | ${track.oldWidth} | ${track.newWidth}`);
    });

    // 保存
    saveTrackData(data);
    console.log(`\n✅ 已保存修复后的赛道数据`);
    console.log(`   文件: data/tracks.json`);

  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  }
}

main();
