const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data/tracks.json'));
const track = data.tracks.find(t => t.id === 'city-streets');
const pts = track.points;
const trackWidth = track.trackWidth || 13;

function catmullRomPoint(pts, t) {
  const n = pts.length;
  const f = ((t % 1) + 1) % 1 * n;
  const i = Math.floor(f);
  const frac = f - i;
  const p0 = pts[(i-1+n)%n], p1 = pts[i%n], p2 = pts[(i+1)%n], p3 = pts[(i+2)%n];
  const tt = frac, tt2 = tt*tt, tt3 = tt2*tt;
  return [0.5*((2*p1[0])+(-p0[0]+p2[0])*tt+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*tt2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*tt3), 0, 0.5*((2*p1[2])+(-p0[2]+p2[2])*tt+(2*p0[2]-5*p1[2]+4*p2[2]-p3[2])*tt2+(-p0[2]+3*p1[2]-3*p2[2]+p3[2])*tt3)];
}
function catmullRomTangent(pts, t) {
  const n = pts.length;
  const f = ((t % 1) + 1) % 1 * n;
  const i = Math.floor(f);
  const frac = f - i;
  const p0 = pts[(i-1+n)%n], p1 = pts[i%n], p2 = pts[(i+1)%n], p3 = pts[(i+2)%n];
  const tt = frac, tt2 = tt*tt;
  return [0.5*((-p0[0]+p2[0])+(4*p0[0]-10*p1[0]+8*p2[0]-2*p3[0])*tt+(-3*p0[0]+9*p1[0]-9*p2[0]+3*p3[0])*tt2), 0.5*((-p0[2]+p2[2])+(4*p0[2]-10*p1[2]+8*p2[2]-2*p3[2])*tt+(-3*p0[2]+9*p1[2]-9*p2[2]+3*p3[2])*tt2)];
}

const N = 600;
const halfW = trackWidth / 2 * 0.85;
const MAX_SPEED = 55;         // 200 km/h — user's observed max
const MIN_TURN = 20;          // 72 km/h — minimum in tight turns
const BRAKE_DECEL = 25;       // m/s² — moderate braking (game has low brakeForce)

const centerPts = [], normals = [];
for (let i = 0; i < N; i++) {
  centerPts.push(catmullRomPoint(pts, i/N));
  const tan = catmullRomTangent(pts, i/N);
  const len = Math.sqrt(tan[0]**2+tan[1]**2)||1;
  normals.push([-tan[1]/len, tan[0]/len]);
}

function buildPath(off) {
  const r = [];
  for (let i = 0; i < N; i++) r.push([centerPts[i][0]+normals[i][0]*off[i], 0, centerPts[i][2]+normals[i][1]*off[i]]);
  return r;
}
function k(path, i) {
  const n = path.length;
  const p0 = path[(i-1+n)%n], p1 = path[i], p2 = path[(i+1)%n];
  return (p1[0]-p0[0])*(p2[2]-p1[2])-(p1[2]-p0[2])*(p2[0]-p1[0]);
}
function computeDs(path) {
  const ds = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const p0 = path[i], p1 = path[(i+1)%N];
    ds[i] = Math.sqrt((p1[0]-p0[0])**2 + (p1[2]-p0[2])**2);
  }
  return ds;
}

function velocityProfile(off) {
  const path = buildPath(off);
  const ds = computeDs(path);

  // Curvature-based speed limit
  const vLimit = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const c = Math.abs(k(path, i));
    // Higher curvature → lower speed. Use physical formula with adjusted mu.
    // v = sqrt(mu_eff * g / κ), where mu_eff ≈ 2.0 (game allows grip driving + some drift)
    const cornerSpeed = Math.sqrt(2.0 * 9.81 / Math.max(c, 0.001));
    vLimit[i] = Math.max(MIN_TURN, Math.min(MAX_SPEED, cornerSpeed));
  }

  // Backward: braking
  const vBrake = new Float64Array(N);
  vBrake[0] = vLimit[0];
  for (let i = 1; i < N; i++) {
    vBrake[i] = Math.min(vLimit[i], Math.sqrt(vBrake[(i-1)%N]**2 + 2*BRAKE_DECEL*ds[(i-1)%N]));
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < N; i++) {
      const idx = (i+1)%N;
      vBrake[idx] = Math.min(vBrake[idx], Math.sqrt(vBrake[i]**2 + 2*BRAKE_DECEL*ds[i]));
    }
  }

  // Forward: acceleration (3-stage)
  function accelRate(v) {
    if (v < 27.78) return 13.75;
    if (v < 41.67) return 6.0;
    return 3.0;
  }
  const vAccel = new Float64Array(N);
  vAccel[0] = Math.min(vLimit[0], vBrake[0]);
  for (let i = 1; i < N; i++) {
    const a = accelRate((vAccel[(i-1)%N]+vLimit[i])/2);
    vAccel[i] = Math.min(vLimit[i], vBrake[i], Math.sqrt(vAccel[(i-1)%N]**2 + 2*a*ds[(i-1)%N]));
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < N; i++) {
      const idx = (i+1)%N;
      const a = accelRate((vAccel[i]+vLimit[idx])/2);
      vAccel[idx] = Math.min(vAccel[idx], vLimit[idx], vBrake[idx], Math.sqrt(vAccel[i]**2 + 2*a*ds[i]));
    }
  }

  return { vFinal: vAccel, ds, vLimit };
}

