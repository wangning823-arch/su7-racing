/**
 * Node.js 无头AI测试 - 城市街道赛道 多车模拟
 * 4车同场竞技（3 AI + 1 玩家占位），模拟真实碰撞干扰
 */

// === 弧长参数化 CatmullRomCurve3 ===
class MockCurve3 {
  constructor(points, tension = 0.5) {
    this.points = points;
    this.tension = tension;
    this._arcTable = null;
    this._buildArcTable();
  }

  _getPointOnCurve(t) {
    const pts = this.points;
    const n = pts.length;
    const f = t * n;
    const i = Math.floor(f);
    const frac = f - i;
    const p0 = pts[((i - 1) % n + n) % n];
    const p1 = pts[i % n];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const t2 = frac * frac;
    const t3 = t2 * frac;
    const tau = this.tension;
    const x = tau * (2*p1[0]+(-p0[0]+p2[0])*frac+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
    const z = tau * (2*p1[1]+(-p0[1]+p2[1])*frac+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
    return { x, z };
  }

  _buildArcTable() {
    const steps = 1000;
    this._arcTable = [{ t: 0, len: 0 }];
    let len = 0;
    let prev = this._getPointOnCurve(0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cur = this._getPointOnCurve(t);
      len += Math.sqrt((cur.x - prev.x) ** 2 + (cur.z - prev.z) ** 2);
      this._arcTable.push({ t, len });
      prev = cur;
    }
    this._totalLen = len;
  }

  _arcToParam(arcLen) {
    arcLen = ((arcLen % this._totalLen) + this._totalLen) % this._totalLen;
    const table = this._arcTable;
    let lo = 0, hi = table.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid].len < arcLen) lo = mid; else hi = mid;
    }
    const seg = table[hi].len - table[lo].len;
    const frac = seg > 0 ? (arcLen - table[lo].len) / seg : 0;
    return table[lo].t + (table[hi].t - table[lo].t) * frac;
  }

  getPointAt(t) {
    t = ((t % 1) + 1) % 1;
    const paramT = this._arcToParam(t * this._totalLen);
    const p = this._getPointOnCurve(paramT);
    return { x: p.x, y: 0, z: p.z };
  }

  getTangentAt(t) {
    t = ((t % 1) + 1) % 1;
    const dt = 0.001;
    const p1 = this.getPointAt(t - dt);
    const p2 = this.getPointAt(t + dt);
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    return { x: dx / len, y: 0, z: dz / len };
  }

  getPoint(t) { return this.getPointAt(t); }
}

const cityStreetPoints = [
  [80, 0], [80, 25], [80, 50], [65, 60], [40, 60],
  [25, 50], [25, 30], [25, 15], [10, 15], [-10, 15],
  [-25, 25], [-25, 45], [-25, 65], [-40, 75], [-65, 75],
  [-80, 65], [-80, 45], [-80, 25], [-65, 15], [-45, 15],
  [-45, 0], [-45, -20], [-55, -35], [-70, -40], [-80, -55],
  [-80, -70], [-65, -80], [-40, -80], [-15, -80], [10, -80],
  [35, -80], [55, -75], [70, -60], [80, -40], [80, -20]
];

const CONFIG = {
  maxSpeed: 83.3, steerAngle: 0.4, trackWidth: 13, chassisW: 1.1,
  totalLaps: 3,
  aiSpeeds: [0.5, 0.7, 0.9, 0.95, 1.0],
  aiAccels: [0.6, 0.75, 0.9, 0.95, 1.0],
  aiLookaheads: [3, 3, 2, 2, 2],
};

// === AI控制器 ===
class AIController {
  constructor(difficulty, track, carIndex = 0) {
    this.track = track;
    this.speedCoeff = CONFIG.aiSpeeds[difficulty];
    this.accelCoeff = CONFIG.aiAccels[difficulty];
    this.difficulty = difficulty;
    this.frameCount = 0;
    this.splineT = 0;
    this.stuckFrames = 0;
    this.reverseTimer = 0;
    this.reverseCooldown = 0;
    this.wallHugFrames = 0;
    this.recoveryFrames = 0;
    this.carIndex = carIndex;
    this.reverseDir = 1;
  }

