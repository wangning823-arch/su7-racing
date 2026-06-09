import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Suzuka Circuit scenery builder
 */
export function buildSuzukaScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. MAIN GRANDSTAND - Start/Finish straight (t=0.02)
    //    Large grandstand on the outside of the pit straight
    // ============================================================
    placeStand(0.02, hw + 20, 1, 40, 10, 10, 0x2a2a2a, 0xcc0000, [0xcc0000, 0xffffff, 0xcc0000]);

    // Pit building - opposite side (t=0.04)
    {
      const { pos, angle } = safeOffset(0.04, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 35, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garages with Suzuka colors
        const garageColors = [0xcc0000, 0xffffff, 0x003399, 0xffffff, 0xcc0000];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.2;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y + 0.5,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          track._add(g);
        }

        // SUZUKA CIRCUIT sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc0000';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('SUZUKA CIRCUIT', 256, 32);
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
    // 2. CONTROL TOWER / TIMING TOWER - Near start/finish (t=0.98)
    //    The iconic Suzuka control tower visible from the main straight
    // ============================================================
    {
      const { pos: towerPos, angle: towerAngle } = safeOffset(0.98, hw + 25, 1);
      if (isSafe(towerPos.x, towerPos.z, 8)) {
        const towerH = 18;

        // Main tower pillar
        const pillarGeo = new THREE.BoxGeometry(4, towerH, 4);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.4, metalness: 0.3 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(towerPos.x, towerPos.y + towerH / 2, towerPos.z);
        pillar.castShadow = true;
        track._add(pillar);

        // Top observation deck
        const deckGeo = new THREE.BoxGeometry(10, 3, 8);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.4, metalness: 0.3 });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(towerPos.x, towerPos.y + towerH + 1.5, towerPos.z);
        deck.castShadow = true;
        track._add(deck);

        // Glass front panels on the observation deck
        const glassGeo = new THREE.PlaneGeometry(9.5, 2.5);
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0x88bbdd, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.8
        });
        for (let face = 0; face < 4; face++) {
          const glass = new THREE.Mesh(glassGeo, glassMat);
          const fAngle = towerAngle + (face * Math.PI / 2);
          glass.position.set(
            towerPos.x + Math.sin(fAngle) * 2.1,
            towerPos.y + towerH + 1.5,
            towerPos.z + Math.cos(fAngle) * 2.1
          );
          glass.rotation.y = fAngle;
          track._add(glass);
        }

        // SUZUKA text sign on tower (visible from track)
        const towerSignCanvas = document.createElement('canvas');
        towerSignCanvas.width = 256; towerSignCanvas.height = 128;
        const towerSignCtx = towerSignCanvas.getContext('2d');
        towerSignCtx.fillStyle = '#cc0000';
        towerSignCtx.fillRect(0, 0, 256, 128);
        towerSignCtx.fillStyle = '#ffffff';
        towerSignCtx.font = 'bold 48px Arial';
        towerSignCtx.textAlign = 'center';
        towerSignCtx.textBaseline = 'middle';
        towerSignCtx.fillText('SUZUKA', 128, 64);
        const towerSignTex = new THREE.CanvasTexture(towerSignCanvas);

        for (let face = 0; face < 4; face++) {
          const faceSignGeo = new THREE.PlaneGeometry(3.8, 2.0);
          const faceSignMat = new THREE.MeshStandardMaterial({ map: towerSignTex, roughness: 0.3 });
          const faceSign = new THREE.Mesh(faceSignGeo, faceSignMat);
          const fAngle = towerAngle + (face * Math.PI / 2);
          faceSign.position.set(
            towerPos.x + Math.sin(fAngle) * 2.05,
            towerPos.y + towerH - 2,
            towerPos.z + Math.cos(fAngle) * 2.05
          );
          faceSign.rotation.y = fAngle;
          track._add(faceSign);
        }

        // Clock/timing display at top
        const clockGeo = new THREE.BoxGeometry(3, 1.5, 0.2);
        const clockCanvas = document.createElement('canvas');
        clockCanvas.width = 128; clockCanvas.height = 64;
        const clockCtx = clockCanvas.getContext('2d');
        clockCtx.fillStyle = '#000000';
        clockCtx.fillRect(0, 0, 128, 64);
        clockCtx.fillStyle = '#00ff00';
        clockCtx.font = 'bold 36px monospace';
        clockCtx.textAlign = 'center';
        clockCtx.textBaseline = 'middle';
        clockCtx.fillText('0:00.000', 64, 32);
        const clockTex = new THREE.CanvasTexture(clockCanvas);
        const clockMat = new THREE.MeshStandardMaterial({ map: clockTex, emissive: 0x00ff00, emissiveIntensity: 0.3 });
        const clock = new THREE.Mesh(clockGeo, clockMat);
        clock.position.set(towerPos.x, towerPos.y + towerH + 3.5, towerPos.z);
        clock.rotation.y = towerAngle;
        track._add(clock);
      }
    }

    // ============================================================
    // 3. 130R GRANDSTAND - Outside of the legendary high-speed corner
    //    130R is at approximately t=0.93
    // ============================================================
    placeStand(0.93, hw + 20, -1, 30, 8, 8, 0x333344, 0x003399, [0x003399, 0xffffff, 0x003399]);

    // ============================================================
    // 4. SPOON CURVE GRANDSTAND - Outside of the double-apex left
    //    Spoon curve is at approximately t=0.65
    // ============================================================
    placeStand(0.65, hw + 20, 1, 28, 7, 7, 0x3a3a4a, 0xcc0000, [0xcc0000, 0xffffff, 0xcc0000]);

    // ============================================================
    // 5. S-CURVES (ESSES) GRANDSTAND - Sector 1 viewing area
    //    S-curves at approximately t=0.20
    // ============================================================
    placeStand(0.20, hw + 18, -1, 25, 6, 6, 0x2a3a4a, 0x666677, [0xcc0000, 0xffffff, 0xcc0000]);

    // ============================================================
    // 6. HIGHWAY OVERPASS - The famous Meishin Expressway bridge
    //    Crosses over the track between S-curves and Dunlop (t=0.28)
    //    This is a signature Suzuka landmark
    // ============================================================
    {
      const t = 0.28;
      const p = track.spline.getPointAt(t);
      const tangent = track.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const angle = Math.atan2(tangent.x, tangent.z);

      const bridgeWidth = (track._trackWidth || CONFIG.trackWidth) + 12;
      const pillarH = 10;
      const beamH = 1.5;

      // Concrete pillars on each side (wider than track)
      const pillarGeo = new THREE.CylinderGeometry(0.5, 0.6, pillarH, 8);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.7 });
      for (let side of [-1, 1]) {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        const offset = right.clone().multiplyScalar(bridgeWidth / 2 * side);
        pillar.position.set(p.x + offset.x, p.y + pillarH / 2, p.z + offset.z);
        pillar.castShadow = true;
        track._add(pillar);
      }

      // Road deck / beam across the track
      const deckGeo = new THREE.BoxGeometry(bridgeWidth, beamH, 8);
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.2 });
      const deckMesh = new THREE.Mesh(deckGeo, deckMat);
      deckMesh.position.set(p.x, p.y + pillarH + beamH / 2, p.z);
      deckMesh.rotation.y = angle;
      deckMesh.castShadow = true;
      track._add(deckMesh);

      // Guardrails on the bridge
      const railGeo = new THREE.BoxGeometry(bridgeWidth, 0.6, 0.2);
      const railMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4, metalness: 0.5 });
      for (let side of [-1, 1]) {
        const rail = new THREE.Mesh(railGeo, railMat);
        const offset = right.clone().multiplyScalar(4 * side);
        rail.position.set(p.x + offset.x, p.y + pillarH + beamH + 0.3, p.z + offset.z);
        rail.rotation.y = angle;
        track._add(rail);
      }

      // Highway signage
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 256; signCanvas.height = 64;
      const signCtx = signCanvas.getContext('2d');
      signCtx.fillStyle = '#006633';
      signCtx.fillRect(0, 0, 256, 64);
      signCtx.fillStyle = '#ffffff';
      signCtx.font = 'bold 32px Arial';
      signCtx.textAlign = 'center';
      signCtx.textBaseline = 'middle';
      signCtx.fillText('MEISHIN EXPY', 128, 32);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signGeo = new THREE.PlaneGeometry(6, 1.5);
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(p.x, p.y + pillarH + beamH + 1.5, p.z);
      sign.rotation.y = angle;
      track._add(sign);
    }

    // ============================================================
    // 7. DUNLOP CURVE ADVERTISING BOARDS
    //    Dunlop curve at approximately t=0.30
    // ============================================================
    {
      const dunlopSponsors = [
        { name: 'DUNLOP', bg: '#006633', fg: '#ffcc00' },
        { name: 'DUNLOP', bg: '#006633', fg: '#ffcc00' },
      ];

      for (let i = 0; i < 2; i++) {
        const t = 0.29 + i * 0.02;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10;
        placeBoard(t, dist, side, dunlopSponsors[i]);
      }
    }

    // ============================================================
    // 8. SPONSOR BOARDS - F1 Japanese GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'SUZUKA GP', bg: '#cc0000', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'DUNLOP', bg: '#006633', fg: '#ffcc00' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'F1', bg: '#e10600', fg: '#ffffff' },
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
    // 9. TIRE WALLS - Key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.10, side: -1 },   // Turn 1/2 exit
        { t: 0.25, side: 1 },    // S-curves exit
        { t: 0.35, side: -1 },   // Degner 1
        { t: 0.38, side: 1 },    // Degner 2
        { t: 0.50, side: -1 },   // Hairpin exit
        { t: 0.68, side: -1 },   // Spoon exit
        { t: 0.78, side: 1 },    // 130R approach
        { t: 0.85, side: -1 },   // Casio Triangle
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
    // 10. TRACK-BORDER GUARDRAILS - Additional safety barriers
    //     Placed at high-risk zones: 130R exit, Degner, Spoon
    // ============================================================
    {
      const barrierGeo = new THREE.BoxGeometry(8, 1.0, 0.4);
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5, metalness: 0.4 });

      const barrierPositions = [
        { t: 0.35, side: 1 },    // Degner outer
        { t: 0.37, side: 1 },    // Degner 2 outer
        { t: 0.50, side: 1 },    // Hairpin outer
        { t: 0.67, side: -1 },   // Spoon outer
        { t: 0.92, side: 1 },    // 130R exit outer
        { t: 0.83, side: 1 },    // Casio Triangle outer
      ];

      for (const bp of barrierPositions) {
        const { pos, angle } = safeOffset(bp.t, hw + 3, bp.side);
        if (!isSafe(pos.x, pos.z, 2)) continue;

        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(pos.x, pos.y + 0.5, pos.z);
        barrier.rotation.y = angle;
        barrier.castShadow = true;
        track._add(barrier);
      }
    }

    // ============================================================
    // 11. JAPANESE CHERRY BLOSSOM TREES - Decorative sakura trees
    //     Placed near grandstands and key areas
    // ============================================================
    {
      const sakuraCount = 40;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 3.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3020, roughness: 0.9 });
      const blossomGeo1 = new THREE.SphereGeometry(2.0, 8, 6);
      const blossomMat1 = new THREE.MeshStandardMaterial({ color: 0xffb7c5, roughness: 0.7 });
      const blossomGeo2 = new THREE.SphereGeometry(1.5, 8, 6);
      const blossomMat2 = new THREE.MeshStandardMaterial({ color: 0xff99aa, roughness: 0.7 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, sakuraCount);
      const blossom1 = new THREE.InstancedMesh(blossomGeo1, blossomMat1, Math.floor(sakuraCount * 0.6));
      const blossom2 = new THREE.InstancedMesh(blossomGeo2, blossomMat2, Math.ceil(sakuraCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < sakuraCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 20 && attempts < 50);
        if (attempts >= 50) continue;

        const y = track.getTerrainHeight(x, z);
        const scale = 0.7 + Math.random() * 0.6;

        // Trunk
        dummy.position.set(x, y + 1.8 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx1 + idx2, dummy.matrix);

        // Canopy
        dummy.position.set(x, y + 4.5 * scale, z);
        dummy.scale.set(scale * 1.3, scale * 0.9, scale * 1.3);
        dummy.updateMatrix();
        if (idx1 < Math.floor(sakuraCount * 0.6)) {
          blossom1.setMatrixAt(idx1, dummy.matrix);
          idx1++;
        } else {
          blossom2.setMatrixAt(idx2, dummy.matrix);
          idx2++;
        }
      }

      trunkMesh.count = idx1 + idx2;
      blossom1.count = idx1;
      blossom2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      blossom1.instanceMatrix.needsUpdate = true;
      blossom2.instanceMatrix.needsUpdate = true;
      track._add(trunkMesh);
      track._add(blossom1);
      track._add(blossom2);
    }

    // ============================================================
    // 12. CASIO TRIANGLE CHICANE SIGNAGE
    //     The final chicane area at approximately t=0.83
    // ============================================================
    {
      const { pos: chicanePos, angle: chicaneAngle } = safeOffset(0.83, hw + 14, 1);
      if (isSafe(chicanePos.x, chicanePos.z, 5)) {
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc0000';
        signCtx.fillRect(0, 0, 256, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 28px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('CASIO TRIANGLE', 128, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(8, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);

        const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
        for (let side of [-1, 1]) {
          const post = new THREE.Mesh(postGeo, postMat);
          const offset = side * 4;
          const cosA = Math.cos(chicaneAngle), sinA = Math.sin(chicaneAngle);
          post.position.set(
            chicanePos.x + offset * cosA,
            chicanePos.y + 2,
            chicanePos.z - offset * sinA
          );
          track._add(post);
        }
        sign.position.set(chicanePos.x, chicanePos.y + 4.5, chicanePos.z);
        sign.rotation.y = chicaneAngle;
        track._add(sign);
      }
    }
}
