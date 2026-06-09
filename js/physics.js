import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js?v=2';

export class KartPhysics {
  constructor(world, startPos, startAngle, track, mass = CONFIG.kartMass) {
    this.world = world;
    this.track = track;
    this.mass = mass;
    const chassisShape = new CANNON.Box(new CANNON.Vec3(CONFIG.chassisW / 2, CONFIG.chassisH / 2, CONFIG.chassisL / 2));
    this.chassisBody = new CANNON.Body({ mass, material: new CANNON.Material({ friction: 0.8 }) });
    this.chassisBody.addShape(chassisShape);
    this.chassisBody.position.set(startPos.x, startPos.y + 0.5, startPos.z);
    this.chassisBody.linearDamping = 0.01;
    this.chassisBody.angularDamping = 0.99;

    const q = new CANNON.Quaternion();
    q.setFromEuler(0, startAngle, 0);
    this.chassisBody.quaternion.copy(q);

    this.heading = startAngle;
    world.addBody(this.chassisBody);

    this.speed = 0;
    this.isDrifting = false;
    this.currentSplineT = 0;
  }

  update(throttle, brake, steer, drift, dt) {
    const vel = this.chassisBody.velocity;
    this.speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

    // Determine if moving forward or backward
    const fwdX = Math.sin(this.heading);
    const fwdZ = Math.cos(this.heading);
    const fwdDot = vel.x * fwdX + vel.z * fwdZ;
    const isReversing = fwdDot < -0.5;

    // Steering - reverse direction when backing up
    if (this.speed > 0.5) {
      const speedRatio = this.speed / CONFIG.maxSpeed;
      const steerLimit = CONFIG.steerAngle * (1 - speedRatio * 0.3);
      const steerInput = steer * steerLimit;
      const turnAmount = steerInput * 2.5 * Math.min(1, this.speed / 5) * (1 + this.speed / 60);
      // Reverse steering when backing up
      this.heading += (isReversing ? -turnAmount : turnAmount) * dt;
    }

    // Compute tilt from track surface
    const info = this.getTrackInfo();
    const pitchBlend = 0.5;
    const rollBlend = 0.8;
    // Pitch: forward slope (negative = uphill = nose up)
    const pitch = Math.atan2(-info.forwardSlope * pitchBlend, 1);
    // Roll: cross-slope (positive = right side higher = tilt right)
    const roll = Math.atan2(info.crossSlope * rollBlend, 1);

    // Store target quaternion for smooth interpolation
    const tiltQuat = new CANNON.Quaternion();
    tiltQuat.setFromEuler(pitch, 0, roll);
    const headingQuat = new CANNON.Quaternion();
    headingQuat.setFromEuler(0, this.heading, 0);
    const targetQuat = new CANNON.Quaternion();
    headingQuat.mult(tiltQuat, targetQuat);

    // Smooth quaternion interpolation to avoid sudden jumps
    const currentQuat = this.chassisBody.quaternion;
    const slerpFactor = 0.5; // Higher = more responsive visual rotation
    currentQuat.slerp(targetQuat, slerpFactor, this.chassisBody.quaternion);

    // Engine: direct velocity control for instant response
    const reverseMaxSpeed = CONFIG.maxSpeed * 0.4;

    if (throttle > 0) {
      // Check if velocity is pointing backward (opposite to heading direction)
      const currentVelFwd = vel.x * fwdX + vel.z * fwdZ;

      if (currentVelFwd < -1.0) {
        // REVERSING + THROTTLE = IMMEDIATELY switch to forward!
        // Set velocity to forward direction with proportional speed
        const reverseSpeed = Math.abs(currentVelFwd);
        const newForwardSpeed = Math.max(5, reverseSpeed * 0.5);  // At least 5 m/s forward

        // Force velocity to forward direction
        vel.x = fwdX * newForwardSpeed;
        vel.z = fwdZ * newForwardSpeed;
      } else {
        // Forward or stopped - normal forward acceleration
        const currentSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        let targetSpeed;

        // SU7 Ultra加速曲线：分三段，低速段加速最快，高速段逐渐减弱
        // 原始值除以4以获得更好的操控感
        if (currentSpeed < 27.78) {        // 0-100km/h
          targetSpeed = currentSpeed + 13.75 * dt * throttle;
        } else if (currentSpeed < 55.56) { // 100-200km/h
          targetSpeed = currentSpeed + 4.625 * dt * throttle;
        } else {                           // 200-300km/h
          targetSpeed = currentSpeed + 2.325 * dt * throttle;
        }

        targetSpeed = Math.min(targetSpeed, CONFIG.maxSpeed);

        // Apply speed in forward direction
        if (currentSpeed > 0.1) {
          const scale = targetSpeed / currentSpeed;
          vel.x *= scale;
          vel.z *= scale;
        } else {
          vel.x = fwdX * targetSpeed;
          vel.z = fwdZ * targetSpeed;
        }
      }
    }

    // Braking / Reverse: when brake is pressed (down arrow)
    if (brake > 0) {
      if (!isReversing && this.speed > 0.5) {
        // Strong braking - proportional to speed for realistic feel
        const brakeForce = 40;  // Strong deceleration
        const newSpeed = Math.max(0, this.speed - brakeForce * dt);
        const scale = newSpeed / this.speed;
        vel.x *= scale;
        vel.z *= scale;
      } else if (isReversing || this.speed <= 0.5) {
        // Reverse acceleration when stopped or reversing
        const reverseAccel = 15;  // Reverse acceleration
        const currentReverseSpeed = isReversing ? this.speed : 0;

        if (currentReverseSpeed < reverseMaxSpeed) {
          // Accelerate in reverse direction
          vel.x -= fwdX * reverseAccel * dt;
          vel.z -= fwdZ * reverseAccel * dt;
        } else {
          // Cap reverse speed
          const newSpeed = reverseMaxSpeed;
          if (this.speed > 0.1) {
            const scale = newSpeed / this.speed;
            vel.x *= scale;
            vel.z *= scale;
          }
        }
      }
    }

    // Lateral friction: remove sideways velocity
    // IMPORTANT: recalculate fwdDot after velocity changes!
    const currentFwdDot = vel.x * fwdX + vel.z * fwdZ;
    if (this.speed > 0.5) {
      const sideX = vel.x - fwdX * currentFwdDot;
      const sideZ = vel.z - fwdZ * currentFwdDot;
      const keep = this.isDrifting ? 0.95 : 0.1;

      // Keep forward/backward component + small lateral
      vel.x = fwdX * currentFwdDot + sideX * keep;
      vel.z = fwdZ * currentFwdDot + sideZ * keep;
    }

    // Air drag + rolling resistance (always active, simulates real deceleration)
    if (this.speed > 0.1 && throttle <= 0 && brake <= 0) {
      // Only apply when coasting (no throttle or brake)
      const speedNorm = this.speed / CONFIG.maxSpeed;
      // Air drag: proportional to v^2, calibrated so at max speed decel ≈ 2 m/s²
      const airDrag = 2.0 * speedNorm * speedNorm;
      // Rolling resistance: constant ~1 m/s²
      const rollingResistance = 1.0;
      const totalDecel = airDrag + rollingResistance;
      const dragReduction = totalDecel * dt;
      // Don't reduce by more than current speed (avoid negative)
      const dragFactor = Math.max(0, 1 - Math.min(dragReduction, this.speed * 0.5) / this.speed);
      vel.x *= dragFactor;
      vel.z *= dragFactor;
    }

    this.isDrifting = drift && this.speed > 8;
  }

