import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Monaco Circuit scenery builder
 */
export function buildMonacoScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. TUNNEL ENTRANCE/EXIT - The famous Monaco tunnel
    //    Place tunnel structure at ~20% and ~30% along track
    // ============================================================
    {
      const tunnelPositions = [
        { t: 0.20, label: 'TUNNEL' },
        { t: 0.30, label: '' },
      ];

      for (const tp of tunnelPositions) {
        const { pos, angle } = safeOffset(tp.t, 0, 1);
        const tunnelW = hw + 10;
        const tunnelH = 10;
        const tunnelD = 18;

        // Tunnel roof/canopy spanning over the track
        const roofGeo = new THREE.BoxGeometry(tunnelW, 1.2, tunnelD);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + tunnelH, pos.z);
        roof.rotation.y = angle;
        roof.castShadow = true;
        roof.receiveShadow = true;
        track._add(roof);

        // Side walls
        const wallGeo = new THREE.BoxGeometry(1, tunnelH, tunnelD);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x666677, roughness: 0.7 });
        for (const side of [-1, 1]) {
          const wall = new THREE.Mesh(wallGeo, wallMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          wall.position.set(
            pos.x + (tunnelW / 2) * cosA * side,
            pos.y + tunnelH / 2,
            pos.z - (tunnelW / 2) * sinA * side
          );
          wall.rotation.y = angle;
          track._add(wall);
        }

        // Tunnel entrance arch frame
        const archGeo = new THREE.BoxGeometry(tunnelW + 2, 2, 2);
        const archMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.4, metalness: 0.5 });
        const arch = new THREE.Mesh(archGeo, archMat);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        arch.position.set(
          pos.x - cosA * (tunnelD / 2),
          pos.y + tunnelH - 1,
          pos.z + sinA * (tunnelD / 2)
        );
        arch.rotation.y = angle;
        track._add(arch);

        // Interior lighting strip (emissive)
        const lightGeo = new THREE.BoxGeometry(2, 0.3, tunnelD - 2);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.8, roughness: 0.1
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(pos.x, pos.y + tunnelH - 0.5, pos.z);
        light.rotation.y = angle;
        track._add(light);

        // "TUNNEL" sign at entrance (only on the first one)
        if (tp.label) {
          const signCanvas = document.createElement('canvas');
          signCanvas.width = 256; signCanvas.height = 64;
          const signCtx = signCanvas.getContext('2d');
          signCtx.fillStyle = '#003366';
          signCtx.fillRect(0, 0, 256, 64);
          signCtx.fillStyle = '#ffffff';
          signCtx.font = 'bold 40px Arial';
          signCtx.textAlign = 'center';
          signCtx.textBaseline = 'middle';
          signCtx.fillText('TUNNEL', 128, 32);
          const signTex = new THREE.CanvasTexture(signCanvas);
          const signGeo2 = new THREE.PlaneGeometry(6, 1.5);
          const signMat2 = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
          const sign = new THREE.Mesh(signGeo2, signMat2);
          sign.position.set(
            pos.x - cosA * (tunnelD / 2) - 1,
            pos.y + tunnelH - 3,
            pos.z + sinA * (tunnelD / 2) + 1
          );
          sign.rotation.y = angle;
          track._add(sign);
        }
      }
    }

    // ============================================================
    // 2. HARBOR/MARINA AREA - Yachts and Mediterranean vibes
    //    Place at ~42% along track (harbor side)
    // ============================================================
    {
      const harborT = 0.42;
      const { pos: harborCenter, angle: harborAngle } = safeOffset(harborT, hw + 35, 1);

      // Water surface
      const waterGeo = new THREE.PlaneGeometry(60, 40);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x1a6faa, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.rotation.z = -harborAngle;
      water.position.set(harborCenter.x, harborCenter.y - 1.5, harborCenter.z);
      water.receiveShadow = true;
      track._add(water);

      // Yachts floating on the harbor
      const yachtColors = [0xffffff, 0xf0f0f0, 0xe8e8e8, 0xd0d0d0];
      for (let i = 0; i < 6; i++) {
        const yawX = harborCenter.x + (i - 2.5) * 8 + (Math.random() - 0.5) * 4;
        const yawZ = harborCenter.z + (Math.random() - 0.5) * 25;
        if (track.distToTrack(yawX, yawZ) < hw + 12) continue;

        // Hull
        const hullGeo = new THREE.BoxGeometry(2.5, 1.5, 8);
        const hullMat = new THREE.MeshStandardMaterial({
          color: yachtColors[i % yachtColors.length], roughness: 0.4, metalness: 0.3
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.position.set(yawX, harborCenter.y - 0.5, yawZ);
        hull.rotation.y = harborAngle + (Math.random() - 0.5) * 0.3;
        hull.castShadow = true;
        track._add(hull);

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(2, 1.8, 3);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(yawX, harborCenter.y + 0.5, yawZ + 1);
        cabin.rotation.y = harborAngle;
        track._add(cabin);

        // Mast
        const mastGeo = new THREE.CylinderGeometry(0.05, 0.08, 6, 6);
        const mastMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7 });
        const mast = new THREE.Mesh(mastGeo, mastMat);
        mast.position.set(yawX, harborCenter.y + 3, yawZ - 1);
        track._add(mast);
      }

      // Harbor grandstands
      for (const side of [-1, 1]) {
        const { pos: standPos, angle: standAngle } = safeOffset(harborT, hw + 16, side);
        if (!isSafe(standPos.x, standPos.z, 6)) continue;

        const standW = 16, standH = 5, standD = 5;
        const standGeo = new THREE.BoxGeometry(standW, standH, standD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.6 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(standPos.x, standPos.y + standH / 2, standPos.z);
        stand.rotation.y = standAngle;
        stand.castShadow = true;
        track._add(stand);

        // Roof
        const roofGeo = new THREE.BoxGeometry(standW + 2, 0.3, standD + 2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(standPos.x, standPos.y + standH + 0.15, standPos.z);
        roof.rotation.y = standAngle;
        track._add(roof);

        // Seats (Monaco colors: red, white, blue)
        const seatColors = [0xcc0000, 0xffffff, 0x0044aa];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < Math.floor(standW / 2); c++) {
            const seatGeo = new THREE.BoxGeometry(0.5, 0.6, 0.5);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const cosA = Math.cos(standAngle), sinA = Math.sin(standAngle);
            const localX = (c - Math.floor(standW / 4) + 0.5) * 1.8;
            const localZ = (r - 1) * (standD / 3);
            seat.position.set(
              standPos.x + localX * cosA + localZ * sinA,
              standPos.y + 0.5 + r * 1.0,
              standPos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = standAngle;
            track._add(seat);
          }
        }
      }
    }

    // ============================================================
    // 3. CASINO SQUARE DECORATIONS - The famous Casino turn
    //    Place at ~12% along track
    // ============================================================
    {
      const casinoT = 0.12;
      const { pos: casinoPos, angle: casinoAngle } = safeOffset(casinoT, hw + 12, 1);
      if (isSafe(casinoPos.x, casinoPos.z, 4)) {
        // Casino building facade
        const facadeW = 18, facadeH = 14, facadeD = 3;
        const facadeGeo = new THREE.BoxGeometry(facadeW, facadeH, facadeD);
        const facadeMat = new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.5 });
        const facade = new THREE.Mesh(facadeGeo, facadeMat);
        facade.position.set(casinoPos.x, casinoPos.y + facadeH / 2, casinoPos.z);
        facade.rotation.y = casinoAngle;
        facade.castShadow = true;
        track._add(facade);

        // Casino roof (green copper style)
        const roofGeo = new THREE.BoxGeometry(facadeW + 2, 1, facadeD + 2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x2e6e4e, roughness: 0.4, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(casinoPos.x, casinoPos.y + facadeH + 0.5, casinoPos.z);
        roof.rotation.y = casinoAngle;
        track._add(roof);

        // Casino columns
        const colGeo = new THREE.CylinderGeometry(0.3, 0.3, facadeH - 1, 8);
        const colMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.3 });
        for (let i = 0; i < 5; i++) {
          const col = new THREE.Mesh(colGeo, colMat);
          const cosA = Math.cos(casinoAngle), sinA = Math.sin(casinoAngle);
          const localX = (i - 2) * (facadeW / 5);
          col.position.set(
            casinoPos.x + localX * cosA - facadeD / 2 * sinA,
            casinoPos.y + (facadeH - 1) / 2 + 0.5,
            casinoPos.z - localX * sinA + facadeD / 2 * cosA
          );
          col.rotation.y = casinoAngle;
          track._add(col);
        }

        // "CASINO" sign
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#1a4a2a';
        signCtx.fillRect(0, 0, 256, 64);
        signCtx.fillStyle = '#c0a060';
        signCtx.font = 'bold 40px serif';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('CASINO', 128, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(8, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(casinoPos.x, casinoPos.y + facadeH - 2, casinoPos.z);
        sign.rotation.y = casinoAngle;
        track._add(sign);

        // Casino square decorative fountain
        const { pos: fountainPos } = safeOffset(casinoT, hw + 22, 1);
        if (isSafe(fountainPos.x, fountainPos.z, 2)) {
          const baseGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.6, 16);
          const baseMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.3, metalness: 0.6 });
          const base = new THREE.Mesh(baseGeo, baseMat);
          base.position.set(fountainPos.x, fountainPos.y + 0.3, fountainPos.z);
          track._add(base);

          const waterGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.4, 16);
          const waterMat = new THREE.MeshStandardMaterial({
            color: 0x4488cc, transparent: true, opacity: 0.6, roughness: 0.1
          });
          const waterMesh = new THREE.Mesh(waterGeo, waterMat);
          waterMesh.position.set(fountainPos.x, fountainPos.y + 0.5, fountainPos.z);
          track._add(waterMesh);

          const pillarGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 8);
          const pillarMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.7 });
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(fountainPos.x, fountainPos.y + 1.8, fountainPos.z);
          track._add(pillar);
        }
      }
    }

    // ============================================================
    // 4. GRANDSTANDS AT KEY CORNERS - Between buildings
    // ============================================================
    {
      const standPositions = [
        { t: 0.04, side: -1, w: 14, h: 6, d: 5 },  // Sainte Devote
        { t: 0.18, side: 1, w: 16, h: 5, d: 5 },   // After Casino
        { t: 0.35, side: -1, w: 14, h: 5, d: 5 },  // Near harbor
        { t: 0.55, side: -1, w: 12, h: 4, d: 4 },  // Swimming pool
        { t: 0.65, side: 1, w: 14, h: 5, d: 5 },   // Swimming pool chicane
        { t: 0.78, side: -1, w: 12, h: 4, d: 4 },  // Rascasse area
        { t: 0.88, side: 1, w: 14, h: 5, d: 5 },   // Pit straight start
      ];

      for (const s of standPositions) {
        const { pos: sPos, angle: sAngle } = safeOffset(s.t, hw + 10, s.side);
        if (!isSafe(sPos.x, sPos.z, s.w / 2)) continue;

        const standGeo = new THREE.BoxGeometry(s.w, s.h, s.d);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.6 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(sPos.x, sPos.y + s.h / 2, sPos.z);
        stand.rotation.y = sAngle;
        stand.castShadow = true;
        track._add(stand);

        const roofGeo = new THREE.BoxGeometry(s.w + 1.5, 0.3, s.d + 1.5);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(sPos.x, sPos.y + s.h + 0.15, sPos.z);
        roof.rotation.y = sAngle;
        track._add(roof);

        const seatColors = [0xcc0000, 0xffffff, 0x0044aa];
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < Math.floor(s.w / 2); c++) {
            const seatGeo = new THREE.BoxGeometry(0.45, 0.55, 0.45);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const cosA = Math.cos(sAngle), sinA = Math.sin(sAngle);
            const localX = (c - Math.floor(s.w / 4) + 0.5) * 1.7;
            const localZ = (r - 0.5) * (s.d / 3);
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
    // 5. SWIMMING POOL SECTION - Iconic swimming pool turns
    //    Place at ~58% along track
    // ============================================================
    {
      const poolT = 0.58;
      const { pos: poolPos } = safeOffset(poolT, hw + 18, 1);
      if (isSafe(poolPos.x, poolPos.z, 4)) {
        // Swimming pool basin
        const poolGeo = new THREE.BoxGeometry(12, 0.8, 6);
        const poolMat = new THREE.MeshStandardMaterial({ color: 0x2288cc, transparent: true, opacity: 0.7, roughness: 0.1 });
        const pool = new THREE.Mesh(poolGeo, poolMat);
        pool.position.set(poolPos.x, poolPos.y + 0.2, poolPos.z);
        track._add(pool);

        // Pool border
        const borderGeo = new THREE.BoxGeometry(13, 0.6, 7);
        const borderMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.set(poolPos.x, poolPos.y + 0.1, poolPos.z);
        track._add(border);

        // "PISCINE" sign
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#0044aa';
        signCtx.fillRect(0, 0, 256, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('PISCINE', 128, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(5, 1.2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(poolPos.x, poolPos.y + 2, poolPos.z);
        track._add(sign);
      }
    }

    // ============================================================
    // 6. SPONSOR BOARDS - Dense Monaco sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'MONACO GP', bg: '#1a1a2e', fg: '#c0a060' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'CITY OF MONACO', bg: '#cc0000', fg: '#ffffff' },
        { name: 'TAG HEUER', bg: '#1a1a1a', fg: '#ffffff' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
      ];

      const boardCount = 12;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 7 + Math.random() * 3;
        const { pos, angle } = safeOffset(t, dist, side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const sponsor = sponsors[i % sponsors.length];

        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 3, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 });
        for (const pSide of [-1, 1]) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(pos.x, pos.y + 1.5, pos.z);
          track._add(post);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = sponsor.bg;
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = sponsor.fg;
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sponsor.name, 128, 64);
        const tex = new THREE.CanvasTexture(canvas);

        const boardGeo = new THREE.BoxGeometry(5, 2.5, 0.15);
        const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.set(pos.x, pos.y + 4.2, pos.z);
        board.rotation.y = angle;
        board.castShadow = true;
        track._add(board);
      }
    }

    // ============================================================
    // 7. STREET BARRIERS / ARMCO - Close to track surface
    // ============================================================
    {
      const barrierCount = 40;
      const barrierGeo = new THREE.BoxGeometry(0.3, 1.0, 2.5);
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.5 });
      const accentRed = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.5 });
      const accentWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

      for (let i = 0; i < barrierCount; i++) {
        const t = i / barrierCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 2.5;
        const { pos, angle } = safeOffset(t, dist, side);
        if (!isSafe(pos.x, pos.z, 0.5)) continue;

        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(pos.x, pos.y + 0.5, pos.z);
        barrier.rotation.y = angle;
        track._add(barrier);

        const stripeGeo = new THREE.BoxGeometry(0.35, 0.2, 2.6);
        const stripeMat = i % 4 < 2 ? accentRed : accentWhite;
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(pos.x, pos.y + 1.05, pos.z);
        stripe.rotation.y = angle;
        track._add(stripe);
      }
    }

    // ============================================================
    // 8. PIT BUILDING - Start/finish straight
    // ============================================================
    {
      const { pos: pitPos, angle: pitAngle } = safeOffset(0.02, hw + 14, -1);
      if (isSafe(pitPos.x, pitPos.z, 8)) {
        const pitW = 30, pitH = 5, pitD = 6;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.3 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pitPos.x, pitPos.y + pitH / 2, pitPos.z);
        pit.rotation.y = pitAngle;
        pit.castShadow = true;
        track._add(pit);

        const garageColors = [0xcc0000, 0xffffff, 0x0044aa, 0xffffff, 0xcc0000];
        for (let i = 0; i < 8; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(pitAngle), sinA = Math.sin(pitAngle);
          const localX = (i - 3.5) * 3.5;
          g.position.set(
            pitPos.x + localX * cosA - (pitD / 2) * sinA,
            pitPos.y + 0.5,
            pitPos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = pitAngle;
          track._add(g);
        }

        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc0000';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('MONACO GRAND PRIX', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(14, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pitPos.x, pitPos.y + pitH + 1.5, pitPos.z);
        sign.rotation.y = pitAngle;
        track._add(sign);
      }
    }

    // ============================================================
    // 9. LAMP POSTS - Street lighting along the track
    // ============================================================
    {
      const lampCount = 20;
      for (let i = 0; i < lampCount; i++) {
        const t = (i + 0.5) / lampCount;
        const side = i % 2 === 0 ? 1 : -1;
        const { pos } = safeOffset(t, hw + 5, side);
        if (!isSafe(pos.x, pos.z, 1)) continue;

        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 2.5, pos.z);
        track._add(pole);

        const lampGeo = new THREE.SphereGeometry(0.3, 8, 6);
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.6, roughness: 0.1
        });
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(pos.x, pos.y + 5.2, pos.z);
        track._add(lamp);
      }
    }

    // ============================================================
    // 10. CHECKERED FLAG BANNERS - Along the pit straight
    // ============================================================
    {
      const bannerPositions = [
        { t: 0.01, side: 1 }, { t: 0.03, side: -1 },
        { t: 0.93, side: 1 }, { t: 0.95, side: -1 },
        { t: 0.97, side: 1 }, { t: 0.99, side: -1 },
      ];

      for (const bp of bannerPositions) {
        const { pos: bPos, angle: bAngle } = safeOffset(bp.t, hw + 7, bp.side);
        if (!isSafe(bPos.x, bPos.z, 2)) continue;

        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 4, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(bPos.x, bPos.y + 2, bPos.z);
        track._add(pole);

        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128; flagCanvas.height = 96;
        const fCtx = flagCanvas.getContext('2d');
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(0, 0, 128, 96);
        fCtx.fillStyle = '#000000';
        for (let fi = 0; fi < 8; fi++) {
          for (let fj = 0; fj < 6; fj++) {
            if ((fi + fj) % 2 === 0) fCtx.fillRect(fi * 16, fj * 16, 16, 16);
          }
        }
        const flagTex = new THREE.CanvasTexture(flagCanvas);
        const flagGeo = new THREE.PlaneGeometry(1.5, 1.2);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(bPos.x, bPos.y + 3.8, bPos.z);
        flag.rotation.y = bAngle;
        track._add(flag);
      }
    }

    // ============================================================
    // 11. TIRE BARRIERS at key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.3, 0.15, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.10, side: -1 }, { t: 0.22, side: 1 },
        { t: 0.38, side: -1 }, { t: 0.50, side: 1 },
        { t: 0.62, side: -1 }, { t: 0.75, side: 1 },
        { t: 0.85, side: -1 }, { t: 0.92, side: 1 },
      ];

      for (const tp of tirePositions) {
        const { pos } = safeOffset(tp.t, hw + 3.5, tp.side);
        if (!isSafe(pos.x, pos.z, 0.5)) continue;
        for (let j = 0; j < 4; j++) {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          tire.position.set(
            pos.x + (j % 2) * 0.8 - 0.4,
            pos.y + 0.3 + Math.floor(j / 2) * 0.6,
            pos.z + (Math.floor(j / 2)) * 0.4
          );
          tire.rotation.x = Math.PI / 2;
          track._add(tire);
        }
      }
    }
}
