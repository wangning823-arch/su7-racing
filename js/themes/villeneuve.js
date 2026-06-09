import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Villeneuve Circuit scenery builder
 */
export function buildVilleneuveScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // 1. TAMBURELLO CHICANE GRANDSTAND - main (t~0.08)
    {
      const { pos, angle } = safeOffset(0.08, hw + 22, 1);
      if (isSafe(pos.x, pos.z, 15)) {
        const standW = 40, standH = 9, standD = 10;
        const standGeo = new THREE.BoxGeometry(standW, standH, standD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(pos.x, pos.y + standH / 2, pos.z);
        stand.rotation.y = angle;
        stand.castShadow = true;
        stand.receiveShadow = true;
        track._add(stand);

        const roofGeo = new THREE.BoxGeometry(standW + 3, 0.4, standD + 3);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.4, metalness: 0.2 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + standH + 0.2, pos.z);
        roof.rotation.y = angle;
        roof.castShadow = true;
        track._add(roof);

        const seatColors = [0x009246, 0xffffff, 0xce2b37];
        const rows = 4;
        const cols = Math.floor(standW / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.45, 0.65, 0.45);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - cols / 2 + 0.5) * 1.7;
            const localZ = (r - 1.5) * (standD / 3);
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            seat.position.set(
              pos.x + localX * cosA + localZ * sinA,
              pos.y + 0.5 + r * 1.2,
              pos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = angle;
            track._add(seat);
          }
        }
      }
    }

    // 2. TAMBURELLO CHICANE - opposite side grandstand
    {
      const { pos, angle } = safeOffset(0.06, hw + 20, -1);
      if (isSafe(pos.x, pos.z, 12)) {
        const standW = 30, standH = 7, standD = 8;
        const standGeo = new THREE.BoxGeometry(standW, standH, standD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x7a4020, roughness: 0.7 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(pos.x, pos.y + standH / 2, pos.z);
        stand.rotation.y = angle;
        stand.castShadow = true;
        track._add(stand);

        const roofGeo = new THREE.BoxGeometry(standW + 2, 0.35, standD + 2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x009246, roughness: 0.4, metalness: 0.2 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + standH + 0.2, pos.z);
        roof.rotation.y = angle;
        track._add(roof);

        const seatColors = [0x009246, 0xffffff, 0xce2b37];
        const rows = 3;
        const cols = Math.floor(standW / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.4, 0.6, 0.4);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - cols / 2 + 0.5) * 1.6;
            const localZ = (r - 1) * (standD / 3);
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            seat.position.set(
              pos.x + localX * cosA + localZ * sinA,
              pos.y + 0.4 + r * 1.1,
              pos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = angle;
            track._add(seat);
          }
        }
      }
    }

    // 3. VILLAGE BUILDINGS - Italian countryside with terracotta roofs
    {
      const villageBuildings = [
        { t: 0.20, side: 1, dist: 45, w: 12, h: 8, d: 10 },
        { t: 0.20, side: -1, dist: 40, w: 10, h: 6, d: 8 },
        { t: 0.35, side: 1, dist: 50, w: 14, h: 10, d: 12 },
        { t: 0.50, side: -1, dist: 45, w: 11, h: 7, d: 9 },
        { t: 0.65, side: 1, dist: 48, w: 13, h: 9, d: 11 },
        { t: 0.78, side: -1, dist: 42, w: 10, h: 6, d: 8 },
        { t: 0.90, side: 1, dist: 46, w: 12, h: 8, d: 10 },
        { t: 0.15, side: -1, dist: 38, w: 9, h: 5, d: 7 },
      ];

      const stoneColors = [0xc4a882, 0xb8986a, 0xd4b896, 0xa88a62];
      const roofTileColor = 0xc44a1a;

      for (const b of villageBuildings) {
        const { pos, angle } = safeOffset(b.t, hw + b.dist, b.side);
        if (!isSafe(pos.x, pos.z, b.w / 2 + 5)) continue;

        const bodyGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
        const bodyColor = stoneColors[Math.floor(Math.random() * stoneColors.length)];
        const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(pos.x, pos.y + b.h / 2, pos.z);
        body.rotation.y = angle;
        body.castShadow = true;
        body.receiveShadow = true;
        track._add(body);

        const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.7, 3, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: roofTileColor, roughness: 0.85 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + b.h + 1.2, pos.z);
        roof.rotation.y = Math.PI / 4 + angle;
        roof.castShadow = true;
        track._add(roof);

        const windowMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.3, metalness: 0.1 });
        const winGeo = new THREE.PlaneGeometry(1.2, 1.8);
        const floors = Math.floor(b.h / 4);
        const winCols = Math.floor(b.w / 3);
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < winCols; c++) {
            if (Math.random() > 0.7) continue;
            const win = new THREE.Mesh(winGeo, windowMat);
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            const localX = (c - winCols / 2 + 0.5) * 3;
            win.position.set(
              pos.x + localX * cosA - (b.d / 2 + 0.05) * sinA,
              pos.y + 2 + f * 3.5,
              pos.z - localX * sinA + (b.d / 2 + 0.05) * cosA
            );
            win.rotation.y = angle;
            track._add(win);
          }
        }
      }
    }

    // 4. CYPRESS TREES - Iconic Italian tall narrow cypresses
    {
      const cypressCount = 50;
      const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 4.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 0.9 });
      const leafGeo = new THREE.ConeGeometry(0.8, 8.0, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a4a1a, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, cypressCount);
      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, cypressCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx = 0;
      for (let i = 0; i < cypressCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 14 && attempts < 50);

        const y = track.getTerrainHeight(x, z);
        const scale = 0.7 + Math.random() * 0.6;

        dummy.position.set(x, y + 2.2 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(x, y + 7.0 * scale, z);
        dummy.scale.set(scale * 0.8, scale * 1.0, scale * 0.8);
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

    // 5. OLIVE GROVES - Low rounded Mediterranean trees
    {
      const oliveCount = 30;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 2.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a28, roughness: 0.9 });
      const leafGeo = new THREE.SphereGeometry(2.0, 8, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x6b8e23, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, oliveCount);
      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, oliveCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx = 0;
      for (let i = 0; i < oliveCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 15 && attempts < 50);

        const y = track.getTerrainHeight(x, z);
        const scale = 0.6 + Math.random() * 0.5;

        dummy.position.set(x, y + 1.2 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(x, y + 3.5 * scale, z);
        dummy.scale.set(scale * 1.3, scale * 0.7, scale * 1.3);
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

    // 6. VINEYARD ROWS - Parallel rows of grapevines
    {
      const vineRows = 6;
      const vinesPerRow = 12;
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
      const vineGeo = new THREE.SphereGeometry(0.8, 6, 5);
      const vineMat = new THREE.MeshStandardMaterial({ color: 0x4a8a2a, roughness: 0.85 });

      for (let row = 0; row < vineRows; row++) {
        const t = 0.3 + row * 0.1;
        if (t > 0.95) break;
        const { pos, tangent, right } = safeOffset(t, 55 + row * 5, row % 2 === 0 ? 1 : -1);
        if (!isSafe(pos.x, pos.z, 15)) continue;

        for (let v = 0; v < vinesPerRow; v++) {
          const localT = t + (v - vinesPerRow / 2) * 0.004;
          const clampedT = Math.max(0.01, Math.min(0.99, localT));
          const vp = track.spline.getPointAt(clampedT);
          const vt = track.spline.getTangentAt(clampedT);
          const vr = new THREE.Vector3(vt.z, 0, -vt.x).normalize();
          const vx = vp.x + vr.x * (55 + row * 5) * (row % 2 === 0 ? 1 : -1);
          const vz = vp.z + vr.z * (55 + row * 5) * (row % 2 === 0 ? 1 : -1);
          if (track.distToTrack(vx, vz) < 30) continue;

          const vy = track.getTerrainHeight(vx, vz);

          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(vx, vy + 1.1, vz);
          track._add(post);

          const vine = new THREE.Mesh(vineGeo, vineMat);
          vine.position.set(vx, vy + 2.0, vz);
          vine.scale.set(1 + Math.random() * 0.3, 0.6 + Math.random() * 0.3, 1 + Math.random() * 0.3);
          track._add(vine);
        }
      }
    }

    // 7. ROLLING HILLS - Soft Italian countryside terrain
    {
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x4a7a2c, roughness: 0.95 });
      const hillPositions = [
        { x: 250, z: -300, scaleX: 1.3, scaleY: 0.25, scaleZ: 1.1 },
        { x: -200, z: -250, scaleX: 1.5, scaleY: 0.3, scaleZ: 1.2 },
        { x: 300, z: 200, scaleX: 1.2, scaleY: 0.2, scaleZ: 1.4 },
        { x: -250, z: 300, scaleX: 1.4, scaleY: 0.28, scaleZ: 1.1 },
        { x: 150, z: 350, scaleX: 1.1, scaleY: 0.22, scaleZ: 1.3 },
        { x: -350, z: -150, scaleX: 1.3, scaleY: 0.26, scaleZ: 1.2 },
        { x: 400, z: -100, scaleX: 1.0, scaleY: 0.18, scaleZ: 1.0 },
        { x: -100, z: 400, scaleX: 1.2, scaleY: 0.24, scaleZ: 1.1 },
      ];

      for (const h of hillPositions) {
        if (track.distToTrack(h.x, h.z) < 50) continue;
        const hillGeo = new THREE.SphereGeometry(35, 8, 6);
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.position.set(h.x, -3, h.z);
        hill.scale.set(h.scaleX, h.scaleY, h.scaleZ);
        track._add(hill);
      }
    }

    // 8. ITALIAN FLAG BANNERS - Tricolore decorations
    {
      const bannerPositions = [
        { t: 0.02, side: 1 },
        { t: 0.05, side: -1 },
        { t: 0.12, side: 1 },
        { t: 0.88, side: -1 },
        { t: 0.94, side: 1 },
        { t: 0.97, side: -1 },
      ];

      for (const bp of bannerPositions) {
        const { pos: bPos, angle: bAngle } = safeOffset(bp.t, hw + 8, bp.side);
        if (!isSafe(bPos.x, bPos.z, 2)) continue;

        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(bPos.x, bPos.y + 2.5, bPos.z);
        track._add(pole);

        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128; flagCanvas.height = 96;
        const fCtx = flagCanvas.getContext('2d');
        fCtx.fillStyle = '#009246';
        fCtx.fillRect(0, 0, 43, 96);
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(43, 0, 42, 96);
        fCtx.fillStyle = '#ce2b37';
        fCtx.fillRect(85, 0, 43, 96);
        const flagTex = new THREE.CanvasTexture(flagCanvas);

        const flagGeo = new THREE.PlaneGeometry(1.8, 1.4);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(bPos.x, bPos.y + 4.2, bPos.z);
        flag.rotation.y = bAngle;
        track._add(flag);
      }
    }

    // 9. SPONSOR BOARDS - F1 & Italian GP sponsors
    {
      const sponsors = [
        { name: 'IMOLA', bg: '#1a3a6a', fg: '#ffffff' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'EMILIA-ROMAGNA', bg: '#006633', fg: '#ffffff' },
        { name: 'FERRARI', bg: '#cc0000', fg: '#ffffff' },
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

        const sponsor = sponsors[i % sponsors.length];

        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0, z);
        track._add(post);

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = sponsor.bg;
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = sponsor.fg;
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sponsor.name, 128, 64);
        const tex = new THREE.CanvasTexture(canvas);

        const boardGeo = new THREE.BoxGeometry(6, 3, 0.2);
        const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.set(x, 4.5, z);
        board.rotation.y = Math.atan2(tangent.x, tangent.z);
        board.castShadow = true;
        track._add(board);
      }
    }

    // 10. TIRE WALLS - Key corner exits
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
