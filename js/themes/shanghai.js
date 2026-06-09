import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Shanghai Circuit scenery builder
 */
export function buildShanghaiScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ========== 主看台（起点直道旁 t≈0.1）==========
    const t1 = 0.1;
    const p1 = track.spline.getPointAt(t1);
    const tan1 = track.spline.getTangentAt(t1);
    const right1 = new THREE.Vector3(tan1.z, 0, -tan1.x).normalize();
    const ang1 = Math.atan2(tan1.x, tan1.z);
    const standW = 30, standH = 8, standD = 8;
    let standPos = null;
    for (let d = hw + 20; d <= hw + 55; d += 5) {
      const tp = p1.clone().add(right1.clone().multiplyScalar(-d));
      if (track.distToTrack(tp.x, tp.z) >= hw + standW / 2 + 8) { standPos = tp; break; }
    }
    if (standPos) {
      const geo = new THREE.BoxGeometry(standW, standH, standD);
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.2 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(standPos.x, standH / 2 - 2, standPos.z);
      mesh.rotation.y = ang1;
      mesh.castShadow = true; mesh.receiveShadow = true;
      track._add(mesh);
      // UFO顶棚
      const rGeo = new THREE.CylinderGeometry(10, 8, 1, 12);
      const rMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.6 });
      const roof = new THREE.Mesh(rGeo, rMat);
      roof.position.set(standPos.x, standH + 1, standPos.z);
      roof.rotation.y = ang1; roof.scale.set(1.5, 1, 0.8);
      roof.castShadow = true;
      track._add(roof);
      // 红白座位
      const seatC = [0xcc0000, 0xcc0000, 0xffffff];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 10; c++) {
          const sg = new THREE.BoxGeometry(2.2, 0.4, 1);
          const sm = new THREE.MeshStandardMaterial({ color: seatC[(r + c) % 3] });
          const s = new THREE.Mesh(sg, sm);
          const off = new THREE.Vector3(-standW / 2 + 2 + c * 2.8, 0.5 + r * 2, -standD / 2 + 1);
          const ro = off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang1);
          s.position.set(standPos.x + ro.x, standH / 2 - 1.5 + ro.y, standPos.z + ro.z);
          s.rotation.y = ang1;
          track._add(s);
        }
      }
    }

    // ========== 副看台（t≈0.5）==========
    const t2 = 0.5;
    const p2 = track.spline.getPointAt(t2);
    const tan2 = track.spline.getTangentAt(t2);
    const right2 = new THREE.Vector3(tan2.z, 0, -tan2.x).normalize();
    const ang2 = Math.atan2(tan2.x, tan2.z);
    const s2W = 25, s2H = 6, s2D = 6;
    let s2Pos = null;
    for (let d = hw + 18; d <= hw + 50; d += 5) {
      const tp = p2.clone().add(right2.clone().multiplyScalar(d));
      if (track.distToTrack(tp.x, tp.z) >= hw + s2W / 2 + 8) { s2Pos = tp; break; }
    }
    if (s2Pos) {
      const g = new THREE.BoxGeometry(s2W, s2H, s2D);
      const m = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(s2Pos.x, s2H / 2 - 2, s2Pos.z);
      mesh.rotation.y = ang2; mesh.castShadow = true;
      track._add(mesh);
    }

    // ========== 维修区大楼（t≈0.05）==========
    const tP = 0.05;
    const pP = track.spline.getPointAt(tP);
    const tanP = track.spline.getTangentAt(tP);
    const rightP = new THREE.Vector3(tanP.z, 0, -tanP.x).normalize();
    const angP = Math.atan2(tanP.x, tanP.z);
    const pitW = 28, pitH = 5, pitD = 6;
    let pitPos = null;
    for (let d = hw + 18; d <= hw + 50; d += 5) {
      const tp = pP.clone().add(rightP.clone().multiplyScalar(-d));
      if (track.distToTrack(tp.x, tp.z) >= hw + pitW / 2 + 8) { pitPos = tp; break; }
    }
    if (pitPos) {
      const g = new THREE.BoxGeometry(pitW, pitH, pitD);
      const m = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.3 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(pitPos.x, pitH / 2 - 2, pitPos.z);
      mesh.rotation.y = angP; mesh.castShadow = true;
      track._add(mesh);
    }

    // ========== 媒体中心（t≈0.3）==========
    const tM = 0.3;
    const pM = track.spline.getPointAt(tM);
    const tanM = track.spline.getTangentAt(tM);
    const rightM = new THREE.Vector3(tanM.z, 0, -tanM.x).normalize();
    const angM = Math.atan2(tanM.x, tanM.z);
    const mcW = 15, mcH = 8, mcD = 6;
    let mcPos = null;
    for (let d = hw + 18; d <= hw + 50; d += 5) {
      const tp = pM.clone().add(rightM.clone().multiplyScalar(d));
      if (track.distToTrack(tp.x, tp.z) >= hw + mcW / 2 + 8) { mcPos = tp; break; }
    }
    if (mcPos) {
      const g = new THREE.BoxGeometry(mcW, mcH, mcD);
      const m = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.3, metalness: 0.4 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(mcPos.x, mcH / 2 - 2, mcPos.z);
      mesh.rotation.y = angM; mesh.castShadow = true;
      track._add(mesh);
    }

    // ========== F1赞助商广告牌（沿赛道均匀分布）==========
    const sponsors = [
      { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
      { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
      { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
      { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
      { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
      { name: 'QATAR', bg: '#7c0053', fg: '#ffffff' },
    ];
    for (let i = 0; i < sponsors.length; i++) {
      const t = (i + 0.5) / sponsors.length;
      const pt = track.spline.getPointAt(t);
      const tg = track.spline.getTangentAt(t);
      const rt = new THREE.Vector3(tg.z, 0, -tg.x).normalize();
      const side = i % 2 === 0 ? 1 : -1;
      const dist = hw + 10 + Math.random() * 4;
      const x = pt.x + rt.x * dist * side;
      const z = pt.z + rt.z * dist * side;
      if (track.distToTrack(x, z) < hw + 6) continue;
      const sp = sponsors[i];
      const pg = new THREE.CylinderGeometry(0.1, 0.1, 3, 6);
      const pm = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7 });
      const post = new THREE.Mesh(pg, pm);
      post.position.set(x, 0, z);
      track._add(post);
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = sp.bg; ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = sp.fg; ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sp.name, 128, 64);
      const tex = new THREE.CanvasTexture(canvas);
      const bg = new THREE.BoxGeometry(6, 3, 0.15);
      const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
      const board = new THREE.Mesh(bg, bm);
      board.position.set(x, 3, z);
      board.rotation.y = Math.atan2(tg.x, tg.z);
      board.castShadow = true;
      track._add(board);
    }
}