  initPosition(pos) {
    const sp = this.track.spline;
    let bestT = 0, bestDist = Infinity;
    for (let t = 0; t < 1; t += 0.005) {
      const p = sp.getPointAt(t);
      const d = (pos.x-p.x)**2+(pos.z-p.z)**2;
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    for (let dt = -0.01; dt <= 0.01; dt += 0.0002) {
      let t = (bestT+dt+1)%1;
      const p = sp.getPointAt(t);
      const d = (pos.x-p.x)**2+(pos.z-p.z)**2;
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    this.splineT = bestT;
    this.frameCount = 0;
  }

  getInput(kart, allKarts) {
    const pos = kart.physics.chassisBody.position;
    const speed = Math.sqrt(kart.physics.chassisBody.velocity.x**2+kart.physics.chassisBody.velocity.z**2);
    const heading = kart.physics.heading;
    const sp = this.track.spline;
    this.frameCount++;

    // Step 1: 更新splineT
    let bestT = this.splineT, bestDist = Infinity;
    const fwdRange = Math.max(0.03, Math.min(0.15, speed*0.004));
    for (let dt = -0.01; dt <= fwdRange; dt += 0.0003) {
      let t = (this.splineT+dt+1)%1;
      const p = sp.getPointAt(t);
      const d = (pos.x-p.x)**2+(pos.z-p.z)**2;
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    if (bestDist > 400) {
      for (let t = 0; t < 1; t += 0.005) {
        const p = sp.getPointAt(t);
        const d = (pos.x-p.x)**2+(pos.z-p.z)**2;
        if (d < bestDist) { bestDist = d; bestT = t; }
      }
    }
    this.splineT = bestT;

    const steerLookShort = 0.010, steerLookMid = 0.020, steerLookFar = 0.035, steerLookExtra = 0.060;
    const steerTargetShort = sp.getPointAt((this.splineT+steerLookShort)%1);
    const steerTargetMid = sp.getPointAt((this.splineT+steerLookMid)%1);
    const steerTargetFar = sp.getPointAt((this.splineT+steerLookFar)%1);
    const steerTargetExtra = sp.getPointAt((this.splineT+steerLookExtra)%1);
    const hfwdX = Math.sin(heading), hfwdZ = Math.cos(heading);
    const calcErrAngle = (target) => {
      const dx = target.x-pos.x, dz = target.z-pos.z;
      return Math.atan2(hfwdZ*dx-hfwdX*dz, hfwdX*dx+hfwdZ*dz);
    };
    const errAngleShort = calcErrAngle(steerTargetShort);
    const errAngleMid = calcErrAngle(steerTargetMid);
    const errAngleFar = calcErrAngle(steerTargetFar);
    const errAngleExtra = calcErrAngle(steerTargetExtra);
    const directionReversal = (errAngleShort*errAngleFar<0) && Math.abs(errAngleFar)>0.3;

    let errAngle;
    if (directionReversal) { errAngle = errAngleShort*0.2+errAngleMid*0.2+errAngleFar*0.2+errAngleExtra*0.4; }
    else { errAngle = errAngleShort*0.7+errAngleMid*0.3; }

    const nearest = sp.getPointAt(this.splineT);
    const tangent = sp.getTangentAt(this.splineT);
    const rightX = tangent.z, rightZ = -tangent.x;
    const lateralDx = pos.x-nearest.x, lateralDz = pos.z-nearest.z;
    const crossTrackError = lateralDx*rightX+lateralDz*rightZ;
    const trackWidth = this.track._trackWidth || CONFIG.trackWidth;
    const normalizedError = crossTrackError/(trackWidth/2);
    const errorCorrection = Math.abs(normalizedError)>0.7 ? -normalizedError*0.8 : Math.abs(normalizedError)>0.3 ? -normalizedError*0.4 : -normalizedError*0.15;
    let steer = Math.max(-1, Math.min(1, errAngle*1.5+errorCorrection));

    if (this.frameCount < 60) {
      return { throttle: Math.max(0,Math.min(1,this.speedCoeff)), brake:0, steer:Math.max(-0.3,Math.min(0.3,steer*0.3)), drift:false };
    }

    // 连续弯道检测
    let highCurvSegments = 0;
    const curvSampleSteps2 = 30, curvSampleDt2 = 0.1/curvSampleSteps2;
    let prevTan2 = tangent;
    for (let i = 1; i <= curvSampleSteps2; i++) {
      const tt = (this.splineT+curvSampleDt2*i+1)%1;
      const curTan = sp.getTangentAt(tt);
      const tcross = prevTan2.x*curTan.z-prevTan2.z*curTan.x;
      const tdot = prevTan2.x*curTan.x+prevTan2.z*curTan.z;
      if (Math.abs(Math.atan2(tcross,tdot))>0.15) highCurvSegments++;
      prevTan2 = curTan;
    }
    const inTurnSequence = highCurvSegments > 8;
    const steerGain = directionReversal ? 1.5 : (inTurnSequence ? 2.5 : 1.8);

    // 赛车走线（外-内-内-外 for S弯）
    let racingOffset = 0;
    const racingTan = sp.getTangentAt((this.splineT+0.03)%1);
    const turnCross = tangent.x*racingTan.z-tangent.z*racingTan.x;
    if (!directionReversal && Math.abs(turnCross) > 0.01) {
      racingOffset = -turnCross*1.2*Math.min(1,Math.abs(errAngleShort)*3);
    }
    if ((normalizedError>0.6&&racingOffset>0)||(normalizedError<-0.6&&racingOffset<0)) { racingOffset = 0; }
    steer = Math.max(-1, Math.min(1, errAngle*steerGain+errorCorrection+racingOffset));

    // 避让前方车辆
    let obstacleAhead = false, obstacleDist = Infinity;
    const avoidLookT = 0.06, myT = this.splineT;
    for (const other of allKarts) {
      if (other === kart) continue;
      const otherPos = other.physics.chassisBody.position;
      let bestOtherT = 0, bestOtherDist = Infinity;
      for (let t = 0; t < 1; t += 0.04) {
        const p = sp.getPointAt(t);
        const d = (otherPos.x-p.x)**2+(otherPos.z-p.z)**2;
        if (d < bestOtherDist) { bestOtherDist = d; bestOtherT = t; }
      }
      for (let dt = -0.01; dt <= 0.01; dt += 0.002) {
        let t = (bestOtherT+dt+1)%1;
        const p = sp.getPointAt(t);
        const d = (otherPos.x-p.x)**2+(otherPos.z-p.z)**2;
        if (d < bestOtherDist) { bestOtherDist = d; bestOtherT = t; }
      }
      let dtAhead = bestOtherT-myT;
      if (dtAhead < -0.5) dtAhead += 1.0;
      if (dtAhead < 0) dtAhead += 1.0;
      const distBetween = Math.sqrt((pos.x-otherPos.x)**2+(pos.z-otherPos.z)**2);
      if (dtAhead < avoidLookT && distBetween < 12) {
        obstacleAhead = true;
        if (distBetween < obstacleDist) obstacleDist = distBetween;
        const otherNearest = sp.getPointAt(bestOtherT);
        const otherTan = sp.getTangentAt(bestOtherT);
        const otherLateral = (otherPos.x-otherNearest.x)*otherTan.z+(otherPos.z-otherNearest.z)*(-otherTan.x);
        const otherNorm = otherLateral/(trackWidth/2);
        const avoidStrength = Math.max(0,1-distBetween/12)*Math.max(0,1-dtAhead/avoidLookT);
        steer += (otherNorm>0?-1:1)*avoidStrength*0.9;
        steer = Math.max(-1, Math.min(1, steer));
      }
    }

    // 速度控制
    let maxLocalCurvature = 0, maxCurvDist = 0;
    const curvSampleSteps = 20, curvSampleDt = 0.12/curvSampleSteps;
    let prevSampleTan = tangent;
    for (let i = 1; i <= curvSampleSteps; i++) {
      const tt = (this.splineT+curvSampleDt*i+1)%1;
      const curTan = sp.getTangentAt(tt);
      const tcross = prevSampleTan.x*curTan.z-prevSampleTan.z*curTan.x;
      const tdot = prevSampleTan.x*curTan.x+prevSampleTan.z*curTan.z;
      const localAngle = Math.abs(Math.atan2(tcross,tdot));
      if (localAngle > maxLocalCurvature) { maxLocalCurvature = localAngle; maxCurvDist = curvSampleDt*i; }
      prevSampleTan = curTan;
    }
    const maxCurvDistArc = maxCurvDist*2000;
    const brakingDistance = (speed*speed)/(2*40);
    let maxSafeSpeed = this.speedCoeff*CONFIG.maxSpeed;
    if (maxCurvDistArc < brakingDistance+30) {
      const turnSpeed = 25.0/(maxLocalCurvature+0.08);
      const minTurnSpeed = 15.0*this.speedCoeff;
      maxSafeSpeed = Math.min(maxSafeSpeed, Math.max(minTurnSpeed, turnSpeed));
    }
    if (inTurnSequence) maxSafeSpeed *= 0.85;
    if (directionReversal) {
      maxSafeSpeed *= (1.0-Math.min(1,Math.abs(errAngleShort)/0.8)*0.3);
    }
    if (obstacleAhead && obstacleDist<3 && Math.abs(steer)>0.8) {
      maxSafeSpeed = Math.min(maxSafeSpeed, speed*0.5);
    }

    let throttle = this.speedCoeff, brake = 0;
    if (speed > maxSafeSpeed) {
      const overshoot = (speed-maxSafeSpeed)/maxSafeSpeed;
      brake = Math.min(0.6, overshoot*0.8);
      throttle *= Math.max(0.2, 1.0-overshoot*0.4);
    }
    if (Math.abs(normalizedError) > 0.8) throttle *= 0.5;

    // 卡住检测 + 倒车脱困
    const nearEdge = Math.abs(normalizedError) > 0.65;
    const isStuck = speed < 2.0 && nearEdge;
    if (Math.abs(normalizedError) > 0.7) this.wallHugFrames++;
    else this.wallHugFrames = Math.max(0, this.wallHugFrames - 2);
    if (isStuck) this.stuckFrames++;
    else this.stuckFrames = Math.max(0, this.stuckFrames - 4);
    if (this.reverseCooldown > 0) this.reverseCooldown--;

    // 触发倒车：卡住或持续贴墙
    if ((this.stuckFrames > 10 || this.wallHugFrames > 30) && this.reverseCooldown <= 0) {
      this.reverseTimer = 30;
      this.recoveryFrames = 20;
      this.reverseCooldown = 30;
      this.stuckFrames = 0;
      this.wallHugFrames = 0;
      this.reverseDir = ((this.carIndex + Math.floor(this.frameCount / 40)) % 2 === 0) ? 1 : -1;
    }

    if (this.reverseTimer > 0) {
      this.reverseTimer--;
      return { throttle: 0, brake: 0.8, steer: -1.0 * this.reverseDir, drift: false };
    }
    if (this.recoveryFrames > 0) {
      this.recoveryFrames--;
      return { throttle: this.accelCoeff, brake: 0, steer: 1.0 * this.reverseDir, drift: false };
    }

    throttle *= this.accelCoeff;
    return { throttle: Math.max(0, Math.min(1, throttle)), brake: Math.max(0, Math.min(1, brake)), steer, drift: false };
  }
}

// === 真实物理模型 ===
class RealKart {
  constructor() {
    this.speed = 0; this.heading = 0; this.targetHeading = 0;
    this.pos = {x:0,y:0,z:0}; this.vel = {x:0,y:0,z:0};
    this.physics = { chassisBody:{position:this.pos,velocity:this.vel}, heading:0 };
  }
  update(input, spline, trackWidth) {
    const dt = 1/60;
    const speedRatio = this.speed/CONFIG.maxSpeed;
    const steerLimit = CONFIG.steerAngle*(1-speedRatio*0.3);
    const steerInput = input.steer*steerLimit;
    if (this.speed > 0.5) {
      const isReversing = this.vel.x*Math.sin(this.heading)+this.vel.z*Math.cos(this.heading)<-0.5;
      const turnAmount = steerInput*2.5*Math.min(1,this.speed/5)*(1+this.speed/60);
      this.targetHeading += (isReversing?-turnAmount:turnAmount)*dt;
    }
    let headingDiff = this.targetHeading-this.heading;
    while (headingDiff > Math.PI) headingDiff -= 2*Math.PI;
    while (headingDiff < -Math.PI) headingDiff += 2*Math.PI;
    this.heading += headingDiff*0.5;
    const hfwdX = Math.sin(this.heading), hfwdZ = Math.cos(this.heading);

    if (input.throttle > 0 && input.brake < 0.3) {
      let accelRate;
      if (this.speed < 27.78) accelRate = 13.75*input.throttle;
      else if (this.speed < 55.56) accelRate = 4.625*input.throttle;
      else accelRate = 2.325*input.throttle;
      const targetSpeed = Math.min(this.speed+accelRate*dt, CONFIG.maxSpeed);
      const ratio = targetSpeed/(this.speed+0.01);
      this.vel.x = this.vel.x*ratio+hfwdX*accelRate*dt*0.3;
      this.vel.z = this.vel.z*ratio+hfwdZ*accelRate*dt*0.3;
      this.speed = Math.sqrt(this.vel.x**2+this.vel.z**2);
    }

    if (input.brake > 0.1) {
      const fwdDot = this.vel.x*hfwdX+this.vel.z*hfwdZ;
      if (fwdDot > 0.5) {
        const newSpeed = Math.max(0, this.speed-40*input.brake*dt);
        const ratio = newSpeed/(this.speed+0.01);
        this.vel.x *= ratio; this.vel.z *= ratio; this.speed = newSpeed;
      } else {
        const newSpeed = Math.min(this.speed+15*input.brake*dt, CONFIG.maxSpeed*0.4);
        if (this.speed < 0.5) { this.vel.x = -hfwdX*newSpeed; this.vel.z = -hfwdZ*newSpeed; }
        else { const r = newSpeed/(this.speed+0.01); this.vel.x *= r; this.vel.z *= r; }
        this.speed = newSpeed;
      }
    }

    const fwdSpeed = this.vel.x*hfwdX+this.vel.z*hfwdZ;
    const rightX2 = Math.cos(this.heading), rightZ2 = -Math.sin(this.heading);
    const latSpeed = this.vel.x*rightX2+this.vel.z*rightZ2;
    const keep = input.drift ? 0.95 : 0.1;
    this.vel.x = hfwdX*fwdSpeed+rightX2*latSpeed*keep;
    this.vel.z = hfwdZ*fwdSpeed+rightZ2*latSpeed*keep;

    this.speed = Math.sqrt(this.vel.x**2+this.vel.z**2);
    if (input.throttle<0.1 && input.brake<0.1 && this.speed>0.1) {
      const totalDrag = (2.0*(this.speed/CONFIG.maxSpeed)**2+1.0)*dt;
      const newSpeed = Math.max(0, this.speed-totalDrag);
      const r = newSpeed/(this.speed+0.01);
      this.vel.x *= r; this.vel.z *= r; this.speed = newSpeed;
    }

    this.vel.x *= 0.99; this.vel.z *= 0.99;
    this.speed = Math.sqrt(this.vel.x**2+this.vel.z**2);
    this.pos.x += this.vel.x*dt;
    this.pos.z += this.vel.z*dt;

    const hw = (trackWidth||CONFIG.trackWidth)/2;
    const effectiveHalf = hw+2-CONFIG.chassisW/2;
    const t = ((this._splineT||0)%1+1)%1;
    const nearest = spline.getPointAt(t);
    const tangent = spline.getTangentAt(t);
    const rvx = tangent.z, rvz = -tangent.x;
    const dx = this.pos.x-nearest.x, dz = this.pos.z-nearest.z;
    const lateralOffset = dx*rvx+dz*rvz;

    if (Math.abs(lateralOffset) > effectiveHalf) {
      const side = lateralOffset>0?1:-1;
      const correction = effectiveHalf*side-lateralOffset;
      this.pos.x += rvx*correction;
      this.pos.z += rvz*correction;
      const latVel = this.vel.x*rvx+this.vel.z*rvz;
      this.vel.x -= rvx*latVel;
      this.vel.z -= rvz*latVel;
      this.speed = Math.sqrt(this.vel.x**2+this.vel.z**2);
    }

    this.physics.heading = this.heading;
    this._lateralOffset = lateralOffset;
  }
}

// === 车与车碰撞 ===
function handleCarCollisions(karts, dt) {
  const carRadius = 1.5;
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i], b = karts[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      const minDist = carRadius * 2;
      if (dist < minDist && dist > 0.01) {
        const overlap = minDist - dist;
        const nx = dx/dist, nz = dz/dist;
        const push = overlap * 8;
        a.pos.x -= nx*push*dt; a.pos.z -= nz*push*dt;
        b.pos.x += nx*push*dt; b.pos.z += nz*push*dt;
        const relVx = b.vel.x-a.vel.x, relVz = b.vel.z-a.vel.z;
        const relDot = relVx*nx + relVz*nz;
        if (relDot < 0) {
          const impulse = relDot * 0.5;
          a.vel.x += nx*impulse; a.vel.z += nz*impulse;
          b.vel.x -= nx*impulse; b.vel.z -= nz*impulse;
          const spdA = Math.sqrt(a.vel.x**2+a.vel.z**2)*0.85;
          const spdB = Math.sqrt(b.vel.x**2+b.vel.z**2)*0.85;
          const rA = spdA/(Math.sqrt(a.vel.x**2+a.vel.z**2)+0.01);
          const rB = spdB/(Math.sqrt(b.vel.x**2+b.vel.z**2)+0.01);
          a.vel.x *= rA; a.vel.z *= rA; a.speed = spdA;
          b.vel.x *= rB; b.vel.z *= rB; b.speed = spdB;
        }
      }
    }
  }
}

// === 初始化一辆车到赛道上 ===
function initKartAt(spline, splineT) {
  const kart = new RealKart();
  const pos = spline.getPointAt(splineT);
  const tan = spline.getTangentAt(splineT);
  kart.pos.x = pos.x; kart.pos.z = pos.z;
  kart.heading = Math.atan2(tan.x, tan.z);
  kart.targetHeading = kart.heading;
  kart.vel.x = Math.sin(kart.heading)*0.1;
  kart.vel.z = Math.cos(kart.heading)*0.1;
  kart.speed = 0.1; kart._splineT = splineT;
  return kart;
}

// === 多车模拟：4车同场竞技 ===
function runMultiCarRace(spline, track, checkpoints) {
  const configs = [
    { diff: 0, name: '闪电', startT: 0.001 },
    { diff: 1, name: '疾风', startT: 0.004 },
    { diff: 2, name: '烈焰', startT: 0.007 },
  ];

  const karts = [];
  const ais = [];
  const startPositions = [0.001, 0.004, 0.007, 0.010];

  // 单车测试模式（取消注释切换）
  // for (let i = 0; i < 1; i++) {
  for (let i = 0; i < 4; i++) {
    const diffIdx = i < 3 ? i : 1; // 第4辆车用疾风难度作为玩家占位
    const kart = initKartAt(spline, startPositions[i]);
    const ai = new AIController(diffIdx, track, i);
    ai.speedCoeff = CONFIG.aiSpeeds[diffIdx];
    ai.initPosition({x:kart.pos.x, y:0, z:kart.pos.z});
    karts.push(kart);
    ais.push(ai);
  }

  // 每辆车的检查点状态
  const carState = karts.map(() => ({
    lastCheckpoint: 0, laps: 0, wallFrames: 0, maxDev: 0, reverseCount: 0,
    wallHits: [] // 记录每次撞墙的位置 {frame, t, x, z, curvature, lateralOffset}
  }));
  let totalFrames = 0;
  const allFinished = [false, false, false, false];
  const finishTimes = [0, 0, 0, 0];

  while (totalFrames < 18000) {
    let allDone = true;

    // 每辆车更新splineT
    for (let i = 0; i < 4; i++) {
      let bestT = karts[i]._splineT||0, bestDist = Infinity;
      for (let dt = -0.01; dt <= 0.06; dt += 0.001) {
        let t = (bestT+dt+1)%1;
        const p = spline.getPointAt(t);
        const d = (karts[i].pos.x-p.x)**2+(karts[i].pos.z-p.z)**2;
        if (d < bestDist) { bestDist = d; bestT = t; }
      }
      karts[i]._splineT = bestT;
    }

    // 每辆车计算输入并更新
    for (let i = 0; i < 4; i++) {
      if (allFinished[i]) continue;
      allDone = false;

      const input = ais[i].getInput(karts[i], karts);
      karts[i].update(input, spline, CONFIG.trackWidth);

      // 撞墙检测
      const dev = Math.abs(karts[i]._lateralOffset||0);
      if (dev > carState[i].maxDev) carState[i].maxDev = dev;
      const effectiveHalf = CONFIG.trackWidth/2+2-CONFIG.chassisW/2;
      if (dev > effectiveHalf) {
        carState[i].wallFrames++;
        // 计算当前位置的曲率（用前后各0.01的切线角度差）
        const curT = ((karts[i]._splineT||0)%1+1)%1;
        const dtCurv = 0.015;
        const t1 = (curT - dtCurv + 1) % 1;
        const t2 = (curT + dtCurv) % 1;
        const tan1 = spline.getTangentAt(t1);
        const tan2 = spline.getTangentAt(t2);
        const cross = tan1.x*tan2.z - tan1.z*tan2.x;
        const dot = tan1.x*tan2.x + tan1.z*tan2.z;
        const curvature = Math.abs(Math.atan2(cross, dot)) / (dtCurv * 2); // 弧度/弧长单位
        // 避免同帧重复记录
        const lastHit = carState[i].wallHits[carState[i].wallHits.length - 1];
        if (!lastHit || lastHit.frame !== totalFrames) {
          carState[i].wallHits.push({
            frame: totalFrames,
            t: curT,
            x: karts[i].pos.x,
            z: karts[i].pos.z,
            curvature: curvature,
            lateralOffset: karts[i]._lateralOffset || 0
          });
        }
      }
      if (ais[i].reverseTimer === 14) carState[i].reverseCount++;

      // 检查圈数
      const currentT = ((karts[i]._splineT||0)%1+1)%1;
      const nextIdx = (carState[i].lastCheckpoint+1)%checkpoints.length;
      const cpDist = Math.abs(currentT-checkpoints[nextIdx].t);
      if (cpDist < 0.02 || cpDist > 0.98) {
        if (nextIdx === 0 && carState[i].lastCheckpoint === checkpoints.length-1) {
          carState[i].laps++;
          if (carState[i].laps >= CONFIG.totalLaps) {
            allFinished[i] = true;
            finishTimes[i] = totalFrames/60;
          }
        }
        carState[i].lastCheckpoint = nextIdx;
      }
    }

    // 车与车碰撞
    handleCarCollisions(karts, 1/60);

    totalFrames++;

    if (allDone) break;
  }

  // 超时未完成的车
  for (let i = 0; i < 4; i++) {
    if (!allFinished[i]) finishTimes[i] = totalFrames/60;
  }

  return { karts, ais, carState, finishTimes, allFinished };
}

// === 撞墙位置分析 ===
function analyzeWallHits(spline, allWallHits, names) {
  // 1. 先计算赛道各段曲率
  const numBins = 50;
  const curvatureProfile = [];
  for (let i = 0; i < numBins; i++) {
    const t = i / numBins;
    const dtCurv = 0.015;
    const t1 = (t - dtCurv + 1) % 1;
    const t2 = (t + dtCurv) % 1;
    const tan1 = spline.getTangentAt(t1);
    const tan2 = spline.getTangentAt(t2);
    const cross = tan1.x*tan2.z - tan1.z*tan2.x;
    const dot = tan1.x*tan2.x + tan1.z*tan2.z;
    const curv = Math.abs(Math.atan2(cross, dot)) / (dtCurv * 2);
    curvatureProfile.push({ t, curv });
  }

  // 2. 将赛道分成区间，统计每个区间的撞墙次数和平均曲率
  const bins = curvatureProfile.map((cp, i) => ({
    tStart: cp.t,
    tEnd: (i + 1) / numBins,
    curvature: cp.curv,
    wallHits: 0,
    cars: {}
  }));

  // 统计所有车的撞墙
  for (let c = 0; c < allWallHits.length; c++) {
    for (const hit of allWallHits[c]) {
      const binIdx = Math.floor(hit.t * numBins) % numBins;
      bins[binIdx].wallHits++;
      bins[binIdx].cars[names[c]] = (bins[binIdx].cars[names[c]] || 0) + 1;
    }
  }

  // 3. 输出曲率分布
  console.log('\n=== 赛道曲率分布 ===');
  console.log('赛道区间(t值) | 曲率 | 撞墙次数 | 各车撞墙');
  console.log('---|---|---|---');
  for (const bin of bins) {
    if (bin.wallHits > 0) {
      const carDetails = Object.entries(bin.cars).map(([n,c]) => `${n}:${c}`).join(' ');
      const tRange = `${bin.tStart.toFixed(2)}-${bin.tEnd.toFixed(2)}`;
      const bar = '█'.repeat(Math.min(20, bin.wallHits));
      console.log(`| ${tRange} | ${bin.curvature.toFixed(3)} | ${bin.wallHits} ${bar} | ${carDetails} |`);
    }
  }

  // 4. 找出高曲率区间（S弯）
  console.log('\n=== 高曲率区间 (潜在S弯) ===');
  const highCurvBins = bins.filter(b => b.curvature > 0.3).sort((a, b) => b.curvature - a.curvature);
  for (const bin of highCurvBins) {
    const tRange = `${bin.tStart.toFixed(2)}-${bin.tEnd.toFixed(2)}`;
    const wallInfo = bin.wallHits > 0 ? `撞墙${bin.wallHits}次` : '无撞墙';
    console.log(`  t=${tRange} 曲率=${bin.curvature.toFixed(3)} ${wallInfo}`);
  }

  // 5. 找出撞墙集中区
  console.log('\n=== 撞墙热区 (top 10) ===');
  const hotBins = bins.filter(b => b.wallHits > 0).sort((a, b) => b.wallHits - a.wallHits).slice(0, 10);
  for (const bin of hotBins) {
    const tRange = `${bin.tStart.toFixed(2)}-${bin.tEnd.toFixed(2)}`;
    const carDetails = Object.entries(bin.cars).map(([n,c]) => `${n}:${c}`).join(' ');
    const isHighCurv = bin.curvature > 0.3 ? '⚡高曲率' : '';
    console.log(`  t=${tRange} 曲率=${bin.curvature.toFixed(2)} 撞墙=${bin.wallHits} ${isHighCurv} ${carDetails}`);
  }

  // 6. 汇总统计
  const totalHits = allWallHits.reduce((a, h) => a + h.length, 0);
  const highCurvHits = hotBins.filter(b => b.curvature > 0.3).reduce((a, b) => a + b.wallHits, 0);
  console.log(`\n=== 撞墙位置汇总 ===`);
  console.log(`总撞墙次数: ${totalHits}`);
  console.log(`高曲率区间(>0.3)撞墙: ${highCurvHits} (${totalHits > 0 ? (highCurvHits/totalHits*100).toFixed(1) : 0}%)`);
  console.log(`低曲率区间(≤0.3)撞墙: ${totalHits - highCurvHits} (${totalHits > 0 ? ((totalHits-highCurvHits)/totalHits*100).toFixed(1) : 0}%)`);
}

// === 多车多轮测试 ===
function runTest() {
  console.log('=== 城市街道赛道 多车模拟测试 (4车同场) ===\n');

  const spline = new MockCurve3(cityStreetPoints, 0.5);
  const track = { spline, _trackWidth: CONFIG.trackWidth };
  const checkpoints = createCheckpoints(spline, 10);
  const names = ['闪电', '疾风', '烈焰', '玩家(占位)'];

  const RUNS = 1; // 只跑1轮用于详细分析
  const allResults = names.map(() => []);
  let allWallHitsPerCar = [[], [], [], []]; // 每轮每车的撞墙记录

  for (let r = 0; r < RUNS; r++) {
    console.log(`--- 第${r+1}轮 ---`);
    const result = runMultiCarRace(spline, track, checkpoints);

    for (let i = 0; i < 4; i++) {
      const cs = result.carState[i];
      allResults[i].push({
        time: result.finishTimes[i],
        completed: result.allFinished[i],
        wallFrames: cs.wallFrames,
        maxDev: cs.maxDev,
        reverseCount: cs.reverseCount,
        laps: cs.laps
      });
      allWallHitsPerCar[i].push(...cs.wallHits);
      const status = result.allFinished[i] ? '✅' : '⚠️';
      console.log(`  ${names[i]}: ${result.finishTimes[i].toFixed(1)}s ${status} | 撞墙:${cs.wallFrames}帧 偏移:${cs.maxDev.toFixed(1)}m 倒车:${cs.reverseCount}次`);
    }

    // 输出每车撞墙位置详情
    console.log('\n  === 撞墙位置详情 ===');
    for (let i = 0; i < 4; i++) {
      const hits = result.carState[i].wallHits;
      if (hits.length === 0) {
        console.log(`  ${names[i]}: 无撞墙`);
        continue;
      }
      console.log(`  ${names[i]}: ${hits.length}次撞墙`);
      for (const h of hits) {
        console.log(`    帧${h.frame} t=${h.t.toFixed(3)} 位置(${h.x.toFixed(1)},${h.z.toFixed(1)}) 曲率=${h.curvature.toFixed(3)} 横向偏移=${h.lateralOffset.toFixed(2)}m`);
      }
    }
    console.log('');
  }

  // 撞墙位置分析
  analyzeWallHits(spline, allWallHitsPerCar, names);
}

function createCheckpoints(spline, num=10) {
  const cps = [];
  for (let i = 0; i < num; i++) {
    const t = i/num;
    cps.push({t, pos: spline.getPointAt(t), tan: spline.getTangentAt(t)});
  }
  return cps;
}

runTest();
