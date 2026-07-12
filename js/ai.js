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
    this.accelCoeff = CONFIG.aiAccels[difficulty];
    this.lookahead = CONFIG.aiLookaheads[difficulty];
    this.difficulty = difficulty;
    this.frameCount = 0;
    this.splineT = 0;
    this.stuckFrames = 0;      // 连续卡住帧数
    this.lastPos = null;       // 上一帧位置
    this.reverseTimer = 0;     // 倒车计时器
    this.reverseCooldown = 0;  // 倒车冷却（防止反复触发）
    this.wallHugFrames = 0;    // 连续贴墙帧数
    this.lastLateralError = 0; // 上一帧横向偏差（用于检测趋势）
    this.recoveryFrames = 0;   // 脱困后的恢复帧数（强制转向远离墙壁）
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

  getInput(kart, allKarts) {
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
    // 使用固定前瞻距离0.12（约12%赛道长度），提前更远看到弯道
    const curvatureLookT = 0.12;

    // Step 3: 三重前瞻转向 - 短/中/长距离
    const steerLookShort = 0.010;
    const steerLookMid = 0.020;
    const steerLookFar = 0.035;
    const steerLookExtra = 0.060; // S弯时额外远的前瞻点
    const steerTargetShort = sp.getPointAt((this.splineT + steerLookShort) % 1);
    const steerTargetMid = sp.getPointAt((this.splineT + steerLookMid) % 1);
    const steerTargetFar = sp.getPointAt((this.splineT + steerLookFar) % 1);
    const steerTargetExtra = sp.getPointAt((this.splineT + steerLookExtra) % 1);

    const hfwdX = Math.sin(heading);
    const hfwdZ = Math.cos(heading);

    const calcErrAngle = (target) => {
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      return Math.atan2(hfwdZ * dx - hfwdX * dz, hfwdX * dx + hfwdZ * dz);
    };

    const errAngleShort = calcErrAngle(steerTargetShort);
    const errAngleMid = calcErrAngle(steerTargetMid);
    const errAngleFar = calcErrAngle(steerTargetFar);
    const errAngleExtra = calcErrAngle(steerTargetExtra);

    // 检测方向反转（chicane）：短距离和远距离errAngle符号相反
    const directionReversal = (errAngleShort * errAngleFar < 0) && Math.abs(errAngleFar) > 0.3;

    let errAngle;
    if (directionReversal) {
      // S弯换向：用额外远的前瞻点来预判第二个弯的方向
      // 0.2短 + 0.2中 + 0.2远 + 0.4额外远
      errAngle = errAngleShort * 0.2 + errAngleMid * 0.2 + errAngleFar * 0.2 + errAngleExtra * 0.4;
    } else {
      // 正常：70%短 + 30%中
      errAngle = errAngleShort * 0.7 + errAngleMid * 0.3;
    }

    // Step 4: 横向偏差修正
    const nearest = sp.getPointAt(this.splineT);
    const tangent = sp.getTangentAt(this.splineT);
    const rightX = tangent.z;
    const rightZ = -tangent.x;
    const lateralDx = pos.x - nearest.x;
    const lateralDz = pos.z - nearest.z;
    const crossTrackError = lateralDx * rightX + lateralDz * rightZ;
    const trackWidth = this.track._trackWidth || CONFIG.trackWidth;
    const normalizedError = crossTrackError / (trackWidth / 2);

    // Step 5: 基础转向 - errAngle + 横向偏差修正
    let errorCorrection;
    if (Math.abs(normalizedError) > 0.7) {
      errorCorrection = -normalizedError * 0.8;
    } else if (Math.abs(normalizedError) > 0.3) {
      errorCorrection = -normalizedError * 0.4;
    } else {
      errorCorrection = -normalizedError * 0.15;
    }
    let steer = Math.max(-1, Math.min(1, errAngle * 1.5 + errorCorrection));

    // 启动阶段：前60帧直行不避让，跳过所有昂贵计算
    if (this.frameCount < 60) {
      return {
        throttle: Math.max(0, Math.min(1, this.speedCoeff)),
        brake: 0,
        steer: Math.max(-0.3, Math.min(0.3, steer * 0.3)),
        drift: false
      };
    }

    // === 以下为正常驾驶逻辑（启动后才执行） ===

    // Step 5a: 连续弯道检测
    let highCurvSegments = 0;
    const curvSampleSteps2 = 30;
    const curvSampleDt2 = 0.1 / curvSampleSteps2;
    let prevTan2 = tangent;
    for (let i = 1; i <= curvSampleSteps2; i++) {
      const tt = (this.splineT + curvSampleDt2 * i + 1) % 1;
      const curTan = sp.getTangentAt(tt);
      const tcross = prevTan2.x * curTan.z - prevTan2.z * curTan.x;
      const tdot = prevTan2.x * curTan.x + prevTan2.z * curTan.z;
      const localAngle = Math.abs(Math.atan2(tcross, tdot));
      if (localAngle > 0.15) highCurvSegments++;
      prevTan2 = curTan;
    }
    const inTurnSequence = highCurvSegments > 8;
    // S弯换向时降低转向增益，防止在第二个弯出口甩到外墙上
    const steerGain = directionReversal ? 1.5 : (inTurnSequence ? 2.5 : 1.8);

    // Step 5c: 赛车走线（外-内-外 / S弯外-内-内-外）
    let racingOffset = 0;
    const racingLookT = 0.03;
    const racingTan = sp.getTangentAt((this.splineT + racingLookT) % 1);
    const turnCross = tangent.x * racingTan.z - tangent.z * racingTan.x;

    if (!directionReversal && Math.abs(turnCross) > 0.01) {
      // 单弯入弯前：推到弯道外侧（外-内-外的"外"）
      racingOffset = -turnCross * 2.0 * Math.min(1, Math.abs(errAngleShort) * 4);
    }
    // S弯时不做额外偏移 — 车在上一个弯出口的外侧自然就是下一个弯的内侧

    // 安全限制：接近护栏时禁止继续向外偏移
    if ((normalizedError > 0.85 && racingOffset > 0) ||
        (normalizedError < -0.85 && racingOffset < 0)) {
      racingOffset = 0;
    }

    steer = Math.max(-1, Math.min(1, errAngle * steerGain + errorCorrection + racingOffset));

    // Step 5b: 避让前方车辆
    let obstacleAhead = false;
    let obstacleDist = Infinity;
    const avoidLookT = 0.06;
    const myT = this.splineT;

    for (const other of allKarts) {
      if (other === kart) continue;

      const otherPos = other.physics.chassisBody.position;
      let bestOtherT = 0;
      let bestOtherDist = Infinity;
      for (let t = 0; t < 1; t += 0.04) {
        const p = sp.getPointAt(t);
        const d = (otherPos.x - p.x) ** 2 + (otherPos.z - p.z) ** 2;
        if (d < bestOtherDist) { bestOtherDist = d; bestOtherT = t; }
      }
      for (let dt = -0.01; dt <= 0.01; dt += 0.002) {
        let t = (bestOtherT + dt + 1) % 1;
        const p = sp.getPointAt(t);
        const d = (otherPos.x - p.x) ** 2 + (otherPos.z - p.z) ** 2;
        if (d < bestOtherDist) { bestOtherDist = d; bestOtherT = t; }
      }

      let dtAhead = bestOtherT - myT;
      if (dtAhead < -0.5) dtAhead += 1.0;
      if (dtAhead < 0) dtAhead += 1.0;

      const distBetween = Math.sqrt(
        (pos.x - otherPos.x) ** 2 + (pos.z - otherPos.z) ** 2
      );

      if (dtAhead < avoidLookT && distBetween < 12) {
        obstacleAhead = true;
        if (distBetween < obstacleDist) obstacleDist = distBetween;

        const otherNearest = sp.getPointAt(bestOtherT);
        const otherTan = sp.getTangentAt(bestOtherT);
        const otherLateral = (otherPos.x - otherNearest.x) * otherTan.z +
                             (otherPos.z - otherNearest.z) * (-otherTan.x);
        const otherNorm = otherLateral / (trackWidth / 2);

        const distFactor = Math.max(0, 1 - distBetween / 12);
        const aheadFactor = Math.max(0, 1 - dtAhead / avoidLookT);
        const avoidStrength = distFactor * aheadFactor;
        const avoidDir = otherNorm > 0 ? -1 : 1;
        steer += avoidDir * avoidStrength * 0.9;
        steer = Math.max(-1, Math.min(1, steer));
      }
    }

    // Step 6: 速度控制
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

    // Step 7: 计算安全速度
    const deceleration = 40;
    const brakingDistance = (speed * speed) / (2 * deceleration);

    let maxSafeSpeed = this.speedCoeff * CONFIG.maxSpeed;

    if (maxCurvDistArc < brakingDistance + 30) {
      // 曲率越大速度越快下降，但设置合理的最低速度
      // 高曲率弯道最低15m/s（约54km/h），避免卡住
      const turnSpeed = 25.0 / (maxLocalCurvature + 0.08);
      const minTurnSpeed = 15.0 * this.speedCoeff;
      maxSafeSpeed = Math.min(maxSafeSpeed, Math.max(minTurnSpeed, turnSpeed));
    }

    // 连续弯道：轻微减速即可，不要过于保守
    if (inTurnSequence) {
      maxSafeSpeed *= 0.85;
    }

    // Chicane换向：轻微减速给转向留时间
    if (directionReversal) {
      const reversalSeverity = Math.min(1, Math.abs(errAngleShort) / 0.8);
      maxSafeSpeed *= (1.0 - reversalSeverity * 0.3); // 最多减速30%
    }

    // 极近距离满舵时轻微减速
    if (obstacleAhead && obstacleDist < 3 && Math.abs(steer) > 0.8) {
      maxSafeSpeed = Math.min(maxSafeSpeed, speed * 0.5);
    }

    // Step 8: 油门/刹车
    let throttle = this.speedCoeff;
    let brake = 0;

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

    // Step 9: 卡住检测 + 倒车脱困
    // 检测条件：速度很低 + 接近赛道边缘（车头卡护栏）
    const nearEdge = Math.abs(normalizedError) > 0.65;
    const isStuck = speed < 2.0 && nearEdge;

    // 额外检测：持续贴墙（横向偏差持续很大）
    if (Math.abs(normalizedError) > 0.7) {
      this.wallHugFrames++;
    } else {
      this.wallHugFrames = Math.max(0, this.wallHugFrames - 2);
    }

    if (isStuck) {
      this.stuckFrames++;
    } else {
      this.stuckFrames = Math.max(0, this.stuckFrames - 4);
    }

    if (this.reverseCooldown > 0) this.reverseCooldown--;

    // 卡住超过10帧 或 持续贴墙超过30帧 → 倒车脱困
    if ((this.stuckFrames > 10 || this.wallHugFrames > 30) && this.reverseCooldown <= 0) {
      this.reverseTimer = 25; // 倒车约0.4秒
      this.recoveryFrames = 15; // 倒车后强制转向15帧
      this.reverseCooldown = 35; // 冷却约0.6秒
      this.stuckFrames = 0;
      this.wallHugFrames = 0;
    }

    if (this.reverseTimer > 0) {
      this.reverseTimer--;
      // 倒车时：brake>0 + 低速 = 倒车
      // 转向：向护栏反方向（远离护栏），更激进的转向角度
      return {
        throttle: 0,
        brake: 0.7,
        steer: normalizedError > 0 ? -0.9 : 0.9,
        drift: false
      };
    }

    // 脱困恢复期：倒车结束后加速 + 大角度转向远离墙壁
    if (this.recoveryFrames > 0) {
      this.recoveryFrames--;
      return {
        throttle: this.accelCoeff * 0.9,
        brake: 0,
        steer: normalizedError > 0 ? -0.9 : 0.9,
        drift: false
      };
    }

    // 强制脱困：连续贴墙超过50帧，执行强力倒车+恢复
    if (this.wallHugFrames > 50) {
      this.wallHugFrames = 0;
      this.reverseTimer = 20;
      this.recoveryFrames = 20;
      this.reverseCooldown = 25;
      return {
        throttle: 0,
        brake: 0.8,
        steer: normalizedError > 0 ? -1.0 : 1.0,
        drift: false
      };
    }

    // 应用加速度系数：影响油门大小
    throttle *= this.accelCoeff;

    return {
      throttle: Math.max(0, Math.min(1, throttle)),
      brake: Math.max(0, Math.min(1, brake)),
      steer,
      drift: false
    };
  }
}
