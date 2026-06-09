import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Losail Circuit scenery builder
 */
export function buildLosailScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. MAIN GRANDSTAND - Start/Finish straight (t=0.03)
    //    Losail Circuit main grandstand with Qatar maroon theme
    // ============================================================
    placeStand(0.03, hw + 20, 1, 40, 9, 9, 0x2a2a2a, 0x800020);

    // Pit building - opposite side (t=0.07)
    {
      const { pos, angle } = safeOffset(0.07, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 35, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garages with maroon doors
        const garageColors = [0x800020, 0xffffff, 0x800020, 0xffffff, 0x800020];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.2;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          track._add(g);
        }

        // LOSAIL CIRCUIT sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#800020';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('LOSAIL INTERNATIONAL CIRCUIT', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(16, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        track._add(sign);
      }
    }

    // ============================================================
    // 2. FLOODLIGHT TOWERS - Artificial lighting structures
    //    Losail is famous for its night race under floodlights
    // ============================================================
    {
      const lightTowerPositions = [
        { t: 0.05, side: 1 },
        { t: 0.15, side: -1 },
        { t: 0.25, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.45, side: 1 },
        { t: 0.55, side: -1 },
        { t: 0.65, side: 1 },
        { t: 0.75, side: -1 },
        { t: 0.85, side: 1 },
        { t: 0.95, side: -1 },
      ];

      for (const lt of lightTowerPositions) {
        const { pos, angle } = safeOffset(lt.t, hw + 14, lt.side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const towerH = 18;

        // Main tower pole (steel gray)
        const poleGeo = new THREE.CylinderGeometry(0.3, 0.5, towerH, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.4, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + towerH / 2, pos.z);
        pole.castShadow = true;
        track._add(pole);

        // Cross-arm at top (holds the light bank)
        const armGeo = new THREE.BoxGeometry(6, 0.4, 0.8);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.4, metalness: 0.5 });
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(pos.x, pos.y + towerH, pos.z);
        arm.rotation.y = angle;
        track._add(arm);

        // Light bank (emissive glow)
        const lightBankGeo = new THREE.BoxGeometry(5, 1.5, 0.6);
        const lightBankMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.2, roughness: 0.1
        });
        const lightBank = new THREE.Mesh(lightBankGeo, lightBankMat);
        lightBank.position.set(pos.x, pos.y + towerH - 1.2, pos.z);
        lightBank.rotation.y = angle;
        track._add(lightBank);

        // Base plate
        const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.5, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(pos.x, pos.y + 0.25, pos.z);
        track._add(base);
      }
    }

    // ============================================================
    // 3. SECONDARY GRANDSTANDS - Key corners
    // ============================================================
    placeStand(0.22, hw + 20, -1, 28, 7, 7, 0x333344, 0x800020);  // Turn 1 area
    placeStand(0.40, hw + 18, 1, 22, 5, 6, 0x2a3a4a, 0x666677);   // Mid-section
    placeStand(0.60, hw + 20, -1, 25, 6, 7, 0x3a3a4a, 0x800020);  // Back section
    placeStand(0.80, hw + 18, 1, 20, 5, 6, 0x2a3a4a, 0x666677);   // Near final corner

    // ============================================================
    // 4. PALM TREES - Desert vegetation (scattered around circuit)
    // ============================================================
    {
      const palmCount = 40;
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 5.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
      const leafGeo = new THREE.ConeGeometry(2.5, 2.0, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, palmCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx = 0;
      for (let i = 0; i < palmCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 16 && attempts < 50);

        const y = track.getTerrainHeight(x, z);
        const scale = 0.8 + Math.random() * 0.6;

        // Trunk
        dummy.position.set(x, y + 2.8 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);

        // Palm canopy
        dummy.position.set(x, y + 6.2 * scale, z);
        dummy.scale.set(scale * 1.2, scale * 0.8, scale * 1.2);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(idx, dummy.matrix);
        idx++;
      }

      trunkMesh.count = idx;
      leafMesh.count = idx;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leafMesh.instanceMatrix.needsUpdate = true;
      track._add(trunkMesh);
      track._add(leafMesh);
    }

    // ============================================================
    // 5. DESERT SAND DUNES - Low desert landscaping
    // ============================================================
    {
      const duneGeo = new THREE.SphereGeometry(4, 8, 6);
      const duneMat = new THREE.MeshStandardMaterial({ color: 0xc8a870, roughness: 1.0 });
      const duneCount = 20;

      for (let i = 0; i < duneCount; i++) {
        const t = Math.random();
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 25 + Math.random() * 40;
        const dx = p.x + right.x * dist * side;
        const dz = p.z + right.z * dist * side;
        if (track.distToTrack(dx, dz) < hw + 20) continue;

        const dune = new THREE.Mesh(duneGeo, duneMat);
        const scale = 0.5 + Math.random() * 1.5;
        dune.position.set(dx, track.getTerrainHeight(dx, dz) - 0.5, dz);
        dune.scale.set(scale * (1 + Math.random()), scale * 0.4, scale * (1 + Math.random()));
        track._add(dune);
      }
    }

    // ============================================================
    // 6. SPONSOR BOARDS - Qatar GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'QATAR AIRWAYS', bg: '#7c0053', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'QATAR GP', bg: '#800020', fg: '#ffffff' },
        { name: 'LOSAIL', bg: '#1a1a2e', fg: '#c0a060' },
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

    // ============================================================
    // 7. TIRE WALLS - Key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.10, side: -1 },
        { t: 0.20, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.50, side: 1 },
        { t: 0.65, side: -1 },
        { t: 0.78, side: 1 },
        { t: 0.90, side: -1 },
      ];

      for (const tp of tirePositions) {
        const { pos } = safeOffset(tp.t, hw + 4, tp.side);
        if (!isSafe(pos.x, pos.z, 1)) continue;
        for (let j = 0; j < 4; j++) {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          tire.position.set(
            pos.x + (j % 2) * 1.0 - 0.5,
            pos.y + 0.35 + Math.floor(j / 2) * 0.7,
            pos.z + (Math.floor(j / 2)) * 0.5
          );
          tire.rotation.x = Math.PI / 2;
          track._add(tire);
        }
      }
    }
}
