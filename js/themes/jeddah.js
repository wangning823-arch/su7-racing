import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Jeddah Circuit scenery builder
 */
export function buildJeddahScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    const placeBuilding = (x, z, w, d, h, glassColor) => {
      if (!isSafe(x, z, Math.max(w, d) / 2 + 2)) return;
      if (track.distToTrack(x, z) < hw + 8) return;
      const bodyGeo = new THREE.BoxGeometry(w, h, d);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.2, metalness: 0.7 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(x, h / 2 - 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      track._add(body);
      const glassMat = new THREE.MeshStandardMaterial({ color: glassColor, emissive: glassColor, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.8 });
      const panelGeo = new THREE.PlaneGeometry(w * 0.8, h * 0.8);
      const panel1 = new THREE.Mesh(panelGeo, glassMat);
      panel1.position.set(x, h / 2 - 2, z + d / 2 + 0.05);
      track._add(panel1);
      const panel2 = new THREE.Mesh(panelGeo, glassMat);
      panel2.position.set(x, h / 2 - 2, z - d / 2 - 0.05);
      panel2.rotation.y = Math.PI;
      track._add(panel2);
    };

    const placeFloodlight = (t, dist, side) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;
      const towerH = 20;
      const poleGeo = new THREE.CylinderGeometry(0.25, 0.45, towerH, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.4, metalness: 0.6 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(pos.x, pos.y + towerH / 2, pos.z);
      pole.castShadow = true;
      track._add(pole);
      const armGeo = new THREE.BoxGeometry(7, 0.4, 0.8);
      const armMat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.4, metalness: 0.5 });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(pos.x, pos.y + towerH, pos.z);
      arm.rotation.y = angle;
      track._add(arm);
      const lightBankGeo = new THREE.BoxGeometry(6, 1.5, 0.6);
      const lightBankMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.5, roughness: 0.1 });
      const lightBank = new THREE.Mesh(lightBankGeo, lightBankMat);
      lightBank.position.set(pos.x, pos.y + towerH - 1.2, pos.z);
      lightBank.rotation.y = angle;
      track._add(lightBank);
      const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.5, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(pos.x, pos.y + 0.25, pos.z);
      track._add(base);
    };

    // 1. COASTAL BARRIERS
    {
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.6, metalness: 0.3 });
      for (let i = 0; i < 10; i++) {
        const t = (i + 0.5) / 10;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const angle = Math.atan2(tangent.x, tangent.z);
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 4;
        const wx = p.x + right.x * dist * side;
        const wz = p.z + right.z * dist * side;
        if (!isSafe(wx, wz, 3)) continue;
        const wallGeo = new THREE.BoxGeometry(8, 1.5, 0.5);
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(wx, p.y + 0.75, wz);
        wall.rotation.y = angle;
        wall.castShadow = true;
        track._add(wall);
      }
    }

    // 2. FLOODLIGHT TOWERS
    {
      const positions = [
        { t: 0.03, side: 1 }, { t: 0.08, side: -1 },
        { t: 0.14, side: 1 }, { t: 0.20, side: -1 },
        { t: 0.26, side: 1 }, { t: 0.32, side: -1 },
        { t: 0.38, side: 1 }, { t: 0.44, side: -1 },
        { t: 0.50, side: 1 }, { t: 0.56, side: -1 },
        { t: 0.62, side: 1 }, { t: 0.68, side: -1 },
        { t: 0.74, side: 1 }, { t: 0.80, side: -1 },
        { t: 0.86, side: 1 }, { t: 0.92, side: -1 },
        { t: 0.97, side: 1 },
      ];
      for (const fl of positions) {
        placeFloodlight(fl.t, hw + 14, fl.side);
      }
    }

    // 3. MODERN SKYSCRAPERS
    {
      const buildings = [
        { x: 180, z: -250, w: 14, d: 14, h: 45, gc: 0x1a3355 },
        { x: 220, z: -240, w: 12, d: 12, h: 55, gc: 0x1a4466 },
        { x: 260, z: -230, w: 16, d: 16, h: 38, gc: 0x1a3355 },
        { x: 300, z: -210, w: 10, d: 10, h: 50, gc: 0x225577 },
        { x: 340, z: -100, w: 12, d: 12, h: 42, gc: 0x1a4466 },
        { x: 350, z: 0, w: 14, d: 14, h: 48, gc: 0x1a3355 },
        { x: 330, z: 100, w: 10, d: 10, h: 36, gc: 0x225577 },
        { x: 280, z: 160, w: 16, d: 16, h: 52, gc: 0x1a4466 },
        { x: 200, z: 190, w: 12, d: 12, h: 40, gc: 0x1a3355 },
        { x: 100, z: 170, w: 14, d: 14, h: 46, gc: 0x225577 },
        { x: -10, z: 150, w: 10, d: 10, h: 54, gc: 0x1a4466 },
        { x: -50, z: -240, w: 12, d: 12, h: 44, gc: 0x1a3355 },
        { x: -80, z: -250, w: 16, d: 16, h: 38, gc: 0x225577 },
        { x: -120, z: -200, w: 10, d: 10, h: 60, gc: 0x1a4466 },
        { x: -140, z: -170, w: 14, d: 14, h: 42, gc: 0x1a3355 },
        { x: 120, z: -240, w: 8, d: 8, h: 28, gc: 0x224466 },
        { x: 160, z: -230, w: 10, d: 10, h: 32, gc: 0x1a3355 },
        { x: 250, z: -190, w: 8, d: 8, h: 30, gc: 0x225577 },
        { x: 320, z: -50, w: 10, d: 10, h: 26, gc: 0x1a4466 },
        { x: 310, z: 50, w: 8, d: 8, h: 34, gc: 0x224466 },
        { x: 250, z: 140, w: 10, d: 10, h: 28, gc: 0x1a3355 },
        { x: 50, z: 160, w: 8, d: 8, h: 30, gc: 0x225577 },
        { x: -30, z: -230, w: 10, d: 10, h: 36, gc: 0x1a4466 },
        { x: -90, z: -240, w: 8, d: 8, h: 32, gc: 0x224466 },
        { x: 200, z: -260, w: 10, d: 10, h: 40, gc: 0x1a3355 },
        { x: 280, z: -240, w: 8, d: 8, h: 48, gc: 0x225577 },
        { x: 350, z: -60, w: 10, d: 10, h: 44, gc: 0x1a4466 },
        { x: 340, z: 60, w: 8, d: 8, h: 38, gc: 0x1a3355 },
        { x: 220, z: 200, w: 10, d: 10, h: 42, gc: 0x225577 },
        { x: -100, z: -230, w: 12, d: 12, h: 50, gc: 0x1a4466 },
      ];
      for (const b of buildings) {
        placeBuilding(b.x, b.z, b.w, b.d, b.h, b.gc);
      }
    }

    // 4. MAIN GRANDSTAND
    placeStand(0.03, hw + 22, 1, 45, 10, 10, 0x1a2a1a, 0x00843d);

    // Pit building
    {
      const { pos, angle } = safeOffset(0.07, hw + 20, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 40, pitH = 5, pitD = 8;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.4, metalness: 0.5 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);
        const garageColors = [0x00843d, 0xffffff, 0x00843d, 0xffffff, 0x00843d];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.8;
          g.position.set(pos.x + localX * cosA - (pitD / 2) * sinA, pos.y + 0.5, pos.z - localX * sinA + (pitD / 2) * cosA);
          g.rotation.y = angle;
          track._add(g);
        }
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#00843d';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 32px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('JEDDAH CORNICHE CIRCUIT', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(16, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        track._add(sign);
      }
    }

    // 5. SECONDARY GRANDSTANDS
    placeStand(0.18, hw + 22, -1, 30, 8, 8, 0x1a2a1a, 0x00843d);
    placeStand(0.35, hw + 20, 1, 24, 6, 7, 0x2a3a2a, 0x006633);
    placeStand(0.55, hw + 22, -1, 28, 7, 8, 0x1a2a1a, 0x00843d);
    placeStand(0.75, hw + 20, 1, 22, 6, 7, 0x2a3a2a, 0x006633);

    // 6. SPONSOR BOARDS
    {
      const sponsors = [
        { name: 'SAUDI ARAMCO', bg: '#004d2d', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'ARAMCO', bg: '#004d2d', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'CROWNSTELL', bg: '#1a1a2e', fg: '#c0a060' },
        { name: 'SAUDI GP', bg: '#004d2d', fg: '#ffffff' },
        { name: 'JEDDAH GP', bg: '#1a1a2e', fg: '#00843d' },
        { name: 'F1', bg: '#e10600', fg: '#ffffff' },
      ];
      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;
        if (track.distToTrack(x, z) < hw + 8) continue;
        placeBoard(t, dist, side, sponsors[i % sponsors.length]);
      }
    }

    // 7. STREET LAMP POSTS
    {
      const lampCount = 24;
      for (let i = 0; i < lampCount; i++) {
        const t = (i + 0.5) / lampCount;
        const { pos } = safeOffset(t, hw + 6, i % 2 === 0 ? 1 : -1);
        if (!isSafe(pos.x, pos.z, 2)) continue;
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.7 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 2.5, pos.z);
        track._add(pole);
        const lampGeo = new THREE.SphereGeometry(0.3, 6, 6);
        const lampMat = new THREE.MeshStandardMaterial({ color: 0xffeedd, emissive: 0xffeebb, emissiveIntensity: 1.2, roughness: 0.1 });
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(pos.x, pos.y + 5.2, pos.z);
        track._add(lamp);
      }
    }

    // 8. TIRE WALLS
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const tirePositions = [
        { t: 0.10, side: -1 }, { t: 0.22, side: 1 },
        { t: 0.36, side: -1 }, { t: 0.48, side: 1 },
        { t: 0.62, side: -1 }, { t: 0.76, side: 1 },
        { t: 0.88, side: -1 }, { t: 0.95, side: 1 },
      ];
      for (const tp of tirePositions) {
        const { pos } = safeOffset(tp.t, hw + 4, tp.side);
        if (!isSafe(pos.x, pos.z, 1)) continue;
        for (let j = 0; j < 4; j++) {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          tire.position.set(pos.x + (j % 2) * 1.0 - 0.5, pos.y + 0.35 + Math.floor(j / 2) * 0.7, pos.z + (Math.floor(j / 2)) * 0.5);
          tire.rotation.x = Math.PI / 2;
          track._add(tire);
        }
      }
    }

    // 9. SAUDI FLAG POLES
    {
      const flagColors = [0x00843d, 0xffffff];
      const flagPositions = [
        { t: 0.02, side: 1 }, { t: 0.04, side: -1 },
        { t: 0.06, side: 1 }, { t: 0.08, side: -1 },
      ];
      for (const fp of flagPositions) {
        const { pos } = safeOffset(fp.t, hw + 8, fp.side);
        if (!isSafe(pos.x, pos.z, 2)) continue;
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 8, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 4, pos.z);
        track._add(pole);
        const flagGeo = new THREE.PlaneGeometry(2, 1.2);
        for (let f = 0; f < 2; f++) {
          const flagMat = new THREE.MeshStandardMaterial({ color: flagColors[f], side: THREE.DoubleSide });
          const flag = new THREE.Mesh(flagGeo, flagMat);
          flag.position.set(pos.x, pos.y + 7 - f * 1.5, pos.z + 0.5);
          track._add(flag);
        }
      }
    }
}
