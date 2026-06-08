/**
 * 浏览器测试脚本
 *
 * 这个脚本可以直接在浏览器控制台中运行，用于快速测试游戏功能。
 *
 * 使用方法：
 * 1. 打开游戏页面
 * 2. 打开浏览器开发者工具（F12）
 * 3. 在控制台中粘贴并运行此脚本
 * 4. 调用测试函数：
 *    - testAcceleration() - 测试加速
 *    - testBraking() - 测试刹车
 *    - testSteering() - 测试转向
 *    - testDrift() - 测试漂移
 *    - testLap() - 测试完整一圈
 *    - runAllTests() - 运行所有测试
 */

// 等待游戏加载
function waitForGame() {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (window.game && window.game.running) {
        resolve(window.game);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
    setTimeout(() => reject(new Error('Game did not load within 30 seconds')), 30000);
  });
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

function getPlayerPosition(game) {
  const body = game.player?.physics?.chassisBody;
  if (!body) return { x: 0, y: 0, z: 0 };
  return { x: body.position.x, y: body.position.y, z: body.position.z };
}

// ==================== 测试函数 ====================

/**
 * 测试加速
 */
async function testAcceleration() {
  console.log('=== 测试加速 ===');
  const game = await waitForGame();

  const initialSpeed = getPlayerSpeed(game);
  console.log('初始速度:', initialSpeed.toFixed(2));

  // 按住油门
  game.input.keys['KeyW'] = true;
  await delay(2000);
  game.input.keys['KeyW'] = false;

  const finalSpeed = getPlayerSpeed(game);
  console.log('加速后速度:', finalSpeed.toFixed(2));

  const passed = finalSpeed > initialSpeed;
  console.log(passed ? '✅ 测试通过' : '❌ 测试失败');
  console.log('速度增加:', (finalSpeed - initialSpeed).toFixed(2));

  return passed;
}

/**
 * 测试刹车
 */
async function testBraking() {
  console.log('=== 测试刹车 ===');
  const game = await waitForGame();

  // 先加速
  game.input.keys['KeyW'] = true;
  await delay(2000);
  game.input.keys['KeyW'] = false;

  const speedBeforeBrake = getPlayerSpeed(game);
  console.log('刹车前速度:', speedBeforeBrake.toFixed(2));

  // 刹车
  game.input.keys['KeyS'] = true;
  await delay(1000);
  game.input.keys['KeyS'] = false;

  const speedAfterBrake = getPlayerSpeed(game);
  console.log('刹车后速度:', speedAfterBrake.toFixed(2));

  const passed = speedAfterBrake < speedBeforeBrake;
  console.log(passed ? '✅ 测试通过' : '❌ 测试失败');
  console.log('速度减少:', (speedBeforeBrake - speedAfterBrake).toFixed(2));

  return passed;
}

/**
 * 测试转向
 */
async function testSteering() {
  console.log('=== 测试转向 ===');
  const game = await waitForGame();

  const initialPos = getPlayerPosition(game);
  console.log('初始位置:', initialPos);

  // 加速并转向
  game.input.keys['KeyW'] = true;
  game.input.keys['KeyA'] = true;
  await delay(1000);
  game.input.keys['KeyA'] = false;
  game.input.keys['KeyW'] = false;

  const finalPos = getPlayerPosition(game);
  console.log('转向后位置:', finalPos);

  const posChanged = initialPos.x !== finalPos.x || initialPos.z !== finalPos.z;
  console.log(posChanged ? '✅ 测试通过' : '❌ 测试失败');

  return posChanged;
}

/**
 * 测试漂移
 */
