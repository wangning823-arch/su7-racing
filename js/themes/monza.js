import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Monza Circuit scenery builder
 */
export function buildMonzaScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. MAIN GRANDSTAND (Tribuna Centrale) - Start/Finish straight
    //    The iconic main grandstand overlooking the pit lane
    // ============================================================
    placeStand(0.03, hw + 22, 1, 45, 10, 10, 0x444444, 0xcc0000);

    // Pit building - opposite side (t=0.07)
    {
      const { pos, angle } = safeOffset(0.07, hw + 20, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 40, pitH = 5, pitD = 8;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garages with Italian/Ferrari red doors
        const garageColors = [0xcc0000, 0xffffff, 0x009246, 0xcc0000, 0xffffff];
        for (let i = 0; i < 12; i++) {
          const gGeo = new THREE.PlaneGeometry(2.8, 3.5);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 5.5) * 3.3;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y + 0.5,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          track._add(g);
        }

        // "AUTODROMO NAZIONALE MONZA" sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc0000';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 32px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('AUTODROMO NAZIONALE MONZA', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(18, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        track._add(sign);
      }
    }

    // ============================================================
    // 2. PARABOLICA GRANDSTAND - The famous sweeping right-hander
    //    Tifosi gather here to watch cars sweep through at high speed
    // ============================================================
    {
      const paraT = 0.82;
      const { pos, angle } = safeOffset(paraT, hw + 22, -1);
      if (isSafe(pos.x, pos.z, 15)) {
        const standW = 50, standH = 8, standD = 9;
        const standGeo = new THREE.BoxGeometry(standW, standH, standD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(pos.x, pos.y + standH / 2, pos.z);
        stand.rotation.y = angle;
        stand.castShadow = true;
        stand.receiveShadow = true;
        track._add(stand);

        // Red canopy roof (Ferrari red)
        const roofGeo = new THREE.BoxGeometry(standW + 3, 0.4, standD + 3);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + standH + 0.2, pos.z);
        roof.rotation.y = angle;
        roof.castShadow = true;
        track._add(roof);

        // "PARABOLICA" sign above the grandstand
        const paraSignCanvas = document.createElement('canvas');
        paraSignCanvas.width = 256; paraSignCanvas.height = 64;
        const paraCtx = paraSignCanvas.getContext('2d');
        paraCtx.fillStyle = '#cc0000';
        paraCtx.fillRect(0, 0, 256, 64);
        paraCtx.fillStyle = '#ffffff';
        paraCtx.font = 'bold 40px Arial';
        paraCtx.textAlign = 'center';
        paraCtx.textBaseline = 'middle';
        paraCtx.fillText('PARABOLICA', 128, 32);
        const paraSignTex = new THREE.CanvasTexture(paraSignCanvas);
        const paraSignGeo = new THREE.PlaneGeometry(10, 2.5);
        const paraSignMat = new THREE.MeshStandardMaterial({ map: paraSignTex, roughness: 0.3 });
        const paraSign = new THREE.Mesh(paraSignGeo, paraSignMat);
        paraSign.position.set(pos.x, pos.y + standH + 2.5, pos.z);
        paraSign.rotation.y = angle;
        track._add(paraSign);

        // Tifosi seats: Italian flag colors with extra red for Ferrari
        const tifosiColors = [0xcc0000, 0x009246, 0xcc0000, 0xffffff, 0xcc0000];
        const rows = 3;
        const cols = Math.floor(standW / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
            const seatMat = new THREE.MeshStandardMaterial({ color: tifosiColors[r % 5] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - cols / 2 + 0.5) * 1.8;
            const localZ = (r - 1) * (standD / 2.5);
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
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
    // 3. VARIANTE DEL RETTIFILO GRANDSTAND - First chicane
    //    Heavy braking zone where cars slow from 350 km/h
    // ============================================================
    placeStand(0.18, hw + 18, 1, 30, 7, 8, 0x444444, 0x009246);

    // ============================================================
    // 4. TIFOSI STANDS - Ferrari fan sections along the circuit
    //    Scattered stands with predominantly red seats
    // ============================================================
    {
      const tifosiPositions = [
        { t: 0.30, side: -1, w: 28, h: 6, d: 7 },
        { t: 0.50, side: 1, w: 25, h: 6, d: 7 },
        { t: 0.65, side: -1, w: 30, h: 7, d: 8 },
        { t: 0.92, side: 1, w: 35, h: 8, d: 9 },
      ];

      for (const tf of tifosiPositions) {
        const { pos: tfPos, angle: tfAngle } = safeOffset(tf.t, hw + 20, tf.side);
        if (!isSafe(tfPos.x, tfPos.z, tf.w / 2)) continue;

        // Stand structure
        const tfGeo = new THREE.BoxGeometry(tf.w, tf.h, tf.d);
        const tfMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 });
        const tfStand = new THREE.Mesh(tfGeo, tfMat);
        tfStand.position.set(tfPos.x, tfPos.y + tf.h / 2, tfPos.z);
        tfStand.rotation.y = tfAngle;
        tfStand.castShadow = true;
        tfStand.receiveShadow = true;
        track._add(tfStand);

        // Red canopy
        const tfRoofGeo = new THREE.BoxGeometry(tf.w + 2, 0.35, tf.d + 2);
        const tfRoofMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.3, metalness: 0.3 });
        const tfRoof = new THREE.Mesh(tfRoofGeo, tfRoofMat);
        tfRoof.position.set(tfPos.x, tfPos.y + tf.h + 0.2, tfPos.z);
        tfRoof.rotation.y = tfAngle;
        tfRoof.castShadow = true;
        track._add(tfRoof);

        // Tifosi seats: mostly red (Ferrari) with Italian tricolor accents
        const tfSeatColors = [0xcc0000, 0xcc0000, 0x009246, 0xcc0000, 0xffffff];
        const tfRows = 2;
        const tfCols = Math.floor(tf.w / 2);
        for (let r = 0; r < tfRows; r++) {
          for (let c = 0; c < tfCols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.45, 0.6, 0.45);
            const seatMat = new THREE.MeshStandardMaterial({ color: tfSeatColors[r % 5] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - tfCols / 2 + 0.5) * 1.7;
            const localZ = (r - 0.5) * (tf.d / 3);
            const cosA = Math.cos(tfAngle), sinA = Math.sin(tfAngle);
            seat.position.set(
              tfPos.x + localX * cosA + localZ * sinA,
              tfPos.y + 0.4 + r * 1.0,
              tfPos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = tfAngle;
            track._add(seat);
          }
        }
      }
    }

    // ============================================================
    // 5. ITALIAN SPONSOR BOARDS - Italian and F1 sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'MONZA GP', bg: '#cc0000', fg: '#ffffff' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'ENI', bg: '#003399', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'FERRARI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
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
    // 6. PARK FENCING - Italian Royal Park wrought-iron style fence
    //    Monza is set inside Parco di Monza, an enormous royal park
    // ============================================================
    {
      const fenceSegments = 40;
      for (let i = 0; i < fenceSegments; i++) {
        const t = (i + 0.5) / fenceSegments;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();

        // Park fence on alternating sides, at a comfortable distance
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 32 + Math.random() * 8;
        const fx = p.x + right.x * dist * side;
        const fz = p.z + right.z * dist * side;
        if (track.distToTrack(fx, fz) < hw + 28) continue;

        const fy = track.getTerrainHeight(fx, fz);

        // Fence post (dark green wrought-iron style)
        const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.0, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x2d4a2d, roughness: 0.5, metalness: 0.6 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(fx, fy + 1.0, fz);
        track._add(post);

        // Decorative top cap
        const capGeo = new THREE.SphereGeometry(0.12, 6, 4);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x2d4a2d, roughness: 0.3, metalness: 0.7 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(fx, fy + 2.1, fz);
        track._add(cap);

        // Fence rail between consecutive posts (horizontal bar)
        const nextT = ((i + 1) % fenceSegments + 0.5) / fenceSegments;
        const np = track.spline.getPointAt(nextT);
        const nt = track.spline.getTangentAt(nextT);
        const nr = new THREE.Vector3(nt.z, 0, -nt.x).normalize();
        const nfx = np.x + nr.x * dist * side;
        const nfz = np.z + nr.z * dist * side;
        const railLen = Math.sqrt((nfx - fx) ** 2 + (nfz - fz) ** 2);
        if (railLen < 0.1 || railLen > 30) continue;

        const railGeo = new THREE.CylinderGeometry(0.03, 0.03, railLen, 4);
        const rail = new THREE.Mesh(railGeo, postMat);
        rail.position.set((fx + nfx) / 2, fy + 1.4, (fz + nfz) / 2);
        rail.rotation.y = Math.atan2(nfx - fx, nfz - fz);
        rail.rotation.x = Math.PI / 2;
        track._add(rail);
      }
    }

    // ============================================================
    // 7. PARK TREES - Additional large old trees for Royal Park feel
    //    These supplement the theme trees with extra-large specimens
    // ============================================================
    {
      const ancientCount = 30;
      const trunkGeo = new THREE.CylinderGeometry(0.25, 0.45, 5.0, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2a0a, roughness: 0.9 });
      const canopyGeo1 = new THREE.SphereGeometry(3.5, 8, 6);
      const canopyMat1 = new THREE.MeshStandardMaterial({ color: 0x1a5a1a, roughness: 0.85 });
      const canopyGeo2 = new THREE.SphereGeometry(2.8, 7, 5);
      const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x2a6a2a, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, ancientCount);
      const canopy1 = new THREE.InstancedMesh(canopyGeo1, canopyMat1, Math.floor(ancientCount * 0.6));
      const canopy2 = new THREE.InstancedMesh(canopyGeo2, canopyMat2, Math.ceil(ancientCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < ancientCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 22 && attempts < 50);
        if (attempts >= 50) continue;

        const y = track.getTerrainHeight(x, z);
        const scale = 1.0 + Math.random() * 0.8;

        // Thick trunk
        dummy.position.set(x, y + 2.5 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        // Wide spreading canopy (old park tree)
        dummy.position.set(x, y + 6.0 * scale, z);
        dummy.scale.set(scale * 1.5, scale * 1.0, scale * 1.5);
        dummy.updateMatrix();
        if (i < ancientCount * 0.6) canopy1.setMatrixAt(idx1++, dummy.matrix);
        else canopy2.setMatrixAt(idx2++, dummy.matrix);
      }

      trunkMesh.count = ancientCount;
      canopy1.count = idx1;
      canopy2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      canopy1.instanceMatrix.needsUpdate = true;
      canopy2.instanceMatrix.needsUpdate = true;
      track._add(trunkMesh);
      track._add(canopy1);
      track._add(canopy2);
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
        { t: 0.55, side: 1 },
        { t: 0.68, side: -1 },
        { t: 0.78, side: 1 },
        { t: 0.88, side: -1 },
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
    // 9. ITALIAN FLAG BANNERS - Along the main straight
    // ============================================================
    {
      const bannerPositions = [
        { t: 0.01, side: 1 },
        { t: 0.04, side: -1 },
        { t: 0.06, side: 1 },
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

        // Italian flag (green-white-red vertical stripes)
        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 96; flagCanvas.height = 128;
        const fCtx = flagCanvas.getContext('2d');
        fCtx.fillStyle = '#009246';
        fCtx.fillRect(0, 0, 32, 128);
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(32, 0, 32, 128);
        fCtx.fillStyle = '#ce2b37';
        fCtx.fillRect(64, 0, 32, 128);
        const flagTex = new THREE.CanvasTexture(flagCanvas);

        const flagGeo = new THREE.PlaneGeometry(1.4, 1.8);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(bPos.x, bPos.y + 4.5, bPos.z);
        flag.rotation.y = bAngle;
        track._add(flag);
      }
    }
}
