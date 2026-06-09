import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Spa Circuit scenery builder
 */
export function buildSpaScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. LA SOURCE HAIRPIN GRANDSTAND
    //    The first corner after the start/finish straight - a tight
    //    hairpin with packed grandstands on the outside
    // ============================================================
    {
      // La Source is at the very beginning, t ~ 0.00
      placeStand(0.01, hw + 20, 1, 30, 8, 8, 0x3a3a4a, 0x2c3e50);
      placeStand(0.03, hw + 22, -1, 25, 6, 7, 0x333344, 0xfdda24);
    }

    // ============================================================
    // 2. EAU ROUGE / RAIDILLON GRANDSTAND AND SIGNAGE
    //    The iconic uphill left-right-left complex, one of the most
    //    famous corners in motorsport. Grandstand sits at the top of
    //    the hill overlooking the compression.
    // ============================================================
    {
      // Grandstand at the top of Raidillon (t ~ 0.07, looking back down)
      placeStand(0.07, hw + 22, 1, 35, 10, 9, 0x2a2a3a, 0xed2939);
      placeStand(0.05, hw + 18, -1, 28, 7, 8, 0x333344, 0x1a1a1a);

      // EAU ROUGE / RAIDILLON sign at the bottom of the hill
      {
        const { pos: signPos, angle: signAngle } = safeOffset(0.045, hw + 10, -1);
        if (isSafe(signPos.x, signPos.z, 5)) {
          const signCanvas = document.createElement('canvas');
          signCanvas.width = 512; signCanvas.height = 64;
          const signCtx = signCanvas.getContext('2d');
          signCtx.fillStyle = '#1a1a1a';
          signCtx.fillRect(0, 0, 512, 64);
          signCtx.fillStyle = '#ffffff';
          signCtx.font = 'bold 38px Arial';
          signCtx.textAlign = 'center';
          signCtx.textBaseline = 'middle';
          signCtx.fillText('EAU ROUGE - RAIDILLON', 256, 32);
          const signTex = new THREE.CanvasTexture(signCanvas);
          const signGeo = new THREE.PlaneGeometry(16, 2);
          const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
          const sign = new THREE.Mesh(signGeo, signMat);
          sign.position.set(signPos.x, signPos.y + 5, signPos.z);
          sign.rotation.y = signAngle;
          track._add(sign);

          // Support posts for the sign
          for (let s of [-1, 1]) {
            const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 5, 6);
            const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
            const post = new THREE.Mesh(postGeo, postMat);
            const cosA = Math.cos(signAngle), sinA = Math.sin(signAngle);
            post.position.set(
              signPos.x + s * 7 * cosA,
              signPos.y + 2.5,
              signPos.z - s * 7 * sinA
            );
            track._add(post);
          }
        }
      }
    }

    // ============================================================
    // 3. KEMMEL STRAIGHT GRANDSTANDS
    //    The long straight after Raidillon with spectator viewing
    // ============================================================
    {
      placeStand(0.10, hw + 20, 1, 40, 9, 10, 0x3a3a4a, 0xfdda24);
      placeStand(0.12, hw + 18, -1, 30, 7, 8, 0x333344, 0x2c3e50);
    }

    // ============================================================
    // 4. SPA-FRANCORCHAMPS PIT COMPLEX
    //    Located on the start/finish straight
    // ============================================================
    {
      const { pos: pitPos, angle: pitAngle } = safeOffset(0.98, hw + 18, -1);
      if (isSafe(pitPos.x, pitPos.z, 8)) {
        const pitW = 35, pitH = 5, pitD = 8;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pitPos.x, pitPos.y + pitH / 2, pitPos.z);
        pit.rotation.y = pitAngle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garages (Belgian tricolor: black, yellow, red)
        const garageColors = [0x1a1a1a, 0xfdda24, 0xed2939, 0x1a1a1a, 0xfdda24];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(pitAngle), sinA = Math.sin(pitAngle);
          const localX = (i - 4.5) * 3.2;
          g.position.set(
            pitPos.x + localX * cosA - (pitD / 2) * sinA,
            pitPos.y + 0.5,
            pitPos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = pitAngle;
          track._add(g);
        }

        // "SPA-FRANCORCHAMPS" sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#1a1a1a';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#fdda24';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('CIRCUIT DE SPA-FRANCORCHAMPS', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(16, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pitPos.x, pitPos.y + pitH + 1.5, pitPos.z);
        sign.rotation.y = pitAngle;
        track._add(sign);
      }
    }

    // ============================================================
    // 5. ARDENNES MOUNTAIN / HILL BACKDROP
    //    Spa is nestled in the Ardennes forest with rolling hills
    // ============================================================
    {
      const hillMat1 = new THREE.MeshStandardMaterial({ color: 0x2a5a1a, roughness: 0.95 });
      const hillMat2 = new THREE.MeshStandardMaterial({ color: 0x1a4a12, roughness: 0.95 });

      const hills = [
        { x: 280, z: -400, scale: 1.3, height: 55, mat: hillMat1 },
        { x: -250, z: -380, scale: 1.1, height: 45, mat: hillMat2 },
        { x: -480, z: -320, scale: 1.5, height: 65, mat: hillMat1 },
        { x: 420, z: -350, scale: 1.0, height: 40, mat: hillMat2 },
        { x: 150, z: 420, scale: 1.2, height: 50, mat: hillMat1 },
        { x: -320, z: 380, scale: 1.4, height: 60, mat: hillMat2 },
        { x: 380, z: 350, scale: 1.0, height: 42, mat: hillMat1 },
        { x: -80, z: 460, scale: 1.1, height: 48, mat: hillMat2 },
        { x: 500, z: 100, scale: 1.3, height: 52, mat: hillMat1 },
        { x: -500, z: -100, scale: 1.2, height: 58, mat: hillMat2 },
      ];

      for (const m of hills) {
        const geo = new THREE.ConeGeometry(50 * m.scale, m.height * m.scale, 8);
        const hill = new THREE.Mesh(geo, m.mat);
        hill.position.set(m.x, m.height * m.scale / 2 - 5, m.z);
        hill.castShadow = true;
        track._add(hill);
      }

      // Smaller rolling hills near the track
      const rollMat = new THREE.MeshStandardMaterial({ color: 0x3a7a28, roughness: 0.95 });
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const r = 200 + Math.random() * 120;
        const hx = Math.cos(angle) * r;
        const hz = Math.sin(angle) * r;
        if (track.distToTrack(hx, hz) < 50) continue;

        const hillGeo = new THREE.SphereGeometry(25 + Math.random() * 18, 8, 6);
        const hill = new THREE.Mesh(hillGeo, rollMat);
        hill.position.set(hx, -3, hz);
        hill.scale.set(1, 0.3, 1);
        track._add(hill);
      }
    }

    // ============================================================
    // 6. ARDENNES PINE FOREST - Dense conifer trees
    //    The Ardennes is famous for its thick pine forests
    //    (supplements the theme trees with additional dense forest)
    // ============================================================
    {
      const pineCount = 80;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 4.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.9 });
      const leafGeo1 = new THREE.ConeGeometry(1.8, 6.0, 8);
      const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x1a5a1a, roughness: 0.85 });
      const leafGeo2 = new THREE.ConeGeometry(1.4, 5.0, 7);
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x2a6a2a, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, pineCount);
      const leaves1 = new THREE.InstancedMesh(leafGeo1, leafMat1, Math.floor(pineCount * 0.6));
      const leaves2 = new THREE.InstancedMesh(leafGeo2, leafMat2, Math.ceil(pineCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < pineCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 18 && attempts < 50);

        const y = track.getTerrainHeight(x, z);
        const scale = 0.7 + Math.random() * 0.7;

        // Trunk
        dummy.position.set(x, y + 2.2 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        if (i < pineCount * 0.6) {
          dummy.position.set(x, y + 6.0 * scale, z);
          dummy.updateMatrix();
          leaves1.setMatrixAt(idx1++, dummy.matrix);
        } else {
          dummy.position.set(x, y + 5.5 * scale, z);
          dummy.updateMatrix();
          leaves2.setMatrixAt(idx2++, dummy.matrix);
        }
      }

      trunkMesh.count = pineCount;
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
    // 7. SECONDARY GRANDSTANDS - Key corners around the circuit
    // ============================================================
    {
      // Les Combes chicane (end of Kemmel Straight, t ~ 0.16)
      placeStand(0.16, hw + 20, -1, 25, 6, 7, 0x333344, 0xed2939);
      // Bruxelles / Rivage (t ~ 0.25)
      placeStand(0.25, hw + 18, 1, 22, 5, 6, 0x2a3a4a, 0xfdda24);
      // Pouhon double-left (t ~ 0.35)
      placeStand(0.35, hw + 20, -1, 28, 7, 7, 0x3a3a4a, 0x2c3e50);
      // Bus Stop chicane area (t ~ 0.90)
      placeStand(0.90, hw + 20, 1, 30, 8, 8, 0x333344, 0xed2939);
    }

    // ============================================================
    // 8. SPONSOR BOARDS - Belgian GP / F1 sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'SPA GP', bg: '#1a1a1a', fg: '#fdda24' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'SPA-FRANCORCHAMPS', bg: '#2c3e50', fg: '#fdda24' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'F1', bg: '#e10600', fg: '#ffffff' },
        { name: 'ARDENNES', bg: '#1a5a1a', fg: '#ffffff' },
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
    // 9. TIRE WALLS - Safety barriers at key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.02, side: -1 },   // La Source exit
        { t: 0.08, side: 1 },    // Raidillon exit
        { t: 0.18, side: -1 },   // Les Combes
        { t: 0.30, side: 1 },    // Bruxelles
        { t: 0.45, side: -1 },   // Pouhon exit
        { t: 0.60, side: 1 },    // Fagnes
        { t: 0.75, side: -1 },   // Stavelot
        { t: 0.88, side: 1 },    // Bus Stop chicane
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
    // 10. CATCH FENCING - Safety fences along high-speed sections
    //     Ardenne mountain circuit requires robust safety barriers
    // ============================================================
    {
      const fencePositions = [
        { t: 0.03, side: -1, count: 5 },   // La Source
        { t: 0.06, side: 1, count: 6 },     // Eau Rouge approach
        { t: 0.09, side: -1, count: 6 },    // Raidillon top
        { t: 0.11, side: 1, count: 5 },     // Kemmel Straight
        { t: 0.17, side: -1, count: 5 },    // Les Combes
        { t: 0.35, side: 1, count: 6 },     // Pouhon
        { t: 0.55, side: -1, count: 5 },    // Mid circuit
        { t: 0.75, side: 1, count: 5 },     // Stavelot
        { t: 0.91, side: -1, count: 6 },    // Bus Stop
      ];

      for (const fp of fencePositions) {
        const { pos: fPos, angle: fAngle } = safeOffset(fp.t, hw + 12, fp.side);
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

          // Wire mesh panel (transparent safety fence)
          const panelGeo = new THREE.PlaneGeometry(2.2, 3);
          const panelMat = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            transparent: true,
            opacity: 0.2,
            roughness: 0.3,
            metalness: 0.4,
            side: THREE.DoubleSide
          });
          const panel = new THREE.Mesh(panelGeo, panelMat);
          panel.position.set(fx, fPos.y + 2, fz);
          panel.rotation.y = fAngle;
          track._add(panel);
        }
      }
    }
}