  postUpdate() {
    const info = this.getTrackInfo();
    const pos = this.chassisBody.position;

    // Compute tilt angles
    const pitchBlend = 0.5;
    const rollBlend = 0.8;
    const pitch = Math.atan2(-info.forwardSlope * pitchBlend, 1);
    const roll = Math.atan2(info.crossSlope * rollBlend, 1);

    // Ground height: road surface at car's lateral position + clearance + tilt dip
    const roadSurfaceY = info.height + info.crossSlope * info.lateralOffset;
    const tiltDip = Math.max(
      (CONFIG.chassisW / 2) * Math.abs(Math.sin(roll)),
      (CONFIG.chassisL / 2) * Math.abs(Math.sin(pitch))
    );
    const groundY = roadSurfaceY + 0.4 + tiltDip;

    // Smooth height interpolation to avoid jumps
    const heightDiff = groundY - pos.y;
    if (Math.abs(heightDiff) > 0.01) {
      // Only adjust if significantly off ground
      pos.y += heightDiff * 0.5; // Smooth follow
      this.chassisBody.position = pos;
      if (this.chassisBody.velocity.y < 0) {
        this.chassisBody.velocity.y *= 0.3;
      }
    }

    // Apply tilt smoothly (needed during COUNTDOWN when update() is not called)
    const tiltQuat = new CANNON.Quaternion();
    tiltQuat.setFromEuler(pitch, 0, roll);
    const headingQuat = new CANNON.Quaternion();
    headingQuat.setFromEuler(0, this.heading, 0);
    const targetQuat = new CANNON.Quaternion();
    headingQuat.mult(tiltQuat, targetQuat);

    // Smooth quaternion interpolation
    const currentQuat = this.chassisBody.quaternion;
    const slerpFactor = 0.6; // Responsive ground following
    currentQuat.slerp(targetQuat, slerpFactor, this.chassisBody.quaternion);

    // 物理边界与视觉护栏位置对齐
    // 视觉护栏位于 barrierOffset = hw + 2 处，减去车身半宽确保整车在护栏内
    const hw = (this.track._trackWidth || CONFIG.trackWidth) / 2;
    const carHalfW = CONFIG.chassisW / 2;
    const effectiveHalf = hw + 2 - carHalfW;
    if (Math.abs(info.lateralOffset) > effectiveHalf) {
      // 硬边界：将车精确 snap 到边界位置
      const side = info.lateralOffset > 0 ? 1 : -1;
      const targetOffset = effectiveHalf * side;
      const correction = targetOffset - info.lateralOffset;
      pos.x += info.right.x * correction;
      pos.z += info.right.z * correction;
      this.chassisBody.position = pos;

      // 碰撞时消除所有侧向速度（模拟刚性墙壁）
      const vel = this.chassisBody.velocity;
      const latVel = vel.x * info.right.x + vel.z * info.right.z;
      vel.x -= info.right.x * latVel;
      vel.z -= info.right.z * latVel;
    }

    this.chassisBody.angularVelocity.y *= 0.8;
  }

