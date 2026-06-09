import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Catalunya Circuit scenery builder
 */
export function buildCatalunyaScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. MAIN GRANDSTAND - Iconic Circuit de Barcelona main straight stand
    //    White/cream concrete structure with cantilevered roof
    // ============================================================
    placeStand(0.05, hw + 22, -1, 50, 12, 10, 0xf0ebe3, 0xddddcc);

    // ============================================================
    // 2. TURN 1 GRANDSTAND - Spectator seating at first corner
    // ============================================================
    placeStand(0.12, hw + 18, 1, 30, 8, 8, 0xf0ebe3, 0xddddcc);

    // ============================================================
    // 3. Paddock / Pit building - Along the main straight
    // ============================================================
    {
      const { pos, angle } = safeOffset(0.05, hw + 14, -1);
      if (isSafe(pos.x, pos.z, 8)) {
        const pitW = 40, pitH = 4, pitD = 6;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0xd0ccc0, roughness: 0.5, metalness: 0.2 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garage doors (striped red-yellow)
        const garageCount = 8;
        const garageW = pitW / garageCount;
        const doorColors = [0xcc0000, 0xffcc00];
        for (let g = 0; g < garageCount; g++) {
          const doorGeo = new THREE.PlaneGeometry(garageW * 0.7, pitH * 0.7);
          const doorMat = new THREE.MeshStandardMaterial({ color: doorColors[g % 2], roughness: 0.4 });
          const door = new THREE.Mesh(doorGeo, doorMat);
          const localX = (g - garageCount / 2 + 0.5) * garageW;
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          door.position.set(
            pos.x + localX * cosA + (pitD / 2 + 0.05) * sinA,
            pos.y + pitH * 0.4,
            pos.z - localX * sinA + (pitD / 2 + 0.05) * cosA
          );
          door.rotation.y = angle;
          track._add(door);
        }
      }
    }

    // ============================================================
    // 4. PALM TREES - Mediterranean vegetation (scattered around circuit)
    //    Iconic feature of the Barcelona circuit surroundings
    // ============================================================
    {
      const palmCount = 50;
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.28, 6.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });

      const canopyGeo1 = new THREE.ConeGeometry(2.8, 2.0, 6);
      const canopyGeo2 = new THREE.ConeGeometry(2.2, 2.8, 8);
      const canopyMat1 = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
      const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.8 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
      const canopy1 = new THREE.InstancedMesh(canopyGeo1, canopyMat1, Math.floor(palmCount * 0.6));
      const canopy2 = new THREE.InstancedMesh(canopyGeo2, canopyMat2, Math.ceil(palmCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
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
        dummy.position.set(x, y + 3.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        // Palm canopy
        dummy.position.set(x, y + 6.5 * scale, z);
        dummy.scale.set(scale * 1.2, scale * 0.8, scale * 1.2);
        dummy.updateMatrix();
        if (i < palmCount * 0.6) {
          canopy1.setMatrixAt(idx1++, dummy.matrix);
        } else {
          canopy2.setMatrixAt(idx2++, dummy.matrix);
        }
      }

      trunkMesh.instanceMatrix.needsUpdate = true;
      canopy1.count = idx1;
      canopy1.instanceMatrix.needsUpdate = true;
      canopy2.count = idx2;
      canopy2.instanceMatrix.needsUpdate = true;
      track._add(trunkMesh);
      track._add(canopy1);
      track._add(canopy2);
    }

    // ============================================================
    // 5. PALM TREE GROVES - Clustered along straights
    // ============================================================
    {
      const grovePositions = [
        { t: 0.15, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.55, side: 1 },
        { t: 0.75, side: -1 },
        { t: 0.92, side: 1 },
      ];

      for (const gp of grovePositions) {
        const { pos } = safeOffset(gp.t, hw + 30, gp.side);
        if (!isSafe(pos.x, pos.z, 15)) continue;

        const groveCount = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < groveCount; j++) {
          const ox = (Math.random() - 0.5) * 12;
          const oz = (Math.random() - 0.5) * 12;
          const gx = pos.x + ox;
          const gz = pos.z + oz;
          if (track.distToTrack(gx, gz) < hw + 12) continue;

          const gy = track.getTerrainHeight(gx, gz);
          const s = 0.7 + Math.random() * 0.5;

          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 5.5 * s, 6),
            new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 })
          );
          trunk.position.set(gx, gy + 2.8 * s, gz);
          trunk.castShadow = true;
          track._add(trunk);

          const canopy = new THREE.Mesh(
            new THREE.ConeGeometry(2.5 * s, 2.0 * s, 6),
            new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 })
          );
          canopy.position.set(gx, gy + 6.2 * s, gz);
          canopy.castShadow = true;
          track._add(canopy);
        }
      }
    }

    // ============================================================
    // 6. SPONSOR BOARDS - Spanish GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'CIRCUIT BARCELONA', bg: '#cc0000', fg: '#ffcc00' },
        { name: 'REPSOL', bg: '#ff6600', fg: '#ffffff' },
        { name: 'SPANISH GP', bg: '#cc0000', fg: '#ffffff' },
      ];

      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
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
        { t: 0.10, side: 1 },
        { t: 0.25, side: -1 },
        { t: 0.45, side: 1 },
        { t: 0.65, side: -1 },
        { t: 0.85, side: 1 },
      ];

      for (const tp of tirePositions) {
        const { pos, angle } = safeOffset(tp.t, hw + 2, tp.side);
        if (!isSafe(pos.x, pos.z, 1)) continue;

        for (let j = 0; j < 5; j++) {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          const localX = (j - 2) * 0.8;
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          tire.position.set(
            pos.x + localX * cosA,
            pos.y + 0.35,
            pos.z - localX * sinA
          );
          tire.rotation.x = Math.PI / 2;
          tire.rotation.y = angle;
          tire.castShadow = true;
          track._add(tire);
        }
      }
    }

    // ============================================================
    // 8. MEDITERRANEAN SHRUBS / OLIVE TREES - Low vegetation clusters
    // ============================================================
    {
      const shrubGeo = new THREE.SphereGeometry(1.5, 6, 5);
      const shrubMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9 });
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 2.0, 5);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });

      const shrubCount = 30;
      for (let i = 0; i < shrubCount; i++) {
        const t = Math.random();
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 15 + Math.random() * 40;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;
        if (track.distToTrack(x, z) < hw + 12) continue;

        const y = track.getTerrainHeight(x, z);
        const s = 0.6 + Math.random() * 0.8;

        // Olive tree trunk
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, y + 1.0 * s, z);
        trunk.scale.set(s, s, s);
        trunk.castShadow = true;
        track._add(trunk);

        // Olive canopy
        const canopy = new THREE.Mesh(shrubGeo, shrubMat);
        canopy.position.set(x, y + 2.8 * s, z);
        canopy.scale.set(s * 1.2, s * 0.9, s * 1.2);
        canopy.castShadow = true;
        track._add(canopy);
      }
    }
}
