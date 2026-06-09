import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Vegas Circuit scenery builder
 */
export function buildVegasScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. CASINO HOTEL BUILDINGS - Iconic Vegas skyline structures
    // ============================================================
    {
      const casinoDefs = [
        { name: 'Bellagio', bodyColor: 0x1a1a2e, accentColor: 0xc9a84c, w: 14, h: 22, d: 10 },
        { name: 'MGM Grand', bodyColor: 0x0a3a0a, accentColor: 0xcccc00, w: 16, h: 20, d: 12 },
        { name: 'Venetian', bodyColor: 0x2e1a1a, accentColor: 0xe8d5b5, w: 12, h: 18, d: 10 },
        { name: 'Caesars Palace', bodyColor: 0xf5f5f0, accentColor: 0xc9a84c, w: 15, h: 16, d: 11 },
        { name: 'Wynn', bodyColor: 0x4a0e0e, accentColor: 0xddaa44, w: 13, h: 24, d: 10 },
        { name: 'Luxor', bodyColor: 0x111111, accentColor: 0x00ccff, w: 12, h: 20, d: 12, isPyramid: true },
        { name: 'Excalibur', bodyColor: 0xcc3333, accentColor: 0x3366cc, w: 14, h: 15, d: 12 },
        { name: 'New York-New York', bodyColor: 0x3a3a4a, accentColor: 0xdddddd, w: 13, h: 19, d: 10 },
      ];

      for (let i = 0; i < casinoDefs.length; i++) {
        const casino = casinoDefs[i];
        const t = 0.05 + (i / casinoDefs.length) * 0.9;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 25 + Math.random() * 15;
        const { pos, angle } = safeOffset(t, dist, side);
        if (!isSafe(pos.x, pos.z, Math.max(casino.w, casino.d) / 2)) continue;

        let building;
        if (casino.isPyramid) {
          // Luxor-style pyramid
          const geo = new THREE.ConeGeometry(Math.max(casino.w, casino.d) / 2, casino.h, 4);
          const mat = new THREE.MeshStandardMaterial({ color: casino.bodyColor, roughness: 0.2, metalness: 0.8 });
          building = new THREE.Mesh(geo, mat);
          building.position.set(pos.x, pos.y + casino.h / 2, pos.z);
          building.rotation.y = Math.PI / 4;
        } else {
          // Standard hotel tower
          const bodyGeo = new THREE.BoxGeometry(casino.w, casino.h, casino.d);
          const bodyMat = new THREE.MeshStandardMaterial({ color: casino.bodyColor, roughness: 0.3, metalness: 0.5 });
          building = new THREE.Mesh(bodyGeo, bodyMat);
          building.position.set(pos.x, pos.y + casino.h / 2, pos.z);
        }
        building.rotation.y = angle;
        building.castShadow = true;
        building.receiveShadow = true;
        track._add(building);

        // Accent crown/strip on top
        if (!casino.isPyramid) {
          const crownGeo = new THREE.BoxGeometry(casino.w + 0.5, 1.5, casino.d + 0.5);
          const crownMat = new THREE.MeshStandardMaterial({
            color: casino.accentColor,
            emissive: casino.accentColor,
            emissiveIntensity: 0.4,
            roughness: 0.2,
            metalness: 0.6
          });
          const crown = new THREE.Mesh(crownGeo, crownMat);
          crown.position.set(pos.x, pos.y + casino.h + 0.75, pos.z);
          crown.rotation.y = angle;
          track._add(crown);
        }

        // Casino name sign with neon glow
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#000000';
        signCtx.fillRect(0, 0, 256, 64);
        const neonR = (casino.accentColor >> 16) & 0xff;
        const neonG = (casino.accentColor >> 8) & 0xff;
        const neonB = casino.accentColor & 0xff;
        const neonHex = `rgb(${neonR},${neonG},${neonB})`;
        signCtx.strokeStyle = neonHex;
        signCtx.lineWidth = 4;
        signCtx.strokeRect(4, 4, 248, 56);
        signCtx.fillStyle = neonHex;
        signCtx.font = 'bold 32px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText(casino.name.toUpperCase(), 128, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(casino.w * 0.8, casino.w * 0.2);
        const signMat = new THREE.MeshStandardMaterial({
          map: signTex,
          emissive: casino.accentColor,
          emissiveIntensity: 0.8,
          roughness: 0.1
        });
        const sign = new THREE.Mesh(signGeo, signMat);
        const faceDir = new THREE.Vector3(
          Math.sin(angle), 0, Math.cos(angle)
        ).multiplyScalar(side > 0 ? -1 : 1);
        sign.position.set(
          pos.x + faceDir.x * (casino.w / 2 + 0.1),
          pos.y + casino.h * 0.7,
          pos.z + faceDir.z * (casino.d / 2 + 0.1)
        );
        sign.rotation.y = angle;
        track._add(sign);

        // Window rows - emissive lit windows for night effect
        const windowMat = new THREE.MeshStandardMaterial({
          color: 0xffeeaa,
          emissive: 0xffeeaa,
          emissiveIntensity: 0.6,
          roughness: 0.2
        });
        const winGeo = new THREE.PlaneGeometry(1.0, 0.7);
        if (!casino.isPyramid) {
          const floors = Math.floor(casino.h / 3);
          const winCols = Math.floor(casino.w / 2.5);
          for (let f = 0; f < floors; f++) {
            for (let c = 0; c < winCols; c++) {
              if (Math.random() > 0.7) continue;
              const win = new THREE.Mesh(winGeo, windowMat);
              const cosA = Math.cos(angle), sinA = Math.sin(angle);
              const localX = (c - winCols / 2 + 0.5) * 2.5;
              win.position.set(
                pos.x + localX * cosA + faceDir.x * (casino.d / 2 + 0.05),
                pos.y + 2 + f * 3,
                pos.z - localX * sinA + faceDir.z * (casino.d / 2 + 0.05)
              );
              win.rotation.y = angle;
              track._add(win);
            }
          }
        }
      }
    }

    // ============================================================
    // 2. NEON SIGN ARCS / GATEWAY STRUCTURES - Vegas Strip arches
    // ============================================================
    {
      const archCount = 6;
      const neonPalette = [0xff0066, 0x00ffaa, 0xffaa00, 0xff00ff, 0x00aaff, 0xffff00];

      for (let i = 0; i < archCount; i++) {
        const t = (i + 0.5) / archCount;
        const { pos, angle } = safeOffset(t, hw + 6, 1);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const archSpan = (track._trackWidth || CONFIG.trackWidth) + 10;
        const archH = 8;
        const color = neonPalette[i % neonPalette.length];

        const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, archH, 8);
        const pillarMat = new THREE.MeshStandardMaterial({
          color: 0x333333, roughness: 0.3, metalness: 0.7
        });
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const perpX = -sinA, perpZ = cosA;

        const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
        leftPillar.position.set(
          pos.x - perpX * archSpan / 2,
          pos.y + archH / 2,
          pos.z - perpZ * archSpan / 2
        );
        track._add(leftPillar);

        const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
        rightPillar.position.set(
          pos.x + perpX * archSpan / 2,
          pos.y + archH / 2,
          pos.z + perpZ * archSpan / 2
        );
        track._add(rightPillar);

        // Cross beam with neon
        const beamGeo = new THREE.BoxGeometry(archSpan, 0.5, 0.5);
        const beamMat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1.0,
          roughness: 0.1,
          metalness: 0.3
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(pos.x, pos.y + archH, pos.z);
        beam.rotation.y = angle;
        track._add(beam);

        // Hanging neon decorative elements
        const decoCount = 4;
        for (let d = 0; d < decoCount; d++) {
          const frac = (d + 1) / (decoCount + 1);
          const decoGeo = new THREE.SphereGeometry(0.25, 8, 8);
          const decoMat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 1.2,
            roughness: 0.1
          });
          const deco = new THREE.Mesh(decoGeo, decoMat);
          deco.position.set(
            pos.x + (frac - 0.5) * archSpan * perpX,
            pos.y + archH - 0.8,
            pos.z + (frac - 0.5) * archSpan * perpZ
          );
          track._add(deco);
        }
      }
    }

    // ============================================================
    // 3. STREET LAMPS - Warm night-time road lighting
    // ============================================================
    {
      const lampCount = 30;
      for (let i = 0; i < lampCount; i++) {
        const t = (i + 0.5) / lampCount;
        const side = i % 2 === 0 ? 1 : -1;
        const { pos, angle } = safeOffset(t, hw + 3, side);
        if (!isSafe(pos.x, pos.z, 1)) continue;

        // Lamp pole
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 2.5, pos.z);
        track._add(pole);

        // Arm extending toward road
        const armLen = 2;
        const armGeo = new THREE.CylinderGeometry(0.05, 0.05, armLen, 4);
        const arm = new THREE.Mesh(armGeo, poleMat);
        const armDirX = -Math.sin(angle) * side * -1;
        const armDirZ = Math.cos(angle) * side * -1;
        arm.position.set(
          pos.x + armDirX * armLen / 2,
          pos.y + 5,
          pos.z + armDirZ * armLen / 2
        );
        arm.rotation.z = Math.PI / 2 * (side > 0 ? -1 : 1);
        arm.rotation.y = angle;
        track._add(arm);

        // Warm light bulb
        const bulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const bulbMat = new THREE.MeshStandardMaterial({
          color: 0xffddaa,
          emissive: 0xffcc88,
          emissiveIntensity: 1.5,
          roughness: 0.1
        });
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(
          pos.x + armDirX * armLen,
          pos.y + 4.8,
          pos.z + armDirZ * armLen
        );
        track._add(bulb);
      }
    }

    // ============================================================
    // 4. GRANDSTANDS - Spectator seating with colored seats
    // ============================================================
    {
      const standDefs = [
        { t: 0.05, dist: 18, side: -1, w: 30, h: 8, d: 8 },
        { t: 0.25, dist: 20, side: 1, w: 25, h: 6, d: 7 },
        { t: 0.45, dist: 18, side: -1, w: 28, h: 7, d: 8 },
        { t: 0.65, dist: 20, side: 1, w: 22, h: 6, d: 7 },
        { t: 0.85, dist: 18, side: -1, w: 26, h: 7, d: 8 },
      ];

      const seatColors = [0xff4444, 0xffaa00, 0xff00ff, 0x00ccff, 0xffff00];

      for (const sd of standDefs) {
        const { pos, angle } = safeOffset(sd.t, hw + sd.dist, sd.side);
        if (!isSafe(pos.x, pos.z, sd.w / 2)) continue;

        // Stand body
        const standGeo = new THREE.BoxGeometry(sd.w, sd.h, sd.d);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.6, metalness: 0.3 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(pos.x, pos.y + sd.h / 2, pos.z);
        stand.rotation.y = angle;
        stand.castShadow = true;
        stand.receiveShadow = true;
        track._add(stand);

        // Neon-lit roof edge
        const roofGeo = new THREE.BoxGeometry(sd.w + 2, 0.3, sd.d + 2);
        const roofColor = seatColors[Math.floor(Math.random() * seatColors.length)];
        const roofMat = new THREE.MeshStandardMaterial({
          color: roofColor,
          emissive: roofColor,
          emissiveIntensity: 0.5,
          roughness: 0.2,
          metalness: 0.4
        });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + sd.h + 0.15, pos.z);
        roof.rotation.y = angle;
        track._add(roof);

        // Seats
        const rows = 3;
        const cols = Math.floor(sd.w / 2);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.5, 0.6, 0.5);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[(r + c) % seatColors.length] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - cols / 2 + 0.5) * 1.8;
            const localZ = (r - 1) * (sd.d / 2.5);
            seat.position.set(
              pos.x + localX * cosA + localZ * sinA,
              pos.y + 0.5 + r * 1.0,
              pos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = angle;
            track._add(seat);
          }
        }
      }
    }

    // ============================================================
    // 5. SPONSOR BILLBOARDS - Neon-lit advertising boards
    // ============================================================
    {
      const sponsors = [
        { name: 'LAS VEGAS GP', bg: '#000000', fg: '#ff0066', neon: 0xff0066 },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060', neon: 0xc0a060 },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff', neon: 0x00ff00 },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff', neon: 0x00d4ff },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000', neon: 0xffcc00 },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff', neon: 0xff3333 },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900', neon: 0xff9900 },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff', neon: 0x0088ff },
        { name: 'F1', bg: '#e10600', fg: '#ffffff', neon: 0xe10600 },
        { name: 'LAS VEGAS', bg: '#1a0033', fg: '#ff00ff', neon: 0xff00ff },
      ];

      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const { pos, angle } = safeOffset(t, dist, side);
        if (!isSafe(pos.x, pos.z, 4)) continue;

        const sponsor = sponsors[i % sponsors.length];

        // Support posts
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 });
        for (let ps = -1; ps <= 1; ps += 2) {
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(
            pos.x + ps * 2.5 * cosA,
            pos.y + 1.5,
            pos.z - ps * 2.5 * sinA
          );
          track._add(post);
        }

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
        const boardMat = new THREE.MeshStandardMaterial({
          map: tex,
          emissive: sponsor.neon,
          emissiveIntensity: 0.3,
          roughness: 0.2
        });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.set(pos.x, pos.y + 4.5, pos.z);
        board.rotation.y = angle;
        board.castShadow = true;
        track._add(board);

        // Neon frame glow around the board
        const frameGeo = new THREE.BoxGeometry(6.4, 3.4, 0.1);
        const frameMat = new THREE.MeshStandardMaterial({
          color: sponsor.neon,
          emissive: sponsor.neon,
          emissiveIntensity: 1.0,
          roughness: 0.1,
          transparent: true,
          opacity: 0.3
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(pos.x, pos.y + 4.5, pos.z);
        frame.rotation.y = angle;
        track._add(frame);
      }
    }

    // ============================================================
    // 6. TIRE WALLS - Safety barriers at corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const tirePositions = [
        { t: 0.10, side: -1 },
        { t: 0.22, side: 1 },
        { t: 0.38, side: -1 },
        { t: 0.52, side: 1 },
        { t: 0.68, side: -1 },
        { t: 0.82, side: 1 },
        { t: 0.95, side: -1 },
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
    // 7. NEON GROUND STRIPS - Road-edge accent lighting
    // ============================================================
    {
      const stripCount = 40;
      const stripColors = [0xff0066, 0x00ccff, 0xff00ff, 0x00ffaa];
      const stripGeo = new THREE.BoxGeometry(0.15, 0.08, 2);

      for (let i = 0; i < stripCount; i++) {
        const t = (i + 0.5) / stripCount;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 1.5;
        const color = stripColors[i % stripColors.length];

        const stripMat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1.0,
          roughness: 0.1
        });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.set(
          p.x + right.x * dist * side,
          p.y + 0.06,
          p.z + right.z * dist * side
        );
        strip.rotation.y = Math.atan2(tangent.x, tangent.z);
        track._add(strip);
      }
    }
}
