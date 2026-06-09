import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Zandvoort Circuit scenery builder
 */
export function buildZandvoortScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. SAND DUNES - North Sea coastal dune landscape
    //    Zandvoort is literally on the sand, surrounded by dunes
    // ============================================================
    {
      const duneGeo = new THREE.SphereGeometry(4, 8, 6);
      const duneMat = new THREE.MeshStandardMaterial({ color: 0xd4c090, roughness: 1.0 });
      const duneCount = 30;

      for (let i = 0; i < duneCount; i++) {
        const t = Math.random();
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 20 + Math.random() * 50;
        const dx = p.x + right.x * dist * side;
        const dz = p.z + right.z * dist * side;
        if (track.distToTrack(dx, dz) < hw + 18) continue;

        const dune = new THREE.Mesh(duneGeo, duneMat);
        const scale = 0.6 + Math.random() * 2.0;
        dune.position.set(dx, track.getTerrainHeight(dx, dz) - 0.3, dz);
        dune.scale.set(scale * (1 + Math.random()), scale * 0.35, scale * (1 + Math.random()));
        track._add(dune);
      }

      // Extra tall dune ridges (signature Zandvoort feature)
      const ridgeMat = new THREE.MeshStandardMaterial({ color: 0xc8b480, roughness: 0.95 });
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = 100 + Math.random() * 60;
        const rx = Math.cos(angle) * r;
        const rz = Math.sin(angle) * r;
        if (track.distToTrack(rx, rz) < hw + 40) continue;

        const ridgeGeo = new THREE.BoxGeometry(30 + Math.random() * 20, 3 + Math.random() * 3, 60 + Math.random() * 40);
        const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
        ridge.position.set(rx, -0.5, rz);
        ridge.rotation.y = angle;
        track._add(ridge);
      }
    }

    // ============================================================
    // 2. MARRAM GRASS - Coastal dune grass vegetation
    //    Sparse, windswept vegetation typical of Dutch dunes
    // ============================================================
    {
      const grassCount = 80;
      const trunkGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.2, 4);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b8a3a, roughness: 0.9 });
      const leafGeo1 = new THREE.ConeGeometry(0.3, 1.8, 5);
      const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x5a8a2a, roughness: 0.9 });
      const leafGeo2 = new THREE.ConeGeometry(0.25, 1.4, 5);
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x7aa83a, roughness: 0.9 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, grassCount);
      const leaves1 = new THREE.InstancedMesh(leafGeo1, leafMat1, Math.floor(grassCount * 0.6));
      const leaves2 = new THREE.InstancedMesh(leafGeo2, leafMat2, Math.ceil(grassCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < grassCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 18 && attempts < 50);

        const y = track.getTerrainHeight(x, z);
        const scale = 0.5 + Math.random() * 0.8;

        // Trunk
        dummy.position.set(x, y + 0.6 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        if (i < grassCount * 0.6) {
          dummy.position.set(x, y + 1.5 * scale, z);
          dummy.updateMatrix();
          leaves1.setMatrixAt(idx1++, dummy.matrix);
        } else {
          dummy.position.set(x, y + 1.3 * scale, z);
          dummy.updateMatrix();
          leaves2.setMatrixAt(idx2++, dummy.matrix);
        }
      }

      trunkMesh.count = grassCount;
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
    // 3. ORANGE ARMY FLAGS - Verstappen fan banners
    //    The iconic sea of orange at the Dutch GP
    // ============================================================
    {
      const flagPositions = [
        { t: 0.02, side: 1 }, { t: 0.04, side: -1 },
        { t: 0.08, side: 1 }, { t: 0.12, side: -1 },
        { t: 0.16, side: 1 }, { t: 0.20, side: -1 },
        { t: 0.24, side: 1 }, { t: 0.28, side: -1 },
        { t: 0.32, side: 1 }, { t: 0.36, side: -1 },
        { t: 0.40, side: 1 }, { t: 0.44, side: -1 },
        { t: 0.48, side: 1 }, { t: 0.52, side: -1 },
        { t: 0.56, side: 1 }, { t: 0.60, side: -1 },
        { t: 0.64, side: 1 }, { t: 0.68, side: -1 },
        { t: 0.72, side: 1 }, { t: 0.76, side: -1 },
        { t: 0.80, side: 1 }, { t: 0.84, side: -1 },
        { t: 0.88, side: 1 }, { t: 0.92, side: -1 },
        { t: 0.96, side: 1 }, { t: 0.99, side: -1 },
      ];

      // Orange Verstappen flags
      const orangeFlagCanvas = document.createElement('canvas');
      orangeFlagCanvas.width = 128; orangeFlagCanvas.height = 96;
      const oCtx = orangeFlagCanvas.getContext('2d');
      oCtx.fillStyle = '#ff6600';
      oCtx.fillRect(0, 0, 128, 96);
      oCtx.fillStyle = '#ffffff';
      oCtx.font = 'bold 36px Arial';
      oCtx.textAlign = 'center';
      oCtx.textBaseline = 'middle';
      oCtx.fillText('P1', 64, 48);
      const orangeFlagTex = new THREE.CanvasTexture(orangeFlagCanvas);

      // Dutch flag (red-white-blue)
      const dutchFlagCanvas = document.createElement('canvas');
      dutchFlagCanvas.width = 128; dutchFlagCanvas.height = 96;
      const dCtx = dutchFlagCanvas.getContext('2d');
      dCtx.fillStyle = '#ae1c28';
      dCtx.fillRect(0, 0, 128, 32);
      dCtx.fillStyle = '#ffffff';
      dCtx.fillRect(0, 32, 128, 32);
      dCtx.fillStyle = '#21468b';
      dCtx.fillRect(0, 64, 128, 32);
      const dutchFlagTex = new THREE.CanvasTexture(dutchFlagCanvas);

      // Max 1 flag
      const maxFlagCanvas = document.createElement('canvas');
      maxFlagCanvas.width = 128; maxFlagCanvas.height = 96;
      const mCtx = maxFlagCanvas.getContext('2d');
      mCtx.fillStyle = '#ff6600';
      mCtx.fillRect(0, 0, 128, 96);
      mCtx.fillStyle = '#003399';
      mCtx.font = 'bold 28px Arial';
      mCtx.textAlign = 'center';
      mCtx.textBaseline = 'middle';
      mCtx.fillText('MAX', 64, 32);
      mCtx.fillText('1', 64, 68);
      const maxFlagTex = new THREE.CanvasTexture(maxFlagCanvas);

      const flagTextures = [orangeFlagTex, dutchFlagTex, maxFlagTex];

      for (const fp of flagPositions) {
        const { pos: fPos, angle: fAngle } = safeOffset(fp.t, hw + 5, fp.side);
        if (!isSafe(fPos.x, fPos.z, 1)) continue;

        // Flag pole
        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 4.5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(fPos.x, fPos.y + 2.25, fPos.z);
        track._add(pole);

        // Flag
        const flagTex = flagTextures[Math.floor(Math.random() * flagTextures.length)];
        const flagGeo = new THREE.PlaneGeometry(1.8, 1.3);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(fPos.x, fPos.y + 3.8, fPos.z);
        flag.rotation.y = fAngle;
        track._add(flag);
      }
    }

    // ============================================================
    // 4. MAIN GRANDSTAND - Start/Finish straight
    //    Orange-themed grandstand for the Dutch GP
    // ============================================================
    placeStand(0.03, hw + 20, 1, 40, 9, 9, 0x333344, 0xff6600);

    // Pit building - opposite side (t=0.06)
    {
      const { pos, angle } = safeOffset(0.06, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 35, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garages with Dutch colors (orange + blue + white)
        const garageColors = [0xff6600, 0x003399, 0xffffff, 0xff6600, 0x003399];
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

        // ZANDVOORT sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#ff6600';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 40px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('CIRCUIT ZANDVOORT', 256, 32);
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
    // 5. SECONDARY GRANDSTANDS - Key corners
    // ============================================================
    placeStand(0.20, hw + 18, -1, 26, 7, 7, 0x333344, 0xff6600);
    placeStand(0.40, hw + 20, 1, 22, 5, 6, 0x2a3a4a, 0x003399);
    placeStand(0.60, hw + 18, -1, 28, 7, 7, 0x3a3a4a, 0xff6600);
    placeStand(0.80, hw + 20, 1, 20, 5, 6, 0x2a3a4a, 0x003399);

    // ============================================================
    // 6. HUGO BOSS / RED BULL PIT COMPLEX - Prominent structures
    //    Red Bull is the dominant team at Zandvoort (Verstappen)
    // ============================================================
    {
      // Red Bull hospitality building near start/finish
      const { pos: rbPos, angle: rbAngle } = safeOffset(0.95, hw + 30, 1);
      if (isSafe(rbPos.x, rbPos.z, 10)) {
        // Main building - dark navy blue (Red Bull)
        const bodyGeo = new THREE.BoxGeometry(20, 8, 10);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.4, metalness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(rbPos.x, rbPos.y + 4, rbPos.z);
        body.rotation.y = rbAngle;
        body.castShadow = true;
        body.receiveShadow = true;
        track._add(body);

        // Orange accent stripe (Verstappen orange)
        const stripeGeo = new THREE.BoxGeometry(20.2, 1.2, 10.2);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.3, metalness: 0.4 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(rbPos.x, rbPos.y + 6.5, rbPos.z);
        stripe.rotation.y = rbAngle;
        track._add(stripe);

        // "RED BULL RACING" sign
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 128;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#0a1a4a';
        signCtx.fillRect(0, 0, 512, 128);
        signCtx.fillStyle = '#ff6600';
        signCtx.font = 'bold 48px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('RED BULL RACING', 256, 64);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(12, 3);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(rbPos.x, rbPos.y + 9.5, rbPos.z);
        sign.rotation.y = rbAngle;
        track._add(sign);

        // Garage doors (orange)
        for (let i = 0; i < 6; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3.5);
          const gMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(rbAngle), sinA = Math.sin(rbAngle);
          const localX = (i - 2.5) * 3.0;
          g.position.set(
            rbPos.x + localX * cosA - 5 * sinA,
            rbPos.y + 1.8,
            rbPos.z - localX * sinA + 5 * cosA
          );
          g.rotation.y = rbAngle;
          track._add(g);
        }
      }
    }

    // ============================================================
    // 7. SPONSOR BOARDS - Dutch GP / F1 sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'DUTCH GP', bg: '#ff6600', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'ZANDVOORT', bg: '#ff6600', fg: '#003399' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'F1', bg: '#e10600', fg: '#ffffff' },
        { name: 'ORANJE', bg: '#ff6600', fg: '#ffffff' },
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
    // 8. TIRE WALLS - Key corner exits
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
    // 9. WIND SHIELD FENCES - Coastal wind protection
    //    Glass/acrylic wind fences common at Zandvoort
    // ============================================================
    {
      const fencePositions = [
        { t: 0.05, side: 1, count: 6 },
        { t: 0.15, side: -1, count: 5 },
        { t: 0.25, side: 1, count: 6 },
        { t: 0.35, side: -1, count: 5 },
        { t: 0.45, side: 1, count: 6 },
        { t: 0.55, side: -1, count: 5 },
        { t: 0.65, side: 1, count: 6 },
        { t: 0.75, side: -1, count: 5 },
        { t: 0.85, side: 1, count: 6 },
        { t: 0.95, side: -1, count: 5 },
      ];

      for (const fp of fencePositions) {
        const { pos: fPos, angle: fAngle, tangent } = safeOffset(fp.t, hw + 12, fp.side);
        if (!isSafe(fPos.x, fPos.z, 8)) continue;

        for (let i = 0; i < fp.count; i++) {
          const localX = (i - fp.count / 2 + 0.5) * 2.5;
          const cosA = Math.cos(fAngle), sinA = Math.sin(fAngle);
          const fx = fPos.x + localX * cosA;
          const fz = fPos.z - localX * sinA;

          // Vertical post
          const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 4, 6);
          const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(fx, fPos.y + 2, fz);
          track._add(post);

          // Transparent panel
          const panelGeo = new THREE.PlaneGeometry(2.2, 3);
          const panelMat = new THREE.MeshStandardMaterial({
            color: 0xaabbcc,
            transparent: true,
            opacity: 0.25,
            roughness: 0.1,
            metalness: 0.3,
            side: THREE.DoubleSide
          });
          const panel = new THREE.Mesh(panelGeo, panelMat);
          panel.position.set(fx, fPos.y + 2, fz);
          panel.rotation.y = fAngle;
          track._add(panel);
        }
      }
    }

    // ============================================================
    // 10. DUTCH ORANGE BANNERS - String banners along the straight
    // ============================================================
    {
      const bannerCount = 8;
      for (let i = 0; i < bannerCount; i++) {
        const t = (i + 0.5) / bannerCount;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const angle = Math.atan2(tangent.x, tangent.z);

        // Two poles on each side of track
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        for (let side of [-1, 1]) {
          const dist = hw + 3;
          const bx = p.x + right.x * dist * side;
          const bz = p.z + right.z * dist * side;

          const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 5, 6);
          const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(bx, p.y + 2.5, bz);
          track._add(pole);
        }

        // Banner string across track (orange)
        const bannerGeo = new THREE.PlaneGeometry(hw * 2 - 2, 1.0);
        const bannerColor = i % 3 === 0 ? 0xff6600 : (i % 3 === 1 ? 0x003399 : 0xffffff);
        const bannerMat = new THREE.MeshStandardMaterial({
          color: bannerColor,
          side: THREE.DoubleSide,
          roughness: 0.9
        });
        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(p.x, p.y + 5, p.z);
        banner.rotation.y = angle;
        track._add(banner);
      }
    }
}
