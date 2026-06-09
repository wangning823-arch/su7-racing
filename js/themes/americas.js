import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Americas Circuit scenery builder
 */
export function buildAmericasScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // 1. ICONIC OBSERVATION TOWER - COTA's signature red observation tower
    {
      const { pos: towerPos, angle: towerAngle } = safeOffset(0.72, hw + 35, 1);
      if (isSafe(towerPos.x, towerPos.z, 15)) {
        const towerH = 28;

        const pillarGeo = new THREE.CylinderGeometry(0.6, 1.2, towerH, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.4, metalness: 0.5 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(towerPos.x, towerPos.y + towerH / 2, towerPos.z);
        pillar.castShadow = true;
        track._add(pillar);

        const deckGeo = new THREE.CylinderGeometry(4, 4, 2, 12);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.3, metalness: 0.5 });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(towerPos.x, towerPos.y + towerH, towerPos.z);
        deck.castShadow = true;
        track._add(deck);

        const glassGeo = new THREE.CylinderGeometry(3.8, 3.8, 3, 12, 1, true);
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0x88ccff, roughness: 0.1, metalness: 0.8,
          transparent: true, opacity: 0.4, side: THREE.DoubleSide
        });
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(towerPos.x, towerPos.y + towerH + 2.5, towerPos.z);
        track._add(glass);

        const capGeo = new THREE.ConeGeometry(4.5, 3, 12);
        const capMat = new THREE.MeshStandardMaterial({ color: 0xaa1a00, roughness: 0.3, metalness: 0.5 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(towerPos.x, towerPos.y + towerH + 5.5, towerPos.z);
        cap.castShadow = true;
        track._add(cap);

        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 128;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc2200';
        signCtx.fillRect(0, 0, 256, 128);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 60px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('COTA', 128, 64);
        const signTex = new THREE.CanvasTexture(signCanvas);

        for (let face = 0; face < 4; face++) {
          const faceSignGeo = new THREE.PlaneGeometry(4, 2);
          const faceSignMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
          const faceSign = new THREE.Mesh(faceSignGeo, faceSignMat);
          const fAngle = towerAngle + (face * Math.PI / 2);
          faceSign.position.set(
            towerPos.x + Math.sin(fAngle) * 2.2,
            towerPos.y + towerH + 2.5,
            towerPos.z + Math.cos(fAngle) * 2.2
          );
          faceSign.rotation.y = fAngle;
          track._add(faceSign);
        }

        for (let i = 0; i < 4; i++) {
          const strutAngle = towerAngle + (i * Math.PI / 2) + Math.PI / 4;
          const strutGeo = new THREE.CylinderGeometry(0.15, 0.15, towerH * 0.7, 4);
          const strutMat = new THREE.MeshStandardMaterial({ color: 0x991800, roughness: 0.4, metalness: 0.4 });
          const strut = new THREE.Mesh(strutGeo, strutMat);
          strut.position.set(
            towerPos.x + Math.sin(strutAngle) * 3,
            towerPos.y + towerH * 0.35,
            towerPos.z + Math.cos(strutAngle) * 3
          );
          strut.rotation.z = Math.PI * 0.08 * (i % 2 === 0 ? 1 : -1);
          strut.rotation.x = Math.PI * 0.08 * (i < 2 ? 1 : -1);
          track._add(strut);
        }
      }
    }

    // 2. MAIN GRANDSTAND - Start/Finish straight
    placeStand(0.02, hw + 18, 1, 45, 10, 10, 0x333344, 0x003399, [0xcc0000, 0xffffff, 0x003399]);

    // 3. PIT BUILDING - Opposite side of main straight
    {
      const { pos, angle } = safeOffset(0.06, hw + 16, -1);
      if (isSafe(pos.x, pos.z, 8)) {
        const pitW = 40, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        const garageColors = [0xcc0000, 0xffffff, 0x003399, 0xcc0000, 0xffffff];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.8, 3.2);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.8;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          track._add(g);
        }

        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#003399';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 28px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('CIRCUIT OF THE AMERICAS', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(18, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        track._add(sign);
      }
    }

    // 4. SECONDARY GRANDSTANDS - Key corners
    {
      const secondaryStands = [
        { t: 0.12, side: 1, w: 28, h: 7, d: 7 },
        { t: 0.22, side: -1, w: 22, h: 5, d: 6 },
        { t: 0.40, side: 1, w: 24, h: 6, d: 6 },
        { t: 0.58, side: -1, w: 22, h: 5, d: 6 },
        { t: 0.88, side: 1, w: 25, h: 6, d: 6 },
      ];

      for (const s of secondaryStands) {
        const { pos: sPos, angle: sAngle } = safeOffset(s.t, hw + 16, s.side);
        if (!isSafe(sPos.x, sPos.z, s.w / 2)) continue;

        const sGeo = new THREE.BoxGeometry(s.w, s.h, s.d);
        const sMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.6 });
        const standMesh = new THREE.Mesh(sGeo, sMat);
        standMesh.position.set(sPos.x, sPos.y + s.h / 2, sPos.z);
        standMesh.rotation.y = sAngle;
        standMesh.castShadow = true;
        standMesh.receiveShadow = true;
        track._add(standMesh);

        const roofGeo = new THREE.BoxGeometry(s.w + 2, 0.35, s.d + 2);
        const roofColor = s.side > 0 ? 0xcc2200 : 0x003399;
        const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(sPos.x, sPos.y + s.h + 0.2, sPos.z);
        roof.rotation.y = sAngle;
        roof.castShadow = true;
        track._add(roof);

        const sSeatColors = [0xcc0000, 0xffffff, 0x003399];
        const sRows = 2;
        const sCols = Math.floor(s.w / 2);
        for (let r = 0; r < sRows; r++) {
          for (let c = 0; c < sCols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.45, 0.6, 0.45);
            const seatMat = new THREE.MeshStandardMaterial({ color: sSeatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - sCols / 2 + 0.5) * 1.7;
            const localZ = (r - 0.5) * (s.d / 3);
            const cosA = Math.cos(sAngle), sinA = Math.sin(sAngle);
            seat.position.set(
              sPos.x + localX * cosA + localZ * sinA,
              sPos.y + 0.4 + r * 1.0,
              sPos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = sAngle;
            track._add(seat);
          }
        }
      }
    }

    // 5. TEXAS LIVE OAK TREES
    {
      const oakCount = 80;
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 4.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
      const leafGeo1 = new THREE.SphereGeometry(3.5, 8, 6);
      const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.85 });
      const leafGeo2 = new THREE.SphereGeometry(2.8, 7, 5);
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, oakCount);
      const leaves1 = new THREE.InstancedMesh(leafGeo1, leafMat1, Math.floor(oakCount * 0.6));
      const leaves2 = new THREE.InstancedMesh(leafGeo2, leafMat2, Math.ceil(oakCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < oakCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 18 && attempts < 50);
        if (attempts >= 50) continue;

        const y = track.getTerrainHeight(x, z);
        const scale = 0.6 + Math.random() * 0.6;

        dummy.position.set(x, y + 2.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        if (i < Math.floor(oakCount * 0.6)) {
          trunkMesh.setMatrixAt(idx1, dummy.matrix);
          dummy.position.set(x, y + 4.5 * scale, z);
          dummy.scale.set(scale * 1.5, scale * 0.8, scale * 1.5);
          dummy.updateMatrix();
          leaves1.setMatrixAt(idx1, dummy.matrix);
          idx1++;
        } else {
          trunkMesh.setMatrixAt(idx1 + idx2, dummy.matrix);
          dummy.position.set(x, y + 4.0 * scale, z);
          dummy.scale.set(scale * 1.2, scale * 0.7, scale * 1.2);
          dummy.updateMatrix();
          leaves2.setMatrixAt(idx2, dummy.matrix);
          idx2++;
        }
      }

      trunkMesh.count = idx1 + idx2;
      leaves1.count = idx1;
      leaves2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leaves1.instanceMatrix.needsUpdate = true;
      leaves2.instanceMatrix.needsUpdate = true;
      track._add(trunkMesh);
      track._add(leaves1);
      track._add(leaves2);
    }

    // 6. TEXAS CACTUS AND BRUSH
    {
      const cactusCount = 40;
      const cactusGeo = new THREE.ConeGeometry(0.4, 2.5, 6);
      const cactusMat = new THREE.MeshStandardMaterial({ color: 0x4a7a2a, roughness: 0.85 });
      const brushGeo = new THREE.SphereGeometry(0.8, 6, 5);
      const brushMat = new THREE.MeshStandardMaterial({ color: 0x7a8a3a, roughness: 0.9 });

      const cactusMesh = new THREE.InstancedMesh(cactusGeo, cactusMat, cactusCount);
      const brushMesh = new THREE.InstancedMesh(brushGeo, brushMat, cactusCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      for (let i = 0; i < cactusCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 14 && attempts < 50);
        if (attempts >= 50) continue;

        const y = track.getTerrainHeight(x, z);
        const scale = 0.5 + Math.random() * 0.8;

        dummy.position.set(x, y + 1.2 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        cactusMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x + (Math.random() - 0.5) * 3, y + 0.4 * scale, z + (Math.random() - 0.5) * 3);
        dummy.scale.set(scale * 1.2, scale * 0.6, scale * 1.2);
        dummy.updateMatrix();
        brushMesh.setMatrixAt(i, dummy.matrix);
      }

      cactusMesh.count = cactusCount;
      brushMesh.count = cactusCount;
      cactusMesh.instanceMatrix.needsUpdate = true;
      brushMesh.instanceMatrix.needsUpdate = true;
      track._add(cactusMesh);
      track._add(brushMesh);
    }

    // 7. SPONSOR BOARDS
    {
      const sponsors = [
        { name: 'COTA', bg: '#cc2200', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'EMIRATES', bg: '#d71921', fg: '#ffffff' },
        { name: 'MOBIL 1', bg: '#003399', fg: '#ffffff' },
        { name: 'TEXAS', bg: '#002868', fg: '#ffffff' },
        { name: 'COTA', bg: '#cc2200', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
      ];

      const boardCount = 12;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;

        if (!isSafe(x, z, 3)) continue;

        const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, p.y + 1.5, z);
        track._add(post);

        const sponsor = sponsors[i % sponsors.length];
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
        board.position.set(x, p.y + 4.5, z);
        board.rotation.y = Math.atan2(tangent.x, tangent.z);
        board.castShadow = true;
        track._add(board);
      }
    }

    // 8. AMERICAN FLAGS - along the main straight
    {
      const flagPositions = [
        { t: 0.01, side: 1 },
        { t: 0.03, side: -1 },
        { t: 0.05, side: 1 },
        { t: 0.07, side: -1 },
      ];

      for (const fp of flagPositions) {
        const { pos, angle } = safeOffset(fp.t, hw + 12, fp.side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 8, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 4, pos.z);
        track._add(pole);

        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128; flagCanvas.height = 80;
        const fCtx = flagCanvas.getContext('2d');
        for (let s = 0; s < 13; s++) {
          fCtx.fillStyle = s % 2 === 0 ? '#cc0000' : '#ffffff';
          fCtx.fillRect(0, s * (80 / 13), 128, 80 / 13 + 1);
        }
        fCtx.fillStyle = '#003399';
        fCtx.fillRect(0, 0, 50, 42);
        fCtx.fillStyle = '#ffffff';
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 4; c++) {
            fCtx.beginPath();
            fCtx.arc(8 + c * 10, 8 + r * 12, 2, 0, Math.PI * 2);
            fCtx.fill();
          }
        }
        const flagTex = new THREE.CanvasTexture(flagCanvas);
        const flagGeo = new THREE.PlaneGeometry(2.5, 1.5);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.5 });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        flag.position.set(
          pos.x + 1.25 * cosA,
          pos.y + 7.2,
          pos.z - 1.25 * sinA
        );
        flag.rotation.y = angle;
        track._add(flag);
      }
    }
}
