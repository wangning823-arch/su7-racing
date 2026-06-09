import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Interlagos Circuit scenery builder
 */
export function buildInterlagosScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. CITY SKYLINE - Sao Paulo urban backdrop
    //    Dense cluster of buildings to simulate the city environment
    // ============================================================
    {
      const buildingMat1 = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.7 });
      const buildingMat2 = new THREE.MeshStandardMaterial({ color: 0x778899, roughness: 0.7 });
      const buildingMat3 = new THREE.MeshStandardMaterial({ color: 0x99aabb, roughness: 0.6, metalness: 0.2 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.1, metalness: 0.6 });

      const buildings = [
        // North side skyline
        { x: 280, z: -350, w: 18, h: 55, d: 18, mat: buildingMat1 },
        { x: 320, z: -300, w: 14, h: 70, d: 14, mat: glassMat },
        { x: 350, z: -380, w: 20, h: 45, d: 20, mat: buildingMat2 },
        { x: 260, z: -280, w: 16, h: 38, d: 16, mat: buildingMat3 },
        { x: 380, z: -320, w: 12, h: 62, d: 12, mat: glassMat },
        { x: 300, z: -420, w: 22, h: 50, d: 18, mat: buildingMat1 },
        { x: 340, z: -260, w: 15, h: 42, d: 15, mat: buildingMat2 },
        { x: 250, z: -400, w: 18, h: 48, d: 18, mat: buildingMat3 },
        { x: 370, z: -430, w: 16, h: 58, d: 16, mat: glassMat },
        { x: 400, z: -360, w: 20, h: 40, d: 20, mat: buildingMat1 },
        // South side skyline
        { x: -280, z: 350, w: 16, h: 52, d: 16, mat: buildingMat1 },
        { x: -320, z: 380, w: 20, h: 65, d: 18, mat: glassMat },
        { x: -250, z: 300, w: 14, h: 44, d: 14, mat: buildingMat2 },
        { x: -350, z: 320, w: 18, h: 56, d: 18, mat: buildingMat3 },
        { x: -300, z: 420, w: 22, h: 48, d: 20, mat: buildingMat1 },
        { x: -260, z: 380, w: 15, h: 60, d: 15, mat: glassMat },
        { x: -340, z: 440, w: 17, h: 42, d: 17, mat: buildingMat2 },
        // East side
        { x: 400, z: 200, w: 16, h: 50, d: 16, mat: buildingMat1 },
        { x: 420, z: 150, w: 14, h: 58, d: 14, mat: glassMat },
        { x: 380, z: 250, w: 18, h: 42, d: 18, mat: buildingMat3 },
      ];

      for (const b of buildings) {
        if (track.distToTrack(b.x, b.z) < 60) continue;

        const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
        const building = new THREE.Mesh(geo, b.mat);
        building.position.set(b.x, b.h / 2 - 5, b.z);
        building.castShadow = true;
        building.receiveShadow = true;
        track._add(building);

        // Window rows (subtle horizontal bands)
        if (b.h > 30) {
          const bandMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.4, metalness: 0.3 });
          for (let row = 0; row < Math.floor(b.h / 8); row++) {
            const bandGeo = new THREE.BoxGeometry(b.w + 0.2, 0.3, b.d + 0.2);
            const band = new THREE.Mesh(bandGeo, bandMat);
            band.position.set(b.x, row * 8 + 4 - 5, b.z);
            track._add(band);
          }
        }
      }

      // Additional small buildings for density
      for (let i = 0; i < 30; i++) {
        const ang = (i / 30) * Math.PI * 2;
        const r = 300 + Math.random() * 150;
        const bx = Math.cos(ang) * r;
        const bz = Math.sin(ang) * r;
        if (track.distToTrack(bx, bz) < 80) continue;

        const bw = 8 + Math.random() * 14;
        const bh = 20 + Math.random() * 40;
        const bd = 8 + Math.random() * 14;
        const mat = [buildingMat1, buildingMat2, buildingMat3, glassMat][Math.floor(Math.random() * 4)];

        const geo = new THREE.BoxGeometry(bw, bh, bd);
        const building = new THREE.Mesh(geo, mat);
        building.position.set(bx, bh / 2 - 5, bz);
        building.castShadow = true;
        track._add(building);
      }
    }

    // ============================================================
    // 2. MAIN GRANDSTAND - Start/Finish straight
    //    Large grandstand with Brazilian flag colors
    // ============================================================
    placeStand(0.05, hw + 22, 1, 45, 10, 10, 0x222233, 0x009c3b);

    // ============================================================
    // 3. PIT BUILDING - Opposite side of main straight
    // ============================================================
    {
      const { pos, angle } = safeOffset(0.08, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 40, pitH = 5, pitD = 8;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.3 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garages with Brazilian colors (green/yellow/blue)
        const garageColors = [0x009c3b, 0xffdf00, 0x002776, 0xffdf00, 0x009c3b];
        for (let i = 0; i < 12; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 5.5) * 3.2;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          track._add(g);
        }

        // INTERLAGOS sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#009c3b';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffdf00';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('AUTODROMO INTERLAGOS', 256, 32);
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
    // 4. SECONDARY GRANDSTANDS - Key corner positions
    // ============================================================
    placeStand(0.20, hw + 20, -1, 30, 7, 8, 0x333344, 0xffdf00);   // Senna S area
    placeStand(0.35, hw + 18, 1, 24, 6, 7, 0x2a3a4a, 0x009c3b);    // Mid-section
    placeStand(0.50, hw + 22, -1, 28, 7, 8, 0x3a3a4a, 0x002776);   // Back straight
    placeStand(0.65, hw + 18, 1, 22, 5, 7, 0x2a2a3a, 0xffdf00);    // Infield section
    placeStand(0.80, hw + 20, -1, 26, 6, 7, 0x334455, 0x009c3b);   // Near final corners
    placeStand(0.92, hw + 18, 1, 20, 5, 6, 0x2a3a4a, 0x002776);    // Approach to finish

    // ============================================================
    // 5. TROPICAL VEGETATION - Brazilian palm trees and lush greenery
    // ============================================================
    {
      // Tall royal palms (iconic of Brazilian circuits)
      const palmCount = 45;
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 6.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
      const leafGeo = new THREE.ConeGeometry(3.0, 2.5, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a8a2a, roughness: 0.8 });

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
        } while (track.distToTrack(x, z) < 18 && attempts < 50);

        const y = track.getTerrainHeight(x, z);
        const scale = 0.8 + Math.random() * 0.7;

        // Trunk
        dummy.position.set(x, y + 3.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);

        // Palm canopy
        dummy.position.set(x, y + 6.8 * scale, z);
        dummy.scale.set(scale * 1.3, scale * 0.9, scale * 1.3);
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

      // Dense tropical bushes (brighter green)
      const bushGeo = new THREE.SphereGeometry(1.5, 6, 5);
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.9 });

      for (let i = 0; i < 60; i++) {
        const t = Math.random();
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 12 + Math.random() * 25;
        const bx = p.x + right.x * dist * side;
        const bz = p.z + right.z * dist * side;
        if (track.distToTrack(bx, bz) < hw + 8) continue;

        const scale = 0.6 + Math.random() * 1.2;
        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.position.set(bx, track.getTerrainHeight(bx, bz) + scale * 0.5, bz);
        bush.scale.set(scale, scale * 0.7, scale);
        track._add(bush);
      }
    }

    // ============================================================
    // 6. SPONSOR BOARDS - F1 sponsors with Brazilian GP branding
    // ============================================================
    {
      const sponsors = [
        { name: 'BRAZIL GP', bg: '#009c3b', fg: '#ffdf00' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'PETROBRAS', bg: '#002776', fg: '#ffdf00' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'INTERLAGOS', bg: '#002776', fg: '#ffdf00' },
      ];

      const boardCount = 12;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;

        placeBoard(t, dist, side, sponsors[i % sponsors.length]);
      }
    }

    // ============================================================
    // 7. SENNA S SIGNAGE - Iconic corner name sign
    // ============================================================
    {
      const { pos: sennaPos, angle: sennaAngle } = safeOffset(0.18, hw + 14, 1);
      if (isSafe(sennaPos.x, sennaPos.z, 5)) {
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#002776';
        signCtx.fillRect(0, 0, 256, 64);
        signCtx.fillStyle = '#ffdf00';
        signCtx.font = 'bold 28px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('SENNA S', 128, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(8, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);

        const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(postGeo, postMat);
          const offset = s * 4;
          const cosA = Math.cos(sennaAngle), sinA = Math.sin(sennaAngle);
          post.position.set(
            sennaPos.x + offset * cosA,
            sennaPos.y + 2,
            sennaPos.z - offset * sinA
          );
          track._add(post);
        }
        sign.position.set(sennaPos.x, sennaPos.y + 4.5, sennaPos.z);
        sign.rotation.y = sennaAngle;
        track._add(sign);
      }
    }

    // ============================================================
    // 8. TIRE WALLS - Key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.12, side: -1 },
        { t: 0.25, side: 1 },
        { t: 0.38, side: -1 },
        { t: 0.52, side: 1 },
        { t: 0.68, side: -1 },
        { t: 0.82, side: 1 },
        { t: 0.93, side: -1 },
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
