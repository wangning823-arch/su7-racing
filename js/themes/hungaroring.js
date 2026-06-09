import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Hungaroring Circuit scenery builder
 */
export function buildHungaroringScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. ROLLING GREEN HILLS - valley terrain surrounding the track
    //    The Hungaroring is set in a natural valley east of Budapest
    // ============================================================
    {
      const hillMat1 = new THREE.MeshStandardMaterial({ color: 0x4a7a2a, roughness: 0.95 });
      const hillMat2 = new THREE.MeshStandardMaterial({ color: 0x3a6a22, roughness: 0.95 });
      const hillMat3 = new THREE.MeshStandardMaterial({ color: 0x5a8a32, roughness: 0.95 });

      // Large surrounding hills forming the valley
      const hills = [
        { x: 350, z: -300, scale: 1.3, h: 45, mat: hillMat1 },
        { x: -280, z: -350, scale: 1.1, h: 38, mat: hillMat2 },
        { x: -450, z: -150, scale: 1.5, h: 55, mat: hillMat1 },
        { x: 400, z: 100, scale: 1.0, h: 35, mat: hillMat3 },
        { x: -350, z: 300, scale: 1.4, h: 50, mat: hillMat2 },
        { x: 200, z: 400, scale: 1.2, h: 42, mat: hillMat1 },
        { x: -100, z: -450, scale: 1.6, h: 60, mat: hillMat2 },
        { x: 500, z: -250, scale: 1.1, h: 40, mat: hillMat3 },
      ];

      for (const m of hills) {
        const geo = new THREE.SphereGeometry(50 * m.scale, 10, 8);
        const hill = new THREE.Mesh(geo, m.mat);
        hill.position.set(m.x, -8, m.z);
        hill.scale.set(1.8, 0.4, 1.5);
        hill.castShadow = true;
        track._add(hill);
      }

      // Smaller rolling bumps closer to the track
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2 + 0.5;
        const r = 120 + Math.random() * 100;
        const hx = Math.cos(angle) * r;
        const hz = Math.sin(angle) * r;
        if (track.distToTrack(hx, hz) < 35) continue;

        const geo = new THREE.SphereGeometry(18 + Math.random() * 15, 8, 6);
        const mat = [hillMat1, hillMat2, hillMat3][i % 3];
        const bump = new THREE.Mesh(geo, mat);
        bump.position.set(hx, -6, hz);
        bump.scale.set(1.5, 0.35, 1.2);
        track._add(bump);
      }
    }

    // ============================================================
    // 2. HILLSIDE GRANDSTANDS - terraced into the terrain
    //    The Hungaroring is famous for grandstands built into hillsides
    // ============================================================
    {
      const standPositions = [
        { t: 0.05, dist: 28, side: 1, w: 24, h: 7, d: 8 },
        { t: 0.15, dist: 26, side: -1, w: 20, h: 6, d: 7 },
        { t: 0.30, dist: 30, side: 1, w: 28, h: 9, d: 10 },
        { t: 0.45, dist: 25, side: -1, w: 22, h: 7, d: 8 },
        { t: 0.60, dist: 27, side: 1, w: 26, h: 8, d: 9 },
        { t: 0.75, dist: 24, side: -1, w: 20, h: 6, d: 7 },
        { t: 0.88, dist: 29, side: 1, w: 30, h: 10, d: 10 },
        { t: 0.95, dist: 26, side: -1, w: 22, h: 7, d: 8 },
      ];

      // Seat colors - Hungarian flag: red, white, green
      const seatRowColors = [0xcc2222, 0xeeeeee, 0x228833];

      for (const s of standPositions) {
        const { pos, angle } = safeOffset(s.t, s.dist, s.side);
        if (!isSafe(pos.x, pos.z, s.w / 2 + 2)) continue;

        // Main stand structure
        const standGeo = new THREE.BoxGeometry(s.w, s.h, s.d);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(pos.x, pos.y + s.h / 2 - 2, pos.z);
        stand.rotation.y = angle;
        stand.castShadow = true;
        stand.receiveShadow = true;
        track._add(stand);

        // Colored seating rows (terrace style)
        const rows = Math.floor(s.h / 2.5);
        const cols = Math.floor(s.w / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.5, 0.6, 0.5);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatRowColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - cols / 2 + 0.5) * 1.8;
            const localZ = (r - rows / 2 + 0.5) * (s.d / (rows + 1));
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            seat.position.set(
              pos.x + localX * cosA + localZ * sinA,
              pos.y + 0.3 + r * 2.2 - 1.5,
              pos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = angle;
            track._add(seat);
          }
        }

        // Canopy roof
        const roofGeo = new THREE.BoxGeometry(s.w + 2, 0.35, s.d + 1.5);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + s.h + 0.2, pos.z);
        roof.rotation.y = angle;
        roof.castShadow = true;
        track._add(roof);
      }
    }

    // ============================================================
    // 3. SPONSOR BILLBOARDS - F1 circuit sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'MOL', bg: '#005599', fg: '#ffffff' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffcc00' },
        { name: 'HEINEKEN', bg: '#006600', fg: '#cc0000' },
        { name: 'ARAMCO', bg: '#00aa44', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#ffffff' },
        { name: 'TAG Heuer', bg: '#1a1a1a', fg: '#cc0000' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'LENGLEN', bg: '#004d00', fg: '#ffffff' },
      ];

      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const { pos, angle } = safeOffset(t, 14 + Math.random() * 4, i % 2 === 0 ? 1 : -1);
        if (!isSafe(pos.x, pos.z, 4)) continue;

        const sponsor = sponsors[i % sponsors.length];

        // Post
        const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(pos.x, pos.y + 1.5, pos.z);
        track._add(post);

        // Canvas for sponsor text
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
        board.position.set(pos.x, pos.y + 4.5, pos.z);
        board.rotation.y = angle;
        board.castShadow = true;
        track._add(board);
      }
    }

    // ============================================================
    // 4. EUROPEAN RURAL BUILDINGS - farmhouses and countryside structures
    //    The Great Hungarian Plain has traditional rural architecture
    // ============================================================
    {
      const farmColors = [0xc8a882, 0xd4b896, 0xb89872, 0xe0c8a8];
      const roofColors = [0x8b4513, 0xa0522d, 0x6b3410, 0x7a3b15];

      const buildings = [
        { t: 0.10, dist: 40, side: 1 },
        { t: 0.25, dist: 45, side: -1 },
        { t: 0.40, dist: 38, side: 1 },
        { t: 0.55, dist: 42, side: -1 },
        { t: 0.70, dist: 36, side: 1 },
        { t: 0.85, dist: 44, side: -1 },
      ];

      for (const b of buildings) {
        const { pos, angle } = safeOffset(b.t, b.dist, b.side);
        if (!isSafe(pos.x, pos.z, 8)) continue;

        const bw = 8 + Math.random() * 4;
        const bd = 10 + Math.random() * 4;
        const bh = 5 + Math.random() * 3;
        const ci = Math.floor(Math.random() * farmColors.length);

        // Main building body
        const bodyGeo = new THREE.BoxGeometry(bw, bh, bd);
        const bodyMat = new THREE.MeshStandardMaterial({ color: farmColors[ci], roughness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(pos.x, pos.y + bh / 2 - 1, pos.z);
        body.rotation.y = angle + Math.PI / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        track._add(body);

        // Tiled roof
        const roofGeo = new THREE.ConeGeometry(Math.max(bw, bd) * 0.7, 3.5, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: roofColors[ci], roughness: 0.9 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + bh + 0.5, pos.z);
        roof.rotation.y = angle + Math.PI / 4;
        roof.castShadow = true;
        track._add(roof);
      }
    }

    // ============================================================
    // 5. CORN / WHEAT FIELD PATCHES - Hungarian agricultural land
    // ============================================================
    {
      const wheatMat = new THREE.MeshStandardMaterial({ color: 0xc8a832, roughness: 0.95 });
      const cornMat = new THREE.MeshStandardMaterial({ color: 0x7aaa2a, roughness: 0.95 });

      const fields = [
        { x: 320, z: -280, w: 80, d: 60 },
        { x: -350, z: 200, w: 70, d: 55 },
        { x: 280, z: 350, w: 65, d: 50 },
        { x: -400, z: -300, w: 75, d: 65 },
      ];

      for (const f of fields) {
        if (track.distToTrack(f.x, f.z) < 50) continue;

        const fieldGeo = new THREE.BoxGeometry(f.w, 0.3, f.d);
        const fieldMat = Math.random() > 0.5 ? wheatMat : cornMat;
        const field = new THREE.Mesh(fieldGeo, fieldMat);
        field.position.set(f.x, -1.5, f.z);
        track._add(field);

        // Crop rows (thin raised lines)
        for (let r = -f.d / 2 + 3; r < f.d / 2; r += 5) {
          const rowGeo = new THREE.BoxGeometry(f.w - 4, 0.6, 0.5);
          const rowMat = new THREE.MeshStandardMaterial({
            color: fieldMat.color.getHex(),
            roughness: 0.9
          });
          const row = new THREE.Mesh(rowGeo, rowMat);
          row.position.set(f.x, -1.2, f.z + r);
          track._add(row);
        }
      }
    }

    // ============================================================
    // 6. DECIDUOUS TREES AND TREE LINES - European countryside vegetation
    //    Mature oaks, poplars, and willows along roads and field borders
    // ============================================================
    {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
      const leafColors = [0x2d6a1e, 0x3a7a28, 0x4a8a30, 0x2a5a18];

      // Scattered individual trees
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2 + 0.2;
        const r = 80 + Math.random() * 180;
        const tx = Math.cos(angle) * r;
        const tz = Math.sin(angle) * r;
        if (track.distToTrack(tx, tz) < 25) continue;

        const treeH = 6 + Math.random() * 5;
        const crownR = 2.5 + Math.random() * 2;

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, treeH, 6);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(tx, treeH / 2 - 2, tz);
        trunk.castShadow = true;
        track._add(trunk);

        // Crown (sphere for deciduous look)
        const leafColor = leafColors[i % leafColors.length];
        const crownGeo = new THREE.SphereGeometry(crownR, 8, 6);
        const crownMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.85 });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(tx, treeH - 1, tz);
        crown.scale.set(1, 0.8, 1);
        crown.castShadow = true;
        track._add(crown);
      }

      // Tree lines along imaginary roads bordering the track
      const treeLineAngles = [0.12, 0.35, 0.58, 0.82];
      for (const tl of treeLineAngles) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const baseDist = 50 + Math.random() * 20;
        for (let j = 0; j < 8; j++) {
          const tt = tl + (j - 4) * 0.008;
          if (tt < 0 || tt > 1) continue;
          const tp = track.spline.getPointAt(tt);
          const tangent = track.spline.getTangentAt(tt);
          const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
          const lx = tp.x + right.x * baseDist * side;
          const lz = tp.z + right.z * baseDist * side;
          if (track.distToTrack(lx, lz) < 20) continue;

          const treeH = 7 + Math.random() * 4;
          const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, treeH, 6);
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.set(lx, treeH / 2 - 2, lz);
          trunk.castShadow = true;
          track._add(trunk);

          const crownGeo = new THREE.SphereGeometry(2 + Math.random() * 1.5, 7, 5);
          const crownMat = new THREE.MeshStandardMaterial({
            color: leafColors[j % leafColors.length],
            roughness: 0.85
          });
          const crown = new THREE.Mesh(crownGeo, crownMat);
          crown.position.set(lx, treeH - 0.5, lz);
          crown.scale.set(1, 0.85, 1);
          crown.castShadow = true;
          track._add(crown);
        }
      }
    }

    // ============================================================
    // 7. WOODEN FENCE SECTIONS - countryside field boundaries
    // ============================================================
    {
      const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 });

      for (let i = 0; i < 16; i++) {
        const t = (i + 0.3) / 16;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = 20 + Math.random() * 8;
        const { pos, angle } = safeOffset(t, dist, side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        // Fence segment: horizontal rails between two posts
        const fenceLen = 6;

        // Post
        for (let p = -1; p <= 1; p += 2) {
          const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 2, 5);
          const post = new THREE.Mesh(postGeo, fenceMat);
          const offset = p * fenceLen / 2;
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          post.position.set(
            pos.x + offset * cosA,
            pos.y,
            pos.z - offset * sinA
          );
          track._add(post);
        }

        // Rails (2 horizontal bars)
        for (let r = 0; r < 2; r++) {
          const railGeo = new THREE.BoxGeometry(fenceLen, 0.08, 0.06);
          const rail = new THREE.Mesh(railGeo, fenceMat);
          rail.position.set(pos.x, pos.y + 0.6 + r * 0.7, pos.z);
          rail.rotation.y = angle;
          track._add(rail);
        }
      }
    }

    // ============================================================
    // 8. TRACK-SIDE BARRIERS - Armco barriers in Hungarian GP style
    // ============================================================
    {
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.4 });

      // Place barrier segments at regular intervals along the circuit
      for (let i = 0; i < 20; i++) {
        const t = (i + 0.5) / 20;
        const side = i % 2 === 0 ? 1 : -1;
        const { pos, angle } = safeOffset(t, hw + 3, side);
        if (!isSafe(pos.x, pos.z, 2)) continue;

        const barGeo = new THREE.BoxGeometry(4, 0.6, 0.3);
        const bar = new THREE.Mesh(barGeo, barrierMat);
        bar.position.set(pos.x, pos.y + 0.4, pos.z);
        bar.rotation.y = angle;
        bar.castShadow = true;
        track._add(bar);
      }
    }
}
