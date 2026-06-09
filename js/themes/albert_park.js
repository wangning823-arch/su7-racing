import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * AlbertPark Circuit scenery builder
 */
export function buildAlbertParkScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. ALBERT PARK LAKE - Central water body inside the circuit
    //    The circuit wraps around this iconic lake
    // ============================================================
    {
      // Estimate track center for lake placement
      let cx = 0, cz = 0;
      let ptCount = 0;
      for (let t = 0; t < 1; t += 0.01) {
        const p = track.spline.getPointAt(t);
        cx += p.x; cz += p.z;
        ptCount++;
      }
      cx /= ptCount; cz /= ptCount;

      const lakeGeo = new THREE.CircleGeometry(60, 32);
      const lakeMat = new THREE.MeshStandardMaterial({
        color: 0x3388aa, roughness: 0.1, metalness: 0.3,
        transparent: true, opacity: 0.85
      });
      const lake = new THREE.Mesh(lakeGeo, lakeMat);
      lake.position.set(cx, -0.15, cz);
      lake.rotation.x = -Math.PI / 2;
      track._add(lake);

      // Lake edge ring (sandy/stone shore)
      const shoreGeo = new THREE.RingGeometry(58, 64, 32);
      const shoreMat = new THREE.MeshStandardMaterial({ color: 0x9a8a6a, roughness: 0.95 });
      const shore = new THREE.Mesh(shoreGeo, shoreMat);
      shore.position.set(cx, -0.1, cz);
      shore.rotation.x = -Math.PI / 2;
      track._add(shore);
    }

    // ============================================================
    // 2. MAIN GRANDSTAND - Start/Finish straight
    //    Large main grandstand with Australian green/gold theme
    // ============================================================
    placeStand(0.03, hw + 22, 1, 45, 10, 10, 0x222233, 0x00843D, [0x00843D, 0xFFCD00, 0x00843D]);

    // Pit building opposite side (t=0.06)
    {
      const { pos, angle } = safeOffset(0.06, hw + 20, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 38, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garages with green doors (Australian GP colors)
        const garageColors = [0x00843D, 0xffffff, 0x00843D, 0xffffff, 0x00843D];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.5;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y + 0.5,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          track._add(g);
        }

        // ALBERT PARK CIRCUIT sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#00843D';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('ALBERT PARK CIRCUIT', 256, 32);
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
    // 3. SECONDARY GRANDSTAND - Turn 1 area (t~0.15)
    //    High-speed first corner viewing stand
    // ============================================================
    placeStand(0.15, hw + 20, -1, 32, 8, 8, 0x333344, 0x00843D, [0xFFCD00, 0xffffff, 0xFFCD00]);

    // ============================================================
    // 4. MELBOURNE SKYLINE - City buildings in background
    //    Distant modern buildings representing Melbourne CBD
    // ============================================================
    {
      const skylineColors = [0x667788, 0x556677, 0x778899, 0x607080, 0x505a6a];
      const buildings = [
        { x: -320, z: -350, w: 12, h: 45, d: 12 },
        { x: -280, z: -380, w: 10, h: 55, d: 10 },
        { x: -250, z: -340, w: 14, h: 35, d: 14 },
        { x: -200, z: -370, w: 11, h: 50, d: 11 },
        { x: -360, z: -320, w: 9, h: 38, d: 9 },
        { x: -220, z: -390, w: 13, h: 42, d: 13 },
        { x: -310, z: -360, w: 8, h: 60, d: 8 },
        { x: -270, z: -330, w: 15, h: 30, d: 15 },
        { x: -340, z: -370, w: 10, h: 48, d: 10 },
        { x: -190, z: -350, w: 12, h: 36, d: 12 },
      ];

      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (track.distToTrack(b.x, b.z) < 40) continue;

        const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
        const color = skylineColors[i % skylineColors.length];
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 });
        const building = new THREE.Mesh(geo, mat);
        building.position.set(b.x, b.h / 2 - 2, b.z);
        building.castShadow = true;
        track._add(building);

        // Glass windows (emissive dots)
        const windowMat = new THREE.MeshStandardMaterial({ color: 0xffeeaa, emissive: 0xffeeaa, emissiveIntensity: 0.2 });
        const winGeo = new THREE.PlaneGeometry(0.7, 0.5);
        const floors = Math.floor(b.h / 3);
        const winCols = Math.floor(b.w / 2);
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < winCols; c++) {
            if (Math.random() > 0.5) continue;
            const win = new THREE.Mesh(winGeo, windowMat);
            win.position.set(
              b.x - b.w / 2 + 1 + c * 2,
              1 + f * 3,
              b.z + b.d / 2 + 0.05
            );
            track._add(win);
          }
        }
      }
    }

    // ============================================================
    // 5. EUCALYPTUS TREES - Australian gum trees scattered around
    //    Tall trunks with sparse olive-green canopy
    // ============================================================
    {
      const eucCount = 60;
      // Eucalyptus: tall pale trunk, sparse olive/sage canopy
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 6.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0xb0a890, roughness: 0.85 });
      const canopyGeo1 = new THREE.SphereGeometry(2.2, 8, 6);
      const canopyMat1 = new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.8 });
      const canopyGeo2 = new THREE.SphereGeometry(1.8, 8, 6);
      const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x6a8a50, roughness: 0.8 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, eucCount);
      const canopy1 = new THREE.InstancedMesh(canopyGeo1, canopyMat1, Math.floor(eucCount * 0.6));
      const canopy2 = new THREE.InstancedMesh(canopyGeo2, canopyMat2, Math.ceil(eucCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < eucCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 16 && attempts < 50);
        if (attempts >= 50) continue;

        const y = track.getTerrainHeight(x, z);
        const scale = 0.8 + Math.random() * 0.5;

        // Trunk (tall and slender, typical of gum trees)
        dummy.position.set(x, y + 3.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx1 + idx2, dummy.matrix);

        // Canopy - sparse, slightly higher than typical trees
        dummy.position.set(x, y + 6.5 * scale, z);
        dummy.scale.set(scale * 1.1, scale * 0.8, scale * 1.1);
        dummy.updateMatrix();
        if (idx1 < Math.floor(eucCount * 0.6)) {
          canopy1.setMatrixAt(idx1, dummy.matrix);
          idx1++;
        } else {
          canopy2.setMatrixAt(idx2, dummy.matrix);
          idx2++;
        }
      }

      trunkMesh.count = idx1 + idx2;
      canopy1.count = idx1;
      canopy2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      canopy1.instanceMatrix.needsUpdate = true;
      canopy2.instanceMatrix.needsUpdate = true;
      track._add(trunkMesh);
      track._add(canopy1);
      track._add(canopy2);
    }

    // ============================================================
    // 6. SPONSOR BOARDS - Australian GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'AUSTRALIAN GP', bg: '#00843D', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'MELBOURNE', bg: '#1a3a6a', fg: '#ffffff' },
        { name: 'F1', bg: '#e10600', fg: '#ffffff' },
      ];

      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;
        if (track.distToTrack(x, z) < hw + 8) continue;
        placeBoard(t, dist, side, sponsors[i % sponsors.length]);
      }
    }

    // ============================================================
    // 7. CONCRETE BARRIERS - Street circuit guardrails
    //    Typical Albert Park temporary concrete/steel barriers
    // ============================================================
    {
      const barrierGeo = new THREE.BoxGeometry(6, 1.2, 0.6);
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5, metalness: 0.3 });
      const barrierMatYellow = new THREE.MeshStandardMaterial({ color: 0xddcc00, roughness: 0.5, metalness: 0.3 });

      const barrierPositions = [
        { t: 0.12, side: 1 },    // Turn 1 outer
        { t: 0.18, side: -1 },   // Turn 2 outer
        { t: 0.30, side: 1 },    // Turn 3/4 outer
        { t: 0.45, side: -1 },   // Mid-section outer
        { t: 0.55, side: 1 },    // Sector 2 outer
        { t: 0.70, side: -1 },   // Back straight outer
        { t: 0.80, side: 1 },    // Fast chicane outer
        { t: 0.92, side: -1 },   // Final corner outer
      ];

      for (let i = 0; i < barrierPositions.length; i++) {
        const bp = barrierPositions[i];
        const { pos, angle } = safeOffset(bp.t, hw + 3, bp.side);
        if (!isSafe(pos.x, pos.z, 2)) continue;

        const mat = (i % 3 === 0) ? barrierMatYellow : barrierMat;
        const barrier = new THREE.Mesh(barrierGeo, mat);
        barrier.position.set(pos.x, pos.y + 0.6, pos.z);
        barrier.rotation.y = angle;
        barrier.castShadow = true;
        track._add(barrier);
      }
    }

    // ============================================================
    // 8. TIRE WALLS - Key corner apexes and exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.12, side: -1 },
        { t: 0.22, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.48, side: 1 },
        { t: 0.62, side: -1 },
        { t: 0.75, side: 1 },
        { t: 0.88, side: -1 },
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
