import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * MarinaBay Circuit scenery builder
 */
export function buildMarinaBayScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. CITY SKYLINE BUILDINGS - Dense urban backdrop
    // ============================================================
    {
      const buildingConfigs = [
        { t: 0.08, side: -1, dist: 55, w: 8, h: 30, d: 8, color: 0x3a3a4a },
        { t: 0.08, side: -1, dist: 65, w: 6, h: 42, d: 6, color: 0x444455 },
        { t: 0.08, side: -1, dist: 72, w: 10, h: 25, d: 10, color: 0x333344 },
        { t: 0.15, side: -1, dist: 50, w: 7, h: 35, d: 7, color: 0x3a3a50 },
        { t: 0.15, side: -1, dist: 60, w: 5, h: 45, d: 5, color: 0x4a4a5a },
        { t: 0.15, side: -1, dist: 68, w: 9, h: 28, d: 9, color: 0x383848 },
        { t: 0.30, side: 1, dist: 45, w: 12, h: 20, d: 10, color: 0x3e3e4e },
        { t: 0.30, side: 1, dist: 58, w: 8, h: 38, d: 8, color: 0x454555 },
        { t: 0.35, side: -1, dist: 50, w: 7, h: 32, d: 7, color: 0x3c3c4c },
        { t: 0.35, side: -1, dist: 62, w: 11, h: 22, d: 8, color: 0x424252 },
        { t: 0.50, side: 1, dist: 55, w: 6, h: 40, d: 6, color: 0x3a3a4e },
        { t: 0.50, side: 1, dist: 65, w: 8, h: 28, d: 8, color: 0x404050 },
        { t: 0.55, side: -1, dist: 50, w: 10, h: 24, d: 10, color: 0x353545 },
        { t: 0.55, side: -1, dist: 63, w: 5, h: 36, d: 5, color: 0x484858 },
        { t: 0.70, side: 1, dist: 48, w: 9, h: 30, d: 9, color: 0x3d3d4d },
        { t: 0.70, side: 1, dist: 60, w: 7, h: 34, d: 7, color: 0x444454 },
        { t: 0.75, side: -1, dist: 52, w: 8, h: 26, d: 8, color: 0x3b3b4b },
        { t: 0.75, side: -1, dist: 64, w: 6, h: 38, d: 6, color: 0x464656 },
        { t: 0.90, side: 1, dist: 50, w: 10, h: 32, d: 10, color: 0x3f3f4f },
        { t: 0.90, side: 1, dist: 62, w: 7, h: 28, d: 7, color: 0x434353 },
        { t: 0.92, side: -1, dist: 48, w: 8, h: 22, d: 8, color: 0x373747 },
        { t: 0.92, side: -1, dist: 58, w: 6, h: 40, d: 6, color: 0x4c4c5c },
      ];

      const winGeo = new THREE.PlaneGeometry(0.8, 0.6);
      const windowLitMat = new THREE.MeshStandardMaterial({
        color: 0xffeeaa, emissive: 0xffeeaa, emissiveIntensity: 0.6, roughness: 0.3
      });

      for (const bc of buildingConfigs) {
        const { pos, angle } = safeOffset(bc.t, bc.dist, bc.side);
        if (!isSafe(pos.x, pos.z, Math.max(bc.w, bc.d) / 2)) continue;

        const geo = new THREE.BoxGeometry(bc.w, bc.h, bc.d);
        const mat = new THREE.MeshStandardMaterial({ color: bc.color, roughness: 0.7, metalness: 0.2 });
        const building = new THREE.Mesh(geo, mat);
        building.position.set(pos.x, pos.y + bc.h / 2, pos.z);
        building.castShadow = true;
        building.receiveShadow = true;
        track._add(building);

        // Illuminated windows for night cityscape
        const floors = Math.floor(bc.h / 3);
        const winCols = Math.floor(bc.w / 2.2);
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < winCols; c++) {
            if (Math.random() > 0.55) continue;
            const win = new THREE.Mesh(winGeo, windowLitMat);
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            const localX = (c - winCols / 2 + 0.5) * 2.2;
            win.position.set(
              pos.x + localX * cosA - (bc.d / 2 + 0.05) * sinA,
              pos.y + 2 + f * 3,
              pos.z - localX * sinA + (bc.d / 2 + 0.05) * cosA
            );
            win.rotation.y = angle;
            track._add(win);
          }
        }
      }
    }

    // ============================================================
    // 2. GARDENS BY THE BAY - Supertrees
    //    Iconic illuminated tree-like vertical gardens
    // ============================================================
    {
      const supertreePositions = [
        { t: 0.12, side: -1, dist: 35 },
        { t: 0.18, side: -1, dist: 38 },
        { t: 0.50, side: 1, dist: 36 },
        { t: 0.52, side: 1, dist: 40 },
        { t: 0.55, side: 1, dist: 34 },
        { t: 0.85, side: -1, dist: 37 },
        { t: 0.88, side: -1, dist: 40 },
        { t: 0.90, side: -1, dist: 35 },
      ];

      for (const st of supertreePositions) {
        const { pos } = safeOffset(st.t, st.dist, st.side);
        if (!isSafe(pos.x, pos.z, 6)) continue;

        const treeH = 16 + Math.random() * 10;

        // Trunk: tapered cylinder
        const trunkGeo = new THREE.CylinderGeometry(0.6, 1.2, treeH, 8);
        const trunkMat = new THREE.MeshStandardMaterial({
          color: 0x2a5a3a, roughness: 0.7, metalness: 0.3
        });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(pos.x, pos.y + treeH / 2, pos.z);
        trunk.castShadow = true;
        track._add(trunk);

        // Canopy: inverted cone at the top
        const canopyGeo = new THREE.ConeGeometry(5, 4, 8);
        const canopyMat = new THREE.MeshStandardMaterial({
          color: 0x3a8a4a, emissive: 0x22aa44, emissiveIntensity: 0.4,
          roughness: 0.6, side: THREE.DoubleSide
        });
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.set(pos.x, pos.y + treeH + 1, pos.z);
        canopy.rotation.x = Math.PI;
        track._add(canopy);

        // Illuminated ring at the canopy edge
        const ringGeo = new THREE.TorusGeometry(4.5, 0.15, 8, 24);
        const ringColor = [0x00ffaa, 0xff6600, 0x0088ff, 0xff0066, 0xaa00ff][Math.floor(Math.random() * 5)];
        const ringMat = new THREE.MeshStandardMaterial({
          color: ringColor, emissive: ringColor, emissiveIntensity: 1.0, roughness: 0.2
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(pos.x, pos.y + treeH + 1, pos.z);
        ring.rotation.x = Math.PI / 2;
        track._add(ring);

        // Vertical light strands on the trunk
        for (let s = 0; s < 4; s++) {
          const sa = (s / 4) * Math.PI * 2;
          const strandGeo = new THREE.CylinderGeometry(0.05, 0.05, treeH * 0.7, 4);
          const strandColor = [0x00ffcc, 0xff8800, 0x00aaff, 0xff44aa][s % 4];
          const strandMat = new THREE.MeshStandardMaterial({
            color: strandColor, emissive: strandColor, emissiveIntensity: 0.8
          });
          const strand = new THREE.Mesh(strandGeo, strandMat);
          strand.position.set(
            pos.x + Math.cos(sa) * 1.0,
            pos.y + treeH * 0.5,
            pos.z + Math.sin(sa) * 1.0
          );
          track._add(strand);
        }
      }
    }

    // ============================================================
    // 3. FLOODLIGHT TOWERS - Night race illumination
    //    Singapore is the original F1 night race
    // ============================================================
    {
      const lightTowerPositions = [
        { t: 0.03, side: 1 }, { t: 0.03, side: -1 },
        { t: 0.12, side: 1 }, { t: 0.12, side: -1 },
        { t: 0.22, side: 1 }, { t: 0.22, side: -1 },
        { t: 0.32, side: 1 }, { t: 0.32, side: -1 },
        { t: 0.42, side: 1 }, { t: 0.42, side: -1 },
        { t: 0.52, side: 1 }, { t: 0.52, side: -1 },
        { t: 0.62, side: 1 }, { t: 0.62, side: -1 },
        { t: 0.72, side: 1 }, { t: 0.72, side: -1 },
        { t: 0.82, side: 1 }, { t: 0.82, side: -1 },
        { t: 0.92, side: 1 }, { t: 0.92, side: -1 },
      ];

      for (const lt of lightTowerPositions) {
        const { pos, angle } = safeOffset(lt.t, hw + 12, lt.side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const towerH = 22;

        // Main tower pole (steel gray)
        const poleGeo = new THREE.CylinderGeometry(0.25, 0.4, towerH, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.4, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + towerH / 2, pos.z);
        pole.castShadow = true;
        track._add(pole);

        // Cross-arm at top
        const armGeo = new THREE.BoxGeometry(5, 0.35, 0.7);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x666677, roughness: 0.4, metalness: 0.5 });
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(pos.x, pos.y + towerH, pos.z);
        arm.rotation.y = angle;
        track._add(arm);

        // Light bank (bright white glow for night illumination)
        const lightBankGeo = new THREE.BoxGeometry(4.5, 1.2, 0.5);
        const lightBankMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.5, roughness: 0.1
        });
        const lightBank = new THREE.Mesh(lightBankGeo, lightBankMat);
        lightBank.position.set(pos.x, pos.y + towerH - 1.0, pos.z);
        lightBank.rotation.y = angle;
        track._add(lightBank);

        // Base plate
        const baseGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.5, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(pos.x, pos.y + 0.25, pos.z);
        track._add(base);
      }
    }

    // ============================================================
    // 4. MARINA BAY SANDS - Iconic 3-tower hotel with SkyPark
    //    Placed in the background as a landmark
    // ============================================================
    {
      const b = track.trackBounds;
      const mbsX = b ? (b.minX + b.maxX) / 2 + (b.maxX - b.minX) * 0.8 : 180;
      const mbsZ = b ? (b.minZ + b.maxZ) / 2 - (b.maxZ - b.minZ) * 0.6 : -80;
      if (track.distToTrack(mbsX, mbsZ) >= hw + 30) {
        const towerH = 35;
        const towerW = 6;
        const towerD = 8;
        const gap = 12;

        // Three towers
        for (let i = 0; i < 3; i++) {
          const tx = mbsX + (i - 1) * gap;
          const towerGeo = new THREE.BoxGeometry(towerW, towerH, towerD);
          const towerMat = new THREE.MeshStandardMaterial({
            color: 0x555566, roughness: 0.5, metalness: 0.4
          });
          const tower = new THREE.Mesh(towerGeo, towerMat);
          tower.position.set(tx, towerH / 2 - 2, mbsZ);
          tower.castShadow = true;
          track._add(tower);

          // Lit windows
          const winGeo = new THREE.PlaneGeometry(0.8, 0.6);
          const winMat = new THREE.MeshStandardMaterial({
            color: 0xffeeaa, emissive: 0xffeeaa, emissiveIntensity: 0.5
          });
          for (let f = 0; f < 10; f++) {
            for (let c = 0; c < 3; c++) {
              if (Math.random() > 0.5) continue;
              const win = new THREE.Mesh(winGeo, winMat);
              win.position.set(
                tx - towerW / 2 + 1 + c * 2,
                2 + f * 3,
                mbsZ + towerD / 2 + 0.05
              );
              track._add(win);
            }
          }
        }

        // SkyPark boat on top (curved platform spanning all 3 towers)
        const skyParkGeo = new THREE.BoxGeometry(gap * 2 + towerW + 8, 1.5, 5);
        const skyParkMat = new THREE.MeshStandardMaterial({
          color: 0x888899, roughness: 0.4, metalness: 0.5
        });
        const skyPark = new THREE.Mesh(skyParkGeo, skyParkMat);
        skyPark.position.set(mbsX, towerH - 1.5, mbsZ);
        skyPark.castShadow = true;
        track._add(skyPark);

        // SkyPark underside edge lighting (blue accent)
        const edgeGeo = new THREE.BoxGeometry(gap * 2 + towerW + 8, 0.3, 5.2);
        const edgeMat = new THREE.MeshStandardMaterial({
          color: 0x00aaff, emissive: 0x0088ff, emissiveIntensity: 0.6
        });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(mbsX, towerH - 2.4, mbsZ);
        track._add(edge);
      }
    }

    // ============================================================
    // 5. SINGAPORE FLYER - Giant observation wheel (landmark)
    // ============================================================
    {
      const b = track.trackBounds;
      const flyerX = b ? (b.minX + b.maxX) / 2 - (b.maxX - b.minX) * 0.7 : -120;
      const flyerZ = b ? (b.minZ + b.maxZ) / 2 + (b.maxZ - b.minZ) * 0.5 : 60;
      if (track.distToTrack(flyerX, flyerZ) >= hw + 25) {
        const wheelR = 12;
        const wheelGeo = new THREE.TorusGeometry(wheelR, 0.3, 8, 48);
        const wheelMat = new THREE.MeshStandardMaterial({
          color: 0xaaaaaa, roughness: 0.4, metalness: 0.6
        });
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(flyerX, wheelR + 5, flyerZ);
        track._add(wheel);

        // Spokes
        for (let s = 0; s < 12; s++) {
          const sa = (s / 12) * Math.PI * 2;
          const spokeGeo = new THREE.CylinderGeometry(0.08, 0.08, wheelR * 2, 4);
          const spokeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
          const spoke = new THREE.Mesh(spokeGeo, spokeMat);
          spoke.position.set(flyerX, wheelR + 5, flyerZ);
          spoke.rotation.z = sa;
          track._add(spoke);
        }

        // Capsule lights on the wheel rim
        for (let c = 0; c < 16; c++) {
          const ca = (c / 16) * Math.PI * 2;
          const capsuleGeo = new THREE.SphereGeometry(0.5, 6, 6);
          const capsuleMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xccddff, emissiveIntensity: 0.8
          });
          const capsule = new THREE.Mesh(capsuleGeo, capsuleMat);
          capsule.position.set(
            flyerX + Math.cos(ca) * wheelR,
            wheelR + 5 + Math.sin(ca) * wheelR,
            flyerZ
          );
          track._add(capsule);
        }

        // Support structure (two A-frame legs)
        for (let leg = -1; leg <= 1; leg += 2) {
          const legGeo = new THREE.CylinderGeometry(0.4, 0.6, 20, 6);
          const legMat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.5, metalness: 0.5 });
          const legMesh = new THREE.Mesh(legGeo, legMat);
          legMesh.position.set(flyerX + leg * 3, 8, flyerZ);
          legMesh.rotation.z = leg * 0.15;
          legMesh.castShadow = true;
          track._add(legMesh);
        }
      }
    }

    // ============================================================
    // 6. GRANDSTANDS - Main pit building and corner stands
    // ============================================================
    {
      // Main grandstand near start/finish
      placeStand(0.02, hw + 20, 1, 45, 8, 10, 0x2a2a3a, 0x1a1a2a);

      // Pit building - opposite side
      const { pos: pitPos, angle: pitAngle } = safeOffset(0.06, hw + 18, -1);
      if (isSafe(pitPos.x, pitPos.z, 6)) {
        const pitW = 40, pitH = 5, pitD = 8;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pitPos.x, pitPos.y + pitH / 2, pitPos.z);
        pit.rotation.y = pitAngle;
        pit.castShadow = true;
        track._add(pit);

        // Garage doors (Singapore red accents)
        const garageColors = [0xcc0000, 0x222233, 0xcc0000, 0x222233, 0xcc0000];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(pitAngle), sinA = Math.sin(pitAngle);
          const localX = (i - 4.5) * 3.8;
          g.position.set(
            pitPos.x + localX * cosA - (pitD / 2) * sinA,
            pitPos.y + 1,
            pitPos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = pitAngle;
          track._add(g);
        }

        // MARINA BAY sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc0000';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('MARINA BAY STREET CIRCUIT', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(18, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pitPos.x, pitPos.y + pitH + 1.5, pitPos.z);
        sign.rotation.y = pitAngle;
        track._add(sign);
      }

      // Corner grandstands
      placeStand(0.22, hw + 20, -1, 28, 7, 8, 0x2a3040, 0x1a2030);
      placeStand(0.38, hw + 18, 1, 22, 5, 6, 0x333848, 0x222838);
      placeStand(0.55, hw + 20, -1, 25, 6, 7, 0x2a3040, 0x1a2030);
      placeStand(0.72, hw + 18, 1, 20, 5, 6, 0x333848, 0x222838);
      placeStand(0.88, hw + 20, -1, 30, 7, 8, 0x2a3040, 0x1a2030);
    }

    // ============================================================
    // 7. SPONSOR BOARDS - Singapore GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'SINGAPORE GP', bg: '#cc0000', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'SHELL', bg: '#dd0000', fg: '#ffdd00' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'MARINA BAY', bg: '#0a0a1a', fg: '#ff4466' },
        { name: 'Singapore', bg: '#cc0000', fg: '#ffffff' },
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
    // 8. NIGHT LIGHT STRIPS - Track edge ambient lighting
    //    Singapore is famous for its lighting system
    // ============================================================
    {
      const stripGeo = new THREE.BoxGeometry(0.3, 0.15, 2);
      const stripColors = [0x00aaff, 0xff4466, 0x00ffaa, 0xffaa00];

      for (let i = 0; i < 60; i++) {
        const t = i / 60;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const color = stripColors[i % stripColors.length];

        for (let side of [-1, 1]) {
          const dist = hw + 2.5;
          const sx = p.x + right.x * dist * side;
          const sz = p.z + right.z * dist * side;

          if (track.distToTrack(sx, sz) < hw + 1) continue;

          const stripMat = new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: 0.8, roughness: 0.3
          });
          const strip = new THREE.Mesh(stripGeo, stripMat);
          strip.position.set(sx, p.y + 0.1, sz);
          strip.rotation.y = Math.atan2(tangent.x, tangent.z);
          track._add(strip);
        }
      }
    }

    // ============================================================
    // 9. TIRE WALLS - Key corner protection
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.10, side: -1 },
        { t: 0.18, side: 1 },
        { t: 0.30, side: -1 },
        { t: 0.42, side: 1 },
        { t: 0.55, side: -1 },
        { t: 0.68, side: 1 },
        { t: 0.80, side: -1 },
        { t: 0.92, side: 1 },
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
