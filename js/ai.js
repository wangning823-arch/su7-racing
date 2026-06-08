import { CONFIG } from './config.js?v=2';

/**
 * AI控制器 - 基于曲率感知的智能驾驶
 *
 * 核心算法：
 * 1. 曲率检测：采样前方赛道曲率，找到最急弯道及其距离
 * 2. 安全速度：根据弯道距离和曲率计算安全通过速度
 * 3. 平滑控制：油门/刹车连续响应，避免突兀操作
 */
export class AIController {
  constructor(difficulty, track) {
    this.track = track;
    this.speedCoeff = CONFIG.aiSpeeds[difficulty];
    this.lookahead = CONFIG.aiLookaheads[difficulty];
    this.difficulty = difficulty;
    this.frameCount = 0;
    this.splineT = 0;
  }

  initPosition(pos) {
    const sp = this.track.spline;
    let bestT = 0;
    let bestDist = Infinity;
    for (let t = 0; t < 1; t += 0.005) {
      const p = sp.getPointAt(t);
      const d = (pos.x - p.x) ** 2 + (pos.z - p.z) ** 2;
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    for (let dt = -0.01; dt <= 0.01; dt += 0.0002) {
      let t = (bestT + dt + 1) % 1;
      const p = sp.getPointAt(t);
      const d = (pos.x - p.x) ** 2 + (pos.z - p.z) ** 2;
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    this.splineT = bestT;
    this.frameCount = 0;
  }

  getInput(kart) {
    const pos = kart.physics.chassisBody.position;
    const speed = Math.sqrt(
      kart.physics.chassisBody.velocity.x ** 2 +
      kart.physics.chassisBody.velocity.z ** 2
    );
    const heading = kart.physics.heading;
    const sp = this.track.spline;

    this.frameCount++;

    // Step 1: 更新splineT - 找到赛道上最近的点
    let bestT = this.splineT;
    let bestDist = Infinity;
    // 根据速度动态调整搜索范围：速度越快，向前搜索越远
    const fwdRange = Math.max(0.03, Math.min(0.15, speed * 0.004));
    const backRange = 0.01;
    for (let dt = -backRange; dt <= fwdRange; dt += 0.0003) {
      let t = (this.splineT + dt + 1) % 1;
      const p = sp.getPointAt(t);
      const d = (pos.x - p.x) ** 2 + (pos.z - p.z) ** 2;
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    // 如果偏离赛道太远，进行全局搜索
    if (bestDist > 400) {
      for (let t = 0; t < 1; t += 0.005) {
        const p = sp.getPointAt(t);
        const d = (pos.x - p.x) ** 2 + (pos.z - p.z) ** 2;
        if (d < bestDist) { bestDist = d; bestT = t; }
      }
    }
    this.splineT = bestT;

    // Step 2: 曲率检测前瞻 - 采样前方赛道弯曲程度
    // 使用固定前瞻距离0.06（约5%赛道长度），确保提前看到弯道
    const curvatureLookT = 0.06;

    // Step 3: 转向目标 - 短距离前瞻用于精确跟踪赛道
    const steerLookT = 0.012;
    const steerTarget = sp.getPointAt((this.splineT + steerLookT) % 1);

    const hfwdX = Math.sin(heading);
    const hfwdZ = Math.cos(heading);
    const sdx = steerTarget.x - pos.x;
    const sdz = steerTarget.z - pos.z;
    const scross = hfwdZ * sdx - hfwdX * sdz;
    const sdot = hfwdX * sdx + hfwdZ * sdz;
    const errAngle = Math.atan2(scross, sdot);

    // Step 4: 横向偏差修正 - 计算车与赛道中心的偏移量
    const nearest = sp.getPointAt(this.splineT);
    const tangent = sp.getTangentAt(this.splineT);
    const rightX = tangent.z;
    const rightZ = -tangent.x;
    const lateralDx = pos.x - nearest.x;
    const lateralDz = pos.z - nearest.z;
    const crossTrackError = lateralDx * rightX + lateralDz * rightZ;
    const trackWidth = this.track._trackWidth || CONFIG.trackWidth;
    const normalizedError = crossTrackError / (trackWidth / 2);

    // Step 5: 转向控制 - 结合目标方向和横向偏差修正
    const steerFromTarget = Math.max(-1, Math.min(1, errAngle * 1.2));
    const steerFromError = -normalizedError * 0.15;
    const steer = Math.max(-1, Math.min(1, steerFromTarget + steerFromError));

    // Step 6: 速度控制 - 基于前方曲率的单一系统
    // 采样多个距离的曲率，找到最急弯道及其距离
    let maxLocalCurvature = 0;
    let maxCurvDist = 0;

    const curvSampleSteps = 20;
    const curvSampleDt = curvatureLookT / curvSampleSteps;
    let prevSampleTan = tangent;
    for (let i = 1; i <= curvSampleSteps; i++) {
      const tt = (this.splineT + curvSampleDt * i + 1) % 1;
      const curTan = sp.getTangentAt(tt);
      const tcross = prevSampleTan.x * curTan.z - prevSampleTan.z * curTan.x;
      const tdot = prevSampleTan.x * curTan.x + prevSampleTan.z * curTan.z;
      const localAngle = Math.abs(Math.atan2(tcross, tdot));
      if (localAngle > maxLocalCurvature) {
        maxLocalCurvature = localAngle;
        maxCurvDist = curvSampleDt * i;
      }
      prevSampleTan = curTan;
    }

    // 将t距离转换为近似弧长
    const maxCurvDistArc = maxCurvDist * 2000;

    // Step 7: 计算安全速度 - 仅在弯道足够近时限制速度
    const deceleration = 40;
    const brakingDistance = (speed * speed) / (2 * deceleration);

    let maxSafeSpeed = this.speedCoeff * CONFIG.maxSpeed;

    if (maxCurvDistArc < brakingDistance + 20) {
      // 弯道在刹车距离内 - 常数越大，过弯速度越快
      const turnSpeed = 10.0 / (maxLocalCurvature + 0.05);
      maxSafeSpeed = Math.min(maxSafeSpeed, turnSpeed);
    }

    // Step 8: 油门/刹车 - 平滑连续响应
    let throttle = this.speedCoeff;
    let brake = 0;

    // 启动阶段：前30帧限制转向幅度
    if (this.frameCount < 30) {
      return {
        throttle: Math.max(0, Math.min(1, throttle)),
        brake: 0,
        steer: Math.max(-0.3, Math.min(0.3, steer * 0.3)),
        drift: false
      };
    }

    // 超速时平滑减速
    if (speed > maxSafeSpeed) {
      const overshoot = (speed - maxSafeSpeed) / maxSafeSpeed;
      brake = Math.min(0.6, overshoot * 0.8);
      throttle *= Math.max(0.2, 1.0 - overshoot * 0.4);
    }

    // 偏离赛道时降低油门
    if (Math.abs(normalizedError) > 0.8) {
      throttle *= 0.5;
    }

    return {
      throttle: Math.max(0, Math.min(1, throttle)),
      brake: Math.max(0, Math.min(1, brake)),
      steer,
      drift: false
    };
  }
}