function lapTime(off) {
  const { vFinal, ds } = velocityProfile(off);
  let t = 0;
  for (let i = 0; i < N; i++) t += ds[i] / Math.max(vFinal[i], 1);
  return t;
}

// True curvature
const trueCurv = new Float64Array(N);
for (let i = 0; i < N; i++) {
  const t = i/N, h = 0.001;
  const pM = catmullRomPoint(pts, (t-h+1)%1), pB = catmullRomPoint(pts, t), pP = catmullRomPoint(pts, (t+h)%1);
  const xp = (pP[0]-pM[0])/(2*h), zp = (pP[2]-pM[2])/(2*h);
  const xpp = (pP[0]-2*pB[0]+pM[0])/(h*h), zpp = (pP[2]-2*pB[2]+pM[2])/(h*h);
  const speed = Math.sqrt(xp*xp+zp*zp);
  trueCurv[i] = (xp*zpp-zp*xpp)/Math.max(speed*speed*speed, 1e-10);
}
let smC = new Float64Array(trueCurv);
for (let iter = 0; iter < 20; iter++) {
  const nxt = new Float64Array(N);
  for (let i = 0; i < N; i++) nxt[i] = 0.25*smC[(i-1+N)%N]+0.5*smC[i]+0.25*smC[(i+1)%N];
  smC = nxt;
}
let totalArc = 0;
for (let i = 0; i < N; i++) {
  const p0 = catmullRomPoint(pts, i/N), p1 = catmullRomPoint(pts, ((i+1)%N)/N);
  totalArc += Math.sqrt((p1[0]-p0[0])**2+(p1[2]-p0[2])**2);
}
const ds = totalArc/N, ds2 = ds*ds;

console.log(`Track: ${track.name}, length: ${totalArc.toFixed(0)}m`);
console.log(`MAX: ${MAX_SPEED}m/s (${MAX_SPEED*3.6}km/h), MIN_TURN: ${MIN_TURN}m/s, BRAKE: ${BRAKE_DECEL}m/s²`);

const clTime = lapTime(new Float64Array(N));
console.log(`Centerline: ${clTime.toFixed(2)}s`);

// MCP
const offsets = new Float64Array(N);
for (let iter = 0; iter < 50000; iter++) {
  for (let i = 0; i < N; i++) {
    const target = (offsets[(i-1+N)%N]+offsets[(i+1)%N]+smC[i]*ds2)/2;
    offsets[i] = Math.max(-halfW, Math.min(halfW, target));
  }
}

let bestTime = Infinity, bestOff = null;
for (const frac of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
  let maxRaw = 0;
  for (let i = 0; i < N; i++) maxRaw = Math.max(maxRaw, Math.abs(offsets[i]));
  const testOff = new Float64Array(N);
  for (let i = 0; i < N; i++) testOff[i] = offsets[i] * (halfW*frac/maxRaw);
  const t = lapTime(testOff);
  console.log(`  offset=${(frac*100).toFixed(0)}%: ${t.toFixed(2)}s`);
  if (t < bestTime) { bestTime = t; bestOff = testOff; }
}

console.log(`\nBest: ${bestTime.toFixed(2)}s`);
const p = velocityProfile(bestOff);
console.log(`Speed range: ${(Math.min(...p.vFinal)*3.6).toFixed(0)}-${(Math.max(...p.vFinal)*3.6).toFixed(0)} km/h`);

fs.writeFileSync('data/racing-line-city-streets.json', JSON.stringify({
  trackId: 'city-streets', offsets: Array.from(bestOff), lapTime: bestTime,
  method: 'MCP-calibrated', params: { MAX_SPEED, MIN_TURN, BRAKE_DECEL }
}));
console.log('Saved');
