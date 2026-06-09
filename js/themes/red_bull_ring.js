import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * RedBullRing Circuit scenery builder
 */
export function buildRedBullRingScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. ALPS MOUNTAIN BACKDROP - Large distant mountain shapes
    //    Spielberg is in the Styrian mountains, surrounded by Alps
    // ============================================================
    {
      const mountainMat1 = new THREE.MeshStandardMaterial({ color: 0x5a6a52, roughness: 0.95 });
      const mountainMat2 = new THREE.MeshStandardMaterial({ color: 0x4a5a42, roughness: 0.95 });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, roughness: 0.7 });

      const mountains = [
        { x: 300, z: -400, scale: 1.4, height: 80, mat: mountainMat1 },
        { x: -200, z: -350, scale: 1.2, height: 65, mat: mountainMat2 },
        { x: -500, z: -300, scale: 1.6, height: 90, mat: mountainMat1 },
        { x: 500, z: -350, scale: 1.0, height: 55, mat: mountainMat2 },
        { x: 100, z: 400, scale: 1.3, height: 70, mat: mountainMat1 },
        { x: -350, z: 350, scale: 1.5, height: 85, mat: mountainMat2 },
        { x: 400, z: 300, scale: 1.1, height: 60, mat: mountainMat1 },
        { x: -100, z: 450, scale: 1.2, height: 75, mat: mountainMat2 },
      ];

      for (const m of mountains) {
        // Main mountain cone
        const geo = new THREE.ConeGeometry(60 * m.scale, m.height * m.scale, 8);
        const mountain = new THREE.Mesh(geo, m.mat);
        mountain.position.set(m.x, m.height * m.scale / 2 - 10, m.z);
        mountain.castShadow = true;
        track._add(mountain);

        // Snow cap
        const snowGeo = new THREE.ConeGeometry(20 * m.scale, 15 * m.scale, 8);
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.set(m.x, m.height * m.scale - 15, m.z);
        track._add(snow);
      }

      // Additional smaller rolling hills
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.95 });
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const r = 250 + Math.random() * 150;
        const hx = Math.cos(angle) * r;
        const hz = Math.sin(angle) * r;
        if (track.distToTrack(hx, hz) < 60) continue;

        const hillGeo = new THREE.SphereGeometry(30 + Math.random() * 20, 8, 6);
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.position.set(hx, -5, hz);
        hill.scale.set(1, 0.3, 1);
        track._add(hill);
      }
    }

    // ============================================================
    // 2. RED BULL BRANDED BUILDINGS - Paddock / Energy Station
    //    Place at start/finish area (t=0.0) and another key position
    // ============================================================
    {
      // Main Red Bull paddock building (near start/finish)
      const { pos: padPos, angle: padAngle } = safeOffset(0.95, hw + 25, -1);
      if (isSafe(padPos.x, padPos.z, 12)) {
        // Main building body - dark blue (Red Bull primary)
        const bodyGeo = new THREE.BoxGeometry(30, 8, 12);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.5, metalness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(padPos.x, padPos.y + 4, padPos.z);
        body.rotation.y = padAngle;
        body.castShadow = true;
        body.receiveShadow = true;
        track._add(body);

        // Silver/gray accent stripe
        const stripeGeo = new THREE.BoxGeometry(30.2, 1.5, 12.2);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.3, metalness: 0.6 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(padPos.x, padPos.y + 5.5, padPos.z);
        stripe.rotation.y = padAngle;
        track._add(stripe);

        // Red Bull sign on the building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 128;
        const signCtx = signCanvas.getContext('2d');
        // Dark blue background
        signCtx.fillStyle = '#0a1a4a';
        signCtx.fillRect(0, 0, 512, 128);
        // Yellow/gold text
        signCtx.fillStyle = '#f5c518';
        signCtx.font = 'bold 56px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('RED BULL RING', 256, 64);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(14, 3.5);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(padPos.x, padPos.y + 9.5, padPos.z);
        sign.rotation.y = padAngle;
        track._add(sign);

        // Garage doors (Red Bull colors: dark blue + yellow accents)
        const garageColors = [0x0a1a4a, 0x0a1a4a, 0x1a2a5a, 0x0a1a4a, 0x0a1a4a];
        for (let i = 0; i < 8; i++) {
          const gGeo = new THREE.PlaneGeometry(2.8, 3.5);
          const gMat = new THREE.MeshStandardMaterial({
            color: garageColors[i % garageColors.length],
            roughness: 0.5,
            metalness: 0.3
          });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(padAngle), sinA = Math.sin(padAngle);
          const localX = (i - 3.5) * 3.5;
          g.position.set(
            padPos.x + localX * cosA - 6 * sinA,
            padPos.y + 1.8,
            padPos.z - localX * sinA + 6 * cosA
          );
          g.rotation.y = padAngle;
          track._add(g);
        }
      }

      // Red Bull Tower / observation structure (higher position, t=0.3)
      const { pos: towerPos, angle: towerAngle } = safeOffset(0.3, hw + 20, 1);
      if (isSafe(towerPos.x, towerPos.z, 8)) {
        const towerH = 16;
        // Main tower pillar
        const pillarGeo = new THREE.BoxGeometry(3, towerH, 3);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.4, metalness: 0.4 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(towerPos.x, towerPos.y + towerH / 2, towerPos.z);
        pillar.castShadow = true;
        track._add(pillar);

        // Top observation deck
        const deckGeo = new THREE.BoxGeometry(8, 2, 8);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.4, metalness: 0.3 });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(towerPos.x, towerPos.y + towerH + 1, towerPos.z);
        deck.castShadow = true;
        track._add(deck);

        // Yellow accent ring
        const ringGeo = new THREE.TorusGeometry(3.5, 0.3, 8, 16);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.3, metalness: 0.5 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(towerPos.x, towerPos.y + towerH + 2.2, towerPos.z);
        ring.rotation.x = Math.PI / 2;
        track._add(ring);

        // Red Bull text sign on tower
        const towerSignCanvas = document.createElement('canvas');
        towerSignCanvas.width = 256; towerSignCanvas.height = 128;
        const towerSignCtx = towerSignCanvas.getContext('2d');
        towerSignCtx.fillStyle = '#0a1a4a';
        towerSignCtx.fillRect(0, 0, 256, 128);
        towerSignCtx.fillStyle = '#f5c518';
        towerSignCtx.font = 'bold 40px Arial';
        towerSignCtx.textAlign = 'center';
        towerSignCtx.textBaseline = 'middle';
        towerSignCtx.fillText('RED BULL', 128, 64);
        const towerSignTex = new THREE.CanvasTexture(towerSignCanvas);

        for (let face = 0; face < 4; face++) {
          const faceSignGeo = new THREE.PlaneGeometry(2.8, 1.5);
          const faceSignMat = new THREE.MeshStandardMaterial({ map: towerSignTex, roughness: 0.3 });
          const faceSign = new THREE.Mesh(faceSignGeo, faceSignMat);
          const fAngle = towerAngle + (face * Math.PI / 2);
          faceSign.position.set(
            towerPos.x + Math.sin(fAngle) * 1.6,
            towerPos.y + towerH - 2,
            towerPos.z + Math.cos(fAngle) * 1.6
          );
          faceSign.rotation.y = fAngle;
          track._add(faceSign);
        }
      }
    }

    // ============================================================
    // 3. MAIN GRANDSTAND - Start/Finish straight
    //    Austrian flag colors: red-white-red for seats
    // ============================================================
    {
      const { pos: standPos, angle: standAngle } = safeOffset(0.02, hw + 18, 1);
      if (isSafe(standPos.x, standPos.z, 10)) {
        const standW = 35, standH = 8, standD = 8;
        // Stand body - dark gray
        const standGeo = new THREE.BoxGeometry(standW, standH, standD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.6 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(standPos.x, standPos.y + standH / 2, standPos.z);
        stand.rotation.y = standAngle;
        stand.castShadow = true;
        stand.receiveShadow = true;
        track._add(stand);

        // Roof canopy - Red Bull dark blue
        const roofGeo = new THREE.BoxGeometry(standW + 3, 0.4, standD + 3);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(standPos.x, standPos.y + standH + 0.2, standPos.z);
        roof.rotation.y = standAngle;
        roof.castShadow = true;
        track._add(roof);

        // Seats - Austrian flag pattern: red-white-red rows
        const seatColors = [0xcc0000, 0xffffff, 0xcc0000];
        const rows = 3;
        const cols = Math.floor(standW / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - cols / 2 + 0.5) * 1.8;
            const localZ = (r - 1) * (standD / 2.5);
            const cosA = Math.cos(standAngle), sinA = Math.sin(standAngle);
            seat.position.set(
              standPos.x + localX * cosA + localZ * sinA,
              standPos.y + 0.5 + r * 1.2,
              standPos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = standAngle;
            track._add(seat);
          }
        }
      }
    }

    // ============================================================
    // 4. SECONDARY GRANDSTANDS - Key corners
    // ============================================================
    {
      const secondaryStands = [
        { t: 0.18, side: -1, w: 25, h: 6, d: 6 },
        { t: 0.35, side: 1, w: 22, h: 5, d: 6 },
        { t: 0.55, side: -1, w: 25, h: 6, d: 6 },
        { t: 0.75, side: 1, w: 22, h: 5, d: 6 },
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

        // Roof - alternating Red Bull blue/yellow
        const roofGeo = new THREE.BoxGeometry(s.w + 2, 0.35, s.d + 2);
        const roofColor = s.side > 0 ? 0x0a1a4a : 0xf5c518;
        const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(sPos.x, sPos.y + s.h + 0.2, sPos.z);
        roof.rotation.y = sAngle;
        roof.castShadow = true;
        track._add(roof);

        // Red-white-red seats
        const sSeatColors = [0xcc0000, 0xffffff, 0xcc0000];
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

    // ============================================================
    // 5. ALPINE CONIFER TREES - Additional mountain vegetation
    //    (supplements the theme trees with more mountain-specific conifers)
    // ============================================================
    {
      const coniferCount = 60;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 4.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x463918, roughness: 0.9 });
      // Alpine dark green conifers
      const leafGeo1 = new THREE.ConeGeometry(1.5, 5.5, 8);
      const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x1a5a1a, roughness: 0.85 });
      const leafGeo2 = new THREE.ConeGeometry(1.2, 4.5, 7);
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x2a6a2a, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, coniferCount);
      const leaves1 = new THREE.InstancedMesh(leafGeo1, leafMat1, Math.floor(coniferCount * 0.6));
      const leaves2 = new THREE.InstancedMesh(leafGeo2, leafMat2, Math.ceil(coniferCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < coniferCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 16 && attempts < 50);

        const y = track.getTerrainHeight(x, z);
        const scale = 0.7 + Math.random() * 0.7;

        // Trunk
        dummy.position.set(x, y + 2.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        if (i < coniferCount * 0.6) {
          dummy.position.set(x, y + 5.5 * scale, z);
          dummy.updateMatrix();
          leaves1.setMatrixAt(idx1++, dummy.matrix);
        } else {
          dummy.position.set(x, y + 5.0 * scale, z);
          dummy.updateMatrix();
          leaves2.setMatrixAt(idx2++, dummy.matrix);
        }
      }

      trunkMesh.count = coniferCount;
      leaves1.count = idx1;
      leaves2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leaves1.instanceMatrix.needsUpdate = true;
      leaves2.instanceMatrix.needsUpdate = true;
      track._add(trunkMesh);
      track._add(leaves1);
      track._add(leaves2);
    }

    // ============================================================
    // 6. SPONSOR BOARDS - F1 & Red Bull ecosystem sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'RED BULL', bg: '#0a1a4a', fg: '#f5c518' },
        { name: 'ASTON MARTIN', bg: '#006a4e', fg: '#ffffff' },
        { name: 'MOBIL 1', bg: '#003399', fg: '#ffffff' },
        { name: 'TAG HEUER', bg: '#1a1a1a', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
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

        // Post
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0, z);
        track._add(post);

        // Board canvas
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

    // ============================================================
    // 8. AUSTRIAN FLAG BANNERS - Along the main straight
    // ============================================================
    {
      const bannerPositions = [
        { t: 0.01, side: 1 },
        { t: 0.04, side: -1 },
        { t: 0.07, side: 1 },
        { t: 0.93, side: -1 },
        { t: 0.96, side: 1 },
        { t: 0.99, side: -1 },
      ];

      for (const bp of bannerPositions) {
        const { pos: bPos, angle: bAngle } = safeOffset(bp.t, hw + 8, bp.side);
        if (!isSafe(bPos.x, bPos.z, 2)) continue;

        // Flag pole
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(bPos.x, bPos.y + 2.5, bPos.z);
        track._add(pole);

        // Austrian flag (red-white-red horizontal stripes)
        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128; flagCanvas.height = 96;
        const fCtx = flagCanvas.getContext('2d');
        fCtx.fillStyle = '#cc0000';
        fCtx.fillRect(0, 0, 128, 32);
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(0, 32, 128, 32);
        fCtx.fillStyle = '#cc0000';
        fCtx.fillRect(0, 64, 128, 32);
        const flagTex = new THREE.CanvasTexture(flagCanvas);

        const flagGeo = new THREE.PlaneGeometry(1.8, 1.4);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(bPos.x, bPos.y + 4.2, bPos.z);
        flag.rotation.y = bAngle;
        track._add(flag);
      }
    }
}