  _findNearestT(x, z) {
    let minDist = Infinity;
    let bestT = 0;
    const sp = this.track.spline;
    for (let t = 0; t < 1; t += 0.005) {
      const p = sp.getPointAt(t);
      const d = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (d < minDist) { minDist = d; bestT = t; }
    }
    const step = 0.005;
    const lo = Math.max(0, bestT - step);
    const hi = Math.min(1, bestT + step);
    for (let t = lo; t <= hi; t += 0.0005) {
      const p = sp.getPointAt(t);
      const d = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (d < minDist) { minDist = d; bestT = t; }
    }
    return { t: bestT, dist: Math.sqrt(minDist) };
  }

  getTrackInfo() {
    const pos = this.chassisBody.position;
    const { t: bestT } = this._findNearestT(pos.x, pos.z);
    this.currentSplineT = bestT;
    const nearest = this.track.spline.getPointAt(bestT);
    const tangent = this.track.spline.getTangentAt(bestT);

    // Right vector: horizontal perpendicular to tangent (for lateral offset)
    const tLen = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z);
    let right;
    if (tLen > 0.001) {
      right = { x: tangent.z / tLen, y: 0, z: -tangent.x / tLen };
    } else {
      right = { x: 1, y: 0, z: 0 };
    }

    const dx = pos.x - nearest.x;
    const dz = pos.z - nearest.z;
    const lateralOffset = dx * right.x + dz * right.z;

    // Forward slope from tangent (exact, no sampling error)
    const baseH = nearest.y;
    const hLen = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z);
    const forwardSlope = hLen > 0.001 ? tangent.y / hLen : 0;

    // Cross-slope from Frenet binormal (road banking)
    let crossSlope = 0;
    if (this.track._frames && this.track._frames.binormals) {
      const binormal = this.track._frames.binormals[Math.round(bestT * this.track._frameCount)];
      if (binormal) crossSlope = binormal.y;
    }
    const normal = { x: 0, y: 1, z: 0 };

    return { height: baseH, nearest, tangent, right, normal, lateralOffset, crossSlope, forwardSlope };
  }

  getTrackHeight() {
    return this.getTrackInfo().height;
  }

  reset(pos, angle) {
    this.heading = angle;
    this.chassisBody.position.set(pos.x, pos.y + 0.5, pos.z);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    const q = new CANNON.Quaternion();
    q.setFromEuler(0, angle, 0);
    this.chassisBody.quaternion.copy(q);
  }
}
