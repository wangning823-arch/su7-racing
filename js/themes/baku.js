import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Baku Circuit scenery builder
 */
export function buildBakuScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. ANCIENT FORTRESS WALLS (Icherisheher Old City)
    //    Medieval stone walls with battlements and watchtowers
    //    Placed along the narrow "castle section" of the circuit
    // ============================================================
    {
      const wallColor = 0xc4a86a;
      const wallDarkColor = 0xa89058;
      const stoneMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9, metalness: 0.0 });
      const stoneDarkMat = new THREE.MeshStandardMaterial({ color: wallDarkColor, roughness: 0.9, metalness: 0.0 });
      const merlonMat = new THREE.MeshStandardMaterial({ color: 0xb89860, roughness: 0.85, metalness: 0.0 });

      // Fortress wall segments along the castle section (~30-50% of track)
      const wallSegments = [
        { t: 0.30, dist: 20, side: 1, len: 30, h: 10 },
        { t: 0.33, dist: 18, side: -1, len: 25, h: 10 },
        { t: 0.36, dist: 22, side: 1, len: 28, h: 10 },
        { t: 0.39, dist: 17, side: -1, len: 22, h: 10 },
        { t: 0.42, dist: 20, side: 1, len: 30, h: 10 },
        { t: 0.45, dist: 19, side: -1, len: 26, h: 10 },
        { t: 0.48, dist: 21, side: 1, len: 24, h: 10 },
        { t: 0.50, dist: 18, side: -1, len: 28, h: 10 },
      ];

      for (const ws of wallSegments) {
        const { pos, angle } = safeOffset(ws.t, ws.dist, ws.side);
        if (!isSafe(pos.x, pos.z, ws.len / 2)) continue;

        // Main wall body
        const wallGeo = new THREE.BoxGeometry(ws.len, ws.h, 2.5);
        const wall = new THREE.Mesh(wallGeo, stoneMat);
        wall.position.set(pos.x, pos.y + ws.h / 2, pos.z);
        wall.rotation.y = angle;
        wall.castShadow = true;
        wall.receiveShadow = true;
        track._add(wall);

        // Battlements (merlons) on top
        const merlonCount = Math.floor(ws.len / 3);
        const merlonGeo = new THREE.BoxGeometry(1.2, 1.5, 2.8);
        for (let m = 0; m < merlonCount; m++) {
          if (m % 2 === 0) {
            const merlon = new THREE.Mesh(merlonGeo, merlonMat);
            const localX = (m - merlonCount / 2 + 0.5) * 3;
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            merlon.position.set(
              pos.x + localX * cosA,
              pos.y + ws.h + 0.75,
              pos.z - localX * sinA
            );
            merlon.rotation.y = angle;
            merlon.castShadow = true;
            track._add(merlon);
          }
        }

        // Stone texture stripes
        const stripeGeo = new THREE.BoxGeometry(ws.len + 0.1, 0.3, 2.6);
        for (let s = 0; s < 3; s++) {
          const stripe = new THREE.Mesh(stripeGeo, stoneDarkMat);
          stripe.position.set(pos.x, pos.y + 2 + s * 3, pos.z);
          stripe.rotation.y = angle;
          track._add(stripe);
        }
      }

      // Watchtowers at wall corners
      const towerPositions = [
        { t: 0.30, dist: 22, side: 1 },
        { t: 0.42, dist: 24, side: 1 },
        { t: 0.36, dist: 20, side: -1 },
        { t: 0.50, dist: 20, side: -1 },
      ];

      for (const tp of towerPositions) {
        const { pos } = safeOffset(tp.t, tp.dist, tp.side);
        if (!isSafe(pos.x, pos.z, 4)) continue;

        const towerH = 14;
        const towerGeo = new THREE.CylinderGeometry(2.5, 3, towerH, 8);
        const tower = new THREE.Mesh(towerGeo, stoneMat);
        tower.position.set(pos.x, pos.y + towerH / 2, pos.z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        track._add(tower);

        // Tower top cap
        const capGeo = new THREE.CylinderGeometry(3.2, 2.5, 1.5, 8);
        const cap = new THREE.Mesh(capGeo, stoneDarkMat);
        cap.position.set(pos.x, pos.y + towerH + 0.75, pos.z);
        cap.castShadow = true;
        track._add(cap);

        // Tower merlons
        const tMerlonGeo = new THREE.BoxGeometry(1.0, 1.2, 1.0);
        for (let a = 0; a < 8; a++) {
          if (a % 2 === 0) {
            const mAngle = (a / 8) * Math.PI * 2;
            const m = new THREE.Mesh(tMerlonGeo, merlonMat);
            m.position.set(
              pos.x + Math.cos(mAngle) * 3,
              pos.y + towerH + 2.0,
              pos.z + Math.sin(mAngle) * 3
            );
            m.castShadow = true;
            track._add(m);
          }
        }
      }

      // Ancient arched gate in the wall (Azerbaijani pointed arch style)
      {
        const { pos, angle } = safeOffset(0.38, 19, 1);
        if (isSafe(pos.x, pos.z, 5)) {
          const archW = 6;
          const archH = 9;
          const archD = 3;
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const perpX = -sinA, perpZ = cosA;

          // Left pillar
          const pillarGeo = new THREE.BoxGeometry(1.5, archH, archD);
          const leftPillar = new THREE.Mesh(pillarGeo, stoneMat);
          leftPillar.position.set(
            pos.x - perpX * archW / 2,
            pos.y + archH / 2,
            pos.z - perpZ * archW / 2
          );
          leftPillar.rotation.y = angle;
          leftPillar.castShadow = true;
          track._add(leftPillar);

          const rightPillar = new THREE.Mesh(pillarGeo, stoneMat);
          rightPillar.position.set(
            pos.x + perpX * archW / 2,
            pos.y + archH / 2,
            pos.z + perpZ * archW / 2
          );
          rightPillar.rotation.y = angle;
          rightPillar.castShadow = true;
          track._add(rightPillar);

          // Arch top beam
          const beamGeo = new THREE.BoxGeometry(archW + 1, 2, archD);
          const beam = new THREE.Mesh(beamGeo, stoneDarkMat);
          beam.position.set(pos.x, pos.y + archH + 1, pos.z);
          beam.rotation.y = angle;
          beam.castShadow = true;
          track._add(beam);

          // Decorative pointed arch (Azerbaijani style)
          const pointGeo = new THREE.ConeGeometry(3, 4, 4);
          const pointArch = new THREE.Mesh(pointGeo, stoneMat);
          pointArch.position.set(pos.x, pos.y + archH + 3, pos.z);
          pointArch.rotation.y = angle + Math.PI / 4;
          pointArch.castShadow = true;
          track._add(pointArch);
        }
      }
    }

    // ============================================================
    // 2. FLAME TOWERS - Three iconic triangular towers
    //    Placed on one side of the circuit as landmark
    // ============================================================
    {
      const flamePositions = [
        { t: 0.15, dist: 35, side: 1 },
        { t: 0.18, dist: 38, side: 1 },
        { t: 0.21, dist: 33, side: 1 },
      ];

      const flameHeights = [28, 32, 26];
      const flameColors = [0xff3300, 0xff6600, 0xff4400];

      for (let i = 0; i < flamePositions.length; i++) {
        const fp = flamePositions[i];
        const { pos, angle } = safeOffset(fp.t, fp.dist, fp.side);
        if (!isSafe(pos.x, pos.z, 6)) continue;

        const h = flameHeights[i];
        // Triangular tower body (flame shape)
        const towerGeo = new THREE.ConeGeometry(5, h, 3);
        const towerMat = new THREE.MeshStandardMaterial({
          color: 0x334455,
          roughness: 0.2,
          metalness: 0.7
        });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.set(pos.x, pos.y + h / 2, pos.z);
        tower.rotation.y = angle + Math.PI / 6;
        tower.castShadow = true;
        tower.receiveShadow = true;
        track._add(tower);

        // LED facade glow (flame-colored emissive panels)
        const glowGeo = new THREE.PlaneGeometry(6, h * 0.7);
        const glowMat = new THREE.MeshStandardMaterial({
          color: flameColors[i],
          emissive: flameColors[i],
          emissiveIntensity: 0.8,
          roughness: 0.1,
          metalness: 0.5,
          side: THREE.DoubleSide
        });
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const faceDir = new THREE.Vector3(sinA, 0, cosA);
        const glow1 = new THREE.Mesh(glowGeo, glowMat);
        glow1.position.set(
          pos.x + faceDir.x * 3,
          pos.y + h * 0.5,
          pos.z + faceDir.z * 3
        );
        glow1.rotation.y = angle;
        track._add(glow1);

        const glow2 = new THREE.Mesh(glowGeo, glowMat);
        glow2.position.set(
          pos.x - faceDir.x * 3,
          pos.y + h * 0.5,
          pos.z - faceDir.z * 3
        );
        glow2.rotation.y = angle + Math.PI;
        track._add(glow2);
      }
    }

    // ============================================================
    // 3. MODERN GLASS SKYSCRAPERS - Baku's contemporary skyline
    // ============================================================
    {
      const buildingDefs = [
        { name: 'SOCAR Tower', w: 12, h: 24, d: 10, glassColor: 0x00aacc },
        { name: 'Azure Tower', w: 10, h: 20, d: 8, glassColor: 0x0088dd },
        { name: 'Park Boulevard', w: 14, h: 16, d: 12, glassColor: 0x22aadd },
        { name: 'Baku Crystal Hall', w: 16, h: 14, d: 14, glassColor: 0x44ccff },
        { name: 'Port Baku', w: 11, h: 22, d: 9, glassColor: 0x00bbff },
        { name: 'Hilton Baku', w: 13, h: 18, d: 10, glassColor: 0x1199dd },
        { name: 'Four Seasons', w: 12, h: 20, d: 11, glassColor: 0x33aadd },
        { name: 'JW Marriott', w: 10, h: 17, d: 9, glassColor: 0x0099cc },
      ];

      for (let i = 0; i < buildingDefs.length; i++) {
        const bld = buildingDefs[i];
        const t = 0.05 + (i / buildingDefs.length) * 0.9;
        const side = i % 2 === 0 ? -1 : 1;
        const dist = hw + 25 + Math.random() * 15;
        const { pos, angle } = safeOffset(t, dist, side);
        if (!isSafe(pos.x, pos.z, Math.max(bld.w, bld.d) / 2 + 2)) continue;

        // Building body
        const bodyGeo = new THREE.BoxGeometry(bld.w, bld.h, bld.d);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x334455,
          roughness: 0.2,
          metalness: 0.7
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(pos.x, pos.y + bld.h / 2, pos.z);
        body.rotation.y = angle;
        body.castShadow = true;
        body.receiveShadow = true;
        track._add(body);

        // Glass facade panels
        const glassMat = new THREE.MeshStandardMaterial({
          color: bld.glassColor,
          emissive: bld.glassColor,
          emissiveIntensity: 0.3,
          roughness: 0.1,
          metalness: 0.8
        });
        const panelGeo = new THREE.PlaneGeometry(bld.w * 0.85, bld.h * 0.85);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const faceX = sinA, faceZ = cosA;
        const frontPanel = new THREE.Mesh(panelGeo, glassMat);
        frontPanel.position.set(
          pos.x + faceX * (bld.d / 2 + 0.05),
          pos.y + bld.h / 2,
          pos.z + faceZ * (bld.d / 2 + 0.05)
        );
        frontPanel.rotation.y = angle;
        track._add(frontPanel);

        const backPanel = new THREE.Mesh(panelGeo, glassMat);
        backPanel.position.set(
          pos.x - faceX * (bld.d / 2 + 0.05),
          pos.y + bld.h / 2,
          pos.z - faceZ * (bld.d / 2 + 0.05)
        );
        backPanel.rotation.y = angle + Math.PI;
        track._add(backPanel);

        // Crown accent on top
        const crownGeo = new THREE.BoxGeometry(bld.w + 0.5, 1.0, bld.d + 0.5);
        const crownMat = new THREE.MeshStandardMaterial({
          color: 0x00ccdd,
          emissive: 0x00aacc,
          emissiveIntensity: 0.3,
          roughness: 0.2,
          metalness: 0.6
        });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(pos.x, pos.y + bld.h + 0.5, pos.z);
        crown.rotation.y = angle;
        track._add(crown);

        // Lit windows
        const windowMat = new THREE.MeshStandardMaterial({
          color: 0xffeeaa,
          emissive: 0xffeeaa,
          emissiveIntensity: 0.5,
          roughness: 0.2
        });
        const winGeo = new THREE.PlaneGeometry(0.8, 0.6);
        const floors = Math.floor(bld.h / 3);
        const winCols = Math.floor(bld.w / 2.2);
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < winCols; c++) {
            if (Math.random() > 0.7) continue;
            const win = new THREE.Mesh(winGeo, windowMat);
            const localX = (c - winCols / 2 + 0.5) * 2.2;
            win.position.set(
              pos.x + localX * cosA + faceX * (bld.d / 2 + 0.05),
              pos.y + 2 + f * 3,
              pos.z - localX * sinA + faceZ * (bld.d / 2 + 0.05)
            );
            win.rotation.y = angle;
            track._add(win);
          }
        }
      }
    }

    // ============================================================
    // 4. GRANDSTANDS - Along the main straight and key corners
    // ============================================================
    {
      // Main straight grandstand
      placeStand(0.05, hw + 8, 1, 20, 6, 8, 0x222222, 0xcccccc);
      placeStand(0.10, hw + 8, -1, 18, 5, 7, 0x222222, 0xcccccc);
      // Near castle section
      placeStand(0.32, hw + 8, 1, 16, 5, 7, 0x1a3a6a, 0xdddddd);
      placeStand(0.44, hw + 8, -1, 14, 4, 6, 0x1a3a6a, 0xdddddd);
      // End of long straight
      placeStand(0.70, hw + 8, 1, 22, 7, 9, 0x222222, 0xcccccc);
      placeStand(0.75, hw + 8, -1, 20, 6, 8, 0x222222, 0xcccccc);
      // Final sector
      placeStand(0.88, hw + 8, 1, 16, 5, 7, 0x1a3a6a, 0xdddddd);
      placeStand(0.93, hw + 8, -1, 14, 4, 6, 0x1a3a6a, 0xdddddd);
    }

    // ============================================================
    // 5. SPONSOR BOARDS - Azerbaijan GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'BAKU GP', bg: '#0055aa', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'ARAZ', bg: '#cc0000', fg: '#ffffff' },
        { name: 'SOCAR', bg: '#003388', fg: '#ffffff' },
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
    // 6. STREET LAMPS - Along the circuit edges (street circuit feel)
    // ============================================================
    {
      const lampCount = 16;
      for (let i = 0; i < lampCount; i++) {
        const t = (i + 0.5) / lampCount;
        const side = i % 2 === 0 ? 1 : -1;
        const { pos, angle } = safeOffset(t, hw + 5, side);
        if (!isSafe(pos.x, pos.z, 2)) continue;

        // Lamp pole
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 7, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 3.5, pos.z);
        track._add(pole);

        // Lamp head
        const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xffffee,
          emissive: 0xffffcc,
          emissiveIntensity: 0.8,
          roughness: 0.1
        });
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(pos.x, pos.y + 7.2, pos.z);
        track._add(lamp);

        // Arm extending toward track
        const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 4);
        const arm = new THREE.Mesh(armGeo, poleMat);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        arm.position.set(
          pos.x - cosA * 1.0 * side,
          pos.y + 7,
          pos.z + sinA * 1.0 * side
        );
        arm.rotation.z = Math.PI / 2 * side;
        arm.rotation.y = angle;
        track._add(arm);
      }
    }

    // ============================================================
    // 7. AZERBAIJANI FLAG POLES - National pride decorations
    // ============================================================
    {
      const flagPoles = [
        { t: 0.02, dist: 15, side: 1 },
        { t: 0.12, dist: 16, side: -1 },
        { t: 0.55, dist: 15, side: 1 },
        { t: 0.85, dist: 16, side: -1 },
        { t: 0.95, dist: 14, side: 1 },
      ];

      // Azerbaijan flag colors: blue, red, green
      const flagColors = [0x00b5e2, 0xed2939, 0x3f9c35];

      for (const fp of flagPoles) {
        const { pos, angle } = safeOffset(fp.t, fp.dist, fp.side);
        if (!isSafe(pos.x, pos.z, 2)) continue;

        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 10, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.7 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 5, pos.z);
        track._add(pole);

        // Flag (three horizontal stripes)
        const stripeH = 0.5;
        const flagW = 3;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        for (let s = 0; s < 3; s++) {
          const flagGeo = new THREE.PlaneGeometry(flagW, stripeH);
          const flagMat = new THREE.MeshStandardMaterial({
            color: flagColors[s],
            roughness: 0.6,
            side: THREE.DoubleSide
          });
          const flag = new THREE.Mesh(flagGeo, flagMat);
          flag.position.set(
            pos.x + cosA * flagW / 2,
            pos.y + 9.5 - s * stripeH,
            pos.z - sinA * flagW / 2
          );
          flag.rotation.y = angle;
          track._add(flag);
        }

        // Ball on top of pole
        const ballGeo = new THREE.SphereGeometry(0.2, 6, 6);
        const ballMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
        const ball = new THREE.Mesh(ballGeo, ballMat);
        ball.position.set(pos.x, pos.y + 10.2, pos.z);
        track._add(ball);
      }
    }

    // ============================================================
    // 8. WATERFRONT BARRIERS - Caspian Sea promenade barriers
    // ============================================================
    {
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0x778899, roughness: 0.5, metalness: 0.4 });
      for (let i = 0; i < 12; i++) {
        const t = (i + 0.5) / 12;
        const side = i % 2 === 0 ? 1 : -1;
        const { pos, angle } = safeOffset(t, hw + 3, side);
        if (!isSafe(pos.x, pos.z, 1)) continue;

        const barrierGeo = new THREE.BoxGeometry(6, 1.2, 0.5);
        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(pos.x, pos.y + 0.6, pos.z);
        barrier.rotation.y = angle;
        barrier.castShadow = true;
        track._add(barrier);
      }
    }
}