async function testDrift() {
  console.log('=== 测试漂移 ===');
  const game = await waitForGame();

  // 先加速
  game.input.keys['KeyW'] = true;
  await delay(2000);

  // 转向
  game.input.keys['KeyD'] = true;
  await delay(500);

  // 启动漂移
  game.input.keys['Space'] = true;
  await delay(1000);

  // 检查漂移状态
  const isDrifting = game.player.physics.isDrifting;
  console.log('漂移状态:', isDrifting);

  // 检查横向速度
  const body = game.player.physics.chassisBody;
  const heading = game.player.physics.heading;
  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  const lateralVelocity = Math.abs(body.velocity.x * (-forwardZ) + body.velocity.z * forwardX);
  console.log('横向速度:', lateralVelocity.toFixed(2));

  game.input.keys['Space'] = false;
  game.input.keys['KeyD'] = false;
  game.input.keys['KeyW'] = false;

  const passed = isDrifting && lateralVelocity > 1;
  console.log(passed ? '✅ 测试通过' : '❌ 测试失败');

  return passed;
}

/**
 * 测试完整一圈
 */
async function testLap() {
  console.log('=== 测试完整一圈 ===');
  const game = await waitForGame();

  const startSplineT = game.player.physics.currentSplineT;
  console.log('起始spline位置:', startSplineT.toFixed(4));

  const startTime = Date.now();

  // 加速并自动驾驶
  game.input.keys['KeyW'] = true;

  let lapCompleted = false;
  let lastSplineT = startSplineT;
  let crossZero = false;

  console.log('开始自动驾驶...');

  // 最多运行120秒
  while (Date.now() - startTime < 120000) {
    await delay(100);

    const currentSplineT = game.player.physics.currentSplineT;

    // 简化的转向控制
    const targetSplineT = (currentSplineT + 0.02) % 1;
    const error = targetSplineT - currentSplineT;

    // 检测是否经过0点
    if (lastSplineT > 0.9 && currentSplineT < 0.1) {
      crossZero = true;
      console.log('经过起点线');
    }

    // 检测是否完成一圈
    if (crossZero && currentSplineT > 0.1 && currentSplineT < 0.3) {
      lapCompleted = true;
      break;
    }

    lastSplineT = currentSplineT;

    // 每10秒输出一次状态
    if ((Date.now() - startTime) % 10000 < 100) {
      console.log(`进度: ${(currentSplineT * 100).toFixed(1)}%`);
    }
  }

  game.input.keys['KeyW'] = false;

  const duration = (Date.now() - startTime) / 1000;
  console.log('完成一圈:', lapCompleted);
  console.log('用时:', duration.toFixed(2) + '秒');

  console.log(lapCompleted ? '✅ 测试通过' : '❌ 测试失败');

  return lapCompleted;
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('=== 开始运行所有测试 ===');
  console.log('');

  const results = [];

  results.push({ test: '加速', passed: await testAcceleration() });
  console.log('');

  results.push({ test: '刹车', passed: await testBraking() });
  console.log('');

  results.push({ test: '转向', passed: await testSteering() });
  console.log('');

  results.push({ test: '漂移', passed: await testDrift() });
  console.log('');

  // 完整一圈测试需要较长时间，可以注释掉
  // results.push({ test: '完整一圈', passed: await testLap() });

  console.log('=== 测试结果汇总 ===');
  console.table(results);

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`通过: ${passed}/${total}`);

  return results;
}

// 在浏览器控制台中暴露测试函数
if (typeof window !== 'undefined') {
  window.testAcceleration = testAcceleration;
  window.testBraking = testBraking;
  window.testSteering = testSteering;
  window.testDrift = testDrift;
  window.testLap = testLap;
  window.runAllTests = runAllTests;

  console.log('=== 浏览器测试脚本已加载 ===');
  console.log('可用的测试函数:');
  console.log('  - testAcceleration() - 测试加速');
  console.log('  - testBraking() - 测试刹车');
  console.log('  - testSteering() - 测试转向');
  console.log('  - testDrift() - 测试漂移');
  console.log('  - testLap() - 测试完整一圈');
  console.log('  - runAllTests() - 运行所有测试');
  console.log('');
  console.log('示例: await testAcceleration()');
}

export {
  testAcceleration,
  testBraking,
  testSteering,
  testDrift,
  testLap,
  runAllTests
};
