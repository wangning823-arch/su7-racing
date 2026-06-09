import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Rodriguez Circuit scenery builder
 */
export function buildRodriguezScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. FORO SOL STADIUM - The iconic stadium section
    //    The track passes through a massive stadium with
    //    steep concrete stands on both sides
    // ============================================================
    {
      // Stadium position: around t=0.3 (the tight chicane section)
      const stadiumT = 0.30;
      const p = track.spline.getPointAt(stadiumT);
      const tangent = track.spline.getTangentAt(stadiumT);
      const angle = Math.atan2(tangent.x, tangent.z);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();

      // Stadium outer shell - two large curved stands flanking the track
      const stadiumW = 60, stadiumH = 14, stadiumD = 18;

      for (let side of [-1, 1]) {
        const dist = hw + 16;
        const sx = p.x + right.x * dist * side;
        const sz = p.z + right.z * dist * side;
        if (!isSafe(sx, sz, stadiumW / 2)) continue;

        // Main concrete stand structure (curved to follow track)
        const standGeo = new THREE.BoxGeometry(stadiumW, stadiumH, stadiumD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(sx, p.y + stadiumH / 2, sz);
        stand.rotation.y = angle;
        stand.castShadow = true;
        stand.receiveShadow = true;
        track._add(stand);

        // Seat tiers - green, white, red sections (Mexican flag)
        const sectionColors = [0x006847, 0xffffff, 0xce1126];
        const tierCount = 5;
        const sectionW = stadiumW / 3;
        for (let s = 0; s < 3; s++) {
          for (let tier = 0; tier < tierCount; tier++) {
            const tierGeo = new THREE.BoxGeometry(sectionW - 0.5, stadiumH / tierCount - 0.2, 0.8);
            const tierMat = new THREE.MeshStandardMaterial({ color: sectionColors[s] });
            const tierMesh = new THREE.Mesh(tierGeo, tierMat);
            const localX = (s - 1) * sectionW;
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            tierMesh.position.set(
              sx + localX * cosA,
              p.y + 1 + tier * (stadiumH / tierCount),
              sz - localX * sinA
            );
            tierMesh.rotation.y = angle;
            track._add(tierMesh);
          }
        }

        // Stadium roof overhang
        const roofGeo = new THREE.BoxGeometry(stadiumW + 4, 0.5, 6);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.4 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(sx, p.y + stadiumH + 0.5, sz + side * -4);
        roof.rotation.y = angle;
        track._add(roof);
      }

      // Stadium sign "FORO SOL" / "ESTADIO GNP"
      {
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#006847';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 40px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('FORO SOL - AUTÓDROMO HERMANOS RODRÍGUEZ', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);

        const { pos: signPos } = safeOffset(stadiumT, hw + 16, 1);
        if (isSafe(signPos.x, signPos.z, 5)) {
          const signGeo = new THREE.PlaneGeometry(20, 2.5);
          const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
          const sign = new THREE.Mesh(signGeo, signMat);
          const signAngle = Math.atan2(tangent.x, tangent.z);
          sign.position.set(signPos.x, p.y + stadiumH + 2, signPos.z);
          sign.rotation.y = signAngle;
          track._add(sign);
        }
      }
    }

    // ============================================================
    // 2. MAIN GRANDSTAND - Start/Finish straight
    // ============================================================
    placeStand(0.03, hw + 20, 1, 40, 10, 10, 0x555555, 0x006847);

    // Pit building - opposite side
    {
      const { pos, angle } = safeOffset(0.07, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 35, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garages with Mexico colors
        const garageColors = [0x006847, 0xffffff, 0xce1126, 0xffffff, 0x006847];
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

        // "MEXICO GP" sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#006847';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('GRAN PREMIO DE LA CIUDAD DE MÉXICO', 256, 32);
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
    // 3. SECONDARY GRANDSTANDS - Key corners with Mexican tricolor
    // ============================================================
    placeStand(0.15, hw + 18, -1, 26, 7, 7, 0x555566, 0xce1126);
    placeStand(0.45, hw + 20, 1, 30, 8, 8, 0x444455, 0x006847);
    placeStand(0.65, hw + 18, -1, 24, 6, 7, 0x555566, 0xce1126);
    placeStand(0.85, hw + 20, 1, 28, 7, 8, 0x444455, 0x006847);

    // ============================================================
    // 4. PICO DEL ÁGUILA (Eagle's Peak) - Elevated section
    //    Mexico City's famous elevation: 2,240m above sea level
    //    Represented as tall pylons marking the high-altitude zone
    // ============================================================
    {
      const pylonCount = 8;
      for (let i = 0; i < pylonCount; i++) {
        const t = (i + 0.5) / pylonCount;
        const { pos, angle } = safeOffset(t, hw + 28, i % 2 === 0 ? 1 : -1);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        // Tall white pylon (altitude marker)
        const pylonGeo = new THREE.CylinderGeometry(0.15, 0.2, 12, 6);
        const pylonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 });
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.set(pos.x, pos.y + 6, pos.z);
        pylon.castShadow = true;
        track._add(pylon);

        // Mexican flag at top (tricolor bands)
        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 64; flagCanvas.height = 48;
        const fCtx = flagCanvas.getContext('2d');
        // Green
        fCtx.fillStyle = '#006847';
        fCtx.fillRect(0, 0, 22, 48);
        // White
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(22, 0, 22, 48);
        // Red
        fCtx.fillStyle = '#ce1126';
        fCtx.fillRect(44, 0, 22, 48);
        const flagTex = new THREE.CanvasTexture(flagCanvas);

        const flagGeo = new THREE.PlaneGeometry(2.0, 1.5);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(pos.x, pos.y + 12.5, pos.z);
        flag.rotation.y = angle;
        track._add(flag);
      }
    }

    // ============================================================
    // 5. CACTUS VEGETATION - Desert/highland plants
    // ============================================================
    {
      const cactusCount = 30;
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 4.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1a, roughness: 0.9 });
      const leafGeo = new THREE.ConeGeometry(0.8, 3.0, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.8 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, cactusCount);
      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, cactusCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx = 0;
      for (let i = 0; i < cactusCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 18 && attempts < 50);
        if (attempts >= 50) continue;

        const y = track.getTerrainHeight(x, z);
        const scale = 0.7 + Math.random() * 0.6;

        // Trunk
        dummy.position.set(x, y + 2.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);

        // Cactus top
        dummy.position.set(x, y + 4.5 * scale, z);
        dummy.scale.set(scale * 1.2, scale * 0.8, scale * 1.2);
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

    // ============================================================
    // 6. PAPEL PICADO BANNERS - Mexican paper banners strung
    //    across the track at various points
    // ============================================================
    {
      const bannerColors = [0x006847, 0xffffff, 0xce1126, 0xffcc00, 0xff6600, 0xff00ff];
      const bannerCount = 12;
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

          const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 5, 6);
          const poleMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(bx, p.y + 2.5, bz);
          track._add(pole);
        }

        // Banner string across track
        const bannerGeo = new THREE.PlaneGeometry(hw * 2 - 2, 1.2);
        const bColor = bannerColors[i % bannerColors.length];
        const bannerMat = new THREE.MeshStandardMaterial({
          color: bColor,
          side: THREE.DoubleSide,
          roughness: 0.9
        });
        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(p.x, p.y + 5, p.z);
        banner.rotation.y = angle;
        track._add(banner);
      }
    }

    // ============================================================
    // 7. SPONSOR BOARDS - Mexico GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'MEXICO GP', bg: '#006847', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'TELCEL', bg: '#003366', fg: '#ffffff' },
        { name: 'HERMOS RODRÍGUEZ', bg: '#1a1a2e', fg: '#006847' },
        { name: 'CITY OF MEXICO', bg: '#ce1126', fg: '#ffffff' },
        { name: 'EMIRATES', bg: '#d71921', fg: '#ffffff' },
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
        { t: 0.12, side: -1 },
        { t: 0.22, side: 1 },
        { t: 0.38, side: -1 },
        { t: 0.52, side: 1 },
        { t: 0.68, side: -1 },
        { t: 0.78, side: 1 },
        { t: 0.92, side: -1 },
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
    // 9. HIGH-ALTITUDE FOG MARKERS - Thin air markers
    //    Mexico City sits at 2,240m; visible mountain backdrop
    // ============================================================
    {
      const markerCount = 6;
      for (let i = 0; i < markerCount; i++) {
        const angle = (i / markerCount) * Math.PI * 2;
        const r = 120 + Math.random() * 40;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        if (track.distToTrack(x, z) < hw + 30) continue;

        // Altitude sign
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 128; signCanvas.height = 64;
        const sCtx = signCanvas.getContext('2d');
        sCtx.fillStyle = '#ffffff';
        sCtx.fillRect(0, 0, 128, 64);
        sCtx.fillStyle = '#000000';
        sCtx.font = 'bold 24px Arial';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText('2,240 m', 64, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);

        const signGeo = new THREE.PlaneGeometry(3, 1.5);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, side: THREE.DoubleSide });
        const sign = new THREE.Mesh(signGeo, signMat);
        const y = track.getTerrainHeight(x, z);
        sign.position.set(x, y + 3, z);
        track._add(sign);

        // Post
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, y + 1.5, z);
        track._add(post);
      }
    }
}
