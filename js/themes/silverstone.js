import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Silverstone Circuit scenery builder
 */
export function buildSilverstoneScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. THE WING - Silverstone's iconic media centre
    //    A distinctive modern building alongside the pit straight,
    //    shaped like an aircraft wing (RAF heritage).
    // ============================================================
    {
      const { pos: wingPos, angle: wingAngle } = safeOffset(0.95, hw + 22, -1);
      if (isSafe(wingPos.x, wingPos.z, 15)) {
        // Main body - long low-slung silver/white building
        const bodyGeo = new THREE.BoxGeometry(40, 5, 10);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d8, roughness: 0.3, metalness: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(wingPos.x, wingPos.y + 2.5, wingPos.z);
        body.rotation.y = wingAngle;
        body.castShadow = true;
        body.receiveShadow = true;
        track._add(body);

        // Wing-shaped roof canopy (curved overhang)
        const roofGeo = new THREE.BoxGeometry(44, 0.5, 14);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ee, roughness: 0.2, metalness: 0.6 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(wingPos.x, wingPos.y + 5.5, wingPos.z);
        roof.rotation.y = wingAngle;
        roof.castShadow = true;
        track._add(roof);

        // Glazed front facade (glass panels)
        const glassGeo = new THREE.PlaneGeometry(38, 4);
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0x88aacc, transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.8, side: THREE.DoubleSide
        });
        const cosA = Math.cos(wingAngle), sinA = Math.sin(wingAngle);
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(
          wingPos.x + sinA * 5.1,
          wingPos.y + 2.8,
          wingPos.z + cosA * 5.1
        );
        glass.rotation.y = wingAngle;
        track._add(glass);

        // "SILVERSTONE" sign on The Wing
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#00247d';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 40px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('SILVERSTONE CIRCUIT', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(14, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(wingPos.x, wingPos.y + 6.8, wingPos.z);
        sign.rotation.y = wingAngle;
        track._add(sign);

        // Garage doors along the back
        for (let i = 0; i < 8; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: 0x00247d, roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const localX = (i - 3.5) * 4.5;
          g.position.set(
            wingPos.x + localX * cosA + sinA * 5.1,
            wingPos.y + 1.5,
            wingPos.z - localX * sinA + cosA * 5.1
          );
          g.rotation.y = wingAngle;
          track._add(g);
        }
      }
    }

    // ============================================================
    // 2. MAIN GRANDSTAND - Start/Finish straight
    //    The iconic Silverstone main grandstand opposite The Wing
    // ============================================================
    placeStand(0.03, hw + 22, 1, 44, 10, 10, 0x333344, 0x00247d);

    // ============================================================
    // 3. COPSE CORNER GRANDSTAND
    //    Copse is the famous fast right-hander (approx t=0.12)
    // ============================================================
    placeStand(0.12, hw + 18, -1, 28, 7, 7, 0x333344, 0xcc0000);

    // ============================================================
    // 4. MAGGOTTS-BECKETTS GRANDSTAND
    //    The legendary high-speed S-bend complex (approx t=0.35)
    // ============================================================
    placeStand(0.35, hw + 20, 1, 30, 8, 8, 0x333344, 0x00247d);

    // ============================================================
    // 5. STOWE CORNER GRANDSTAND
    //    Stowe is the fast right-hander at the end of the Hangar Straight (approx t=0.75)
    // ============================================================
    placeStand(0.75, hw + 18, -1, 26, 6, 7, 0x333344, 0xcc0000);

    // ============================================================
    // 6. ENGLISH COUNTRYSIDE GRASSLAND
    //    Silverstone sits in the English countryside with open fields
    //    Low grass mounds and gentle rolling terrain
    // ============================================================
    {
      const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a8c35, roughness: 0.95 });
      const grassMat2 = new THREE.MeshStandardMaterial({ color: 0x3d7a28, roughness: 0.95 });

      for (let i = 0; i < 20; i++) {
        const t = Math.random();
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 25 + Math.random() * 50;
        const gx = p.x + right.x * dist * side;
        const gz = p.z + right.z * dist * side;
        if (track.distToTrack(gx, gz) < hw + 20) continue;

        const grassGeo = new THREE.SphereGeometry(4 + Math.random() * 3, 8, 6);
        const grass = new THREE.Mesh(grassGeo, Math.random() > 0.5 ? grassMat : grassMat2);
        grass.position.set(gx, track.getTerrainHeight(gx, gz) - 0.5, gz);
        grass.scale.set(1 + Math.random(), 0.2 + Math.random() * 0.15, 1 + Math.random());
        track._add(grass);
      }
    }

    // ============================================================
    // 7. LOW PERIMETER FENCING
    //    Low catch fencing typical of British circuits,
    //    running along the track perimeter
    // ============================================================
    {
      const fenceCount = 24;
      for (let i = 0; i < fenceCount; i++) {
        const t = (i + 0.5) / fenceCount;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10;
        const fx = p.x + right.x * dist * side;
        const fz = p.z + right.z * dist * side;
        if (track.distToTrack(fx, fz) < hw + 8) continue;

        const angle = Math.atan2(tangent.x, tangent.z);

        // Fence posts
        for (let j = -1; j <= 1; j++) {
          const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 4);
          const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
          const post = new THREE.Mesh(postGeo, postMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          post.position.set(
            fx + j * 2.5 * cosA,
            track.getTerrainHeight(fx, fz) + 1.25,
            fz - j * 2.5 * sinA
          );
          track._add(post);
        }

        // Wire mesh panel
        const panelGeo = new THREE.PlaneGeometry(5.5, 2.0);
        const panelMat = new THREE.MeshStandardMaterial({
          color: 0x888888,
          transparent: true,
          opacity: 0.3,
          roughness: 0.5,
          metalness: 0.4,
          side: THREE.DoubleSide
        });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(fx, track.getTerrainHeight(fx, fz) + 1.2, fz);
        panel.rotation.y = angle;
        track._add(panel);
      }
    }

    // ============================================================
    // 8. AIRFIELD HERITAGE - Old RAF Silverstone remnants
    //    Scattered concrete runway/hangar remnants around the perimeter
    // ============================================================
    {
      const hangarMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.85 });
      const positions = [
        { angle: 0.5, r: 140 },
        { angle: 2.1, r: 150 },
        { angle: 3.8, r: 130 },
        { angle: 5.2, r: 145 },
      ];

      for (const hp of positions) {
        const hx = Math.cos(hp.angle) * hp.r;
        const hz = Math.sin(hp.angle) * hp.r;
        if (track.distToTrack(hx, hz) < hw + 40) continue;

        // Concrete slab (old runway section)
        const slabGeo = new THREE.BoxGeometry(20, 0.3, 8);
        const slab = new THREE.Mesh(slabGeo, hangarMat);
        slab.position.set(hx, track.getTerrainHeight(hx, hz) - 0.1, hz);
        slab.rotation.y = hp.angle;
        slab.receiveShadow = true;
        track._add(slab);

        // Old Nissen hut shape (semi-cylindrical military building)
        const hutGeo = new THREE.CylinderGeometry(3, 3, 8, 8, 1, false, 0, Math.PI);
        const hutMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.9 });
        const hut = new THREE.Mesh(hutGeo, hutMat);
        hut.position.set(hx + 8, track.getTerrainHeight(hx, hz) + 2, hz);
        hut.rotation.y = hp.angle + Math.PI / 2;
        hut.castShadow = true;
        track._add(hut);
      }
    }

    // ============================================================
    // 9. SPONSOR BOARDS - British GP / F1 sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'BRITISH GP', bg: '#00247d', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'SILVERSTONE', bg: '#00247d', fg: '#cc0000' },
        { name: 'LAND ROVER', bg: '#005a2b', fg: '#ffffff' },
        { name: 'ASTON MARTIN', bg: '#006a4e', fg: '#ffffff' },
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
    // 10. TIRE WALLS - Key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.12, side: 1 },   // Copse exit
        { t: 0.25, side: -1 },  // Between Copse and Maggotts
        { t: 0.35, side: 1 },   // Maggotts-Becketts exit
        { t: 0.50, side: -1 },  // Chapel / Hangar Straight
        { t: 0.65, side: 1 },   // Stowe approach
        { t: 0.75, side: 1 },   // Stowe exit
        { t: 0.85, side: -1 },  // Club corner
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
    // 11. UNION JACK FLAGS - British flags along the pit straight
    // ============================================================
    {
      const flagPositions = [
        { t: 0.01, side: 1 },
        { t: 0.96, side: -1 },
        { t: 0.98, side: 1 },
      ];

      for (const fp of flagPositions) {
        const { pos: fPos, angle: fAngle } = safeOffset(fp.t, hw + 8, fp.side);
        if (!isSafe(fPos.x, fPos.z, 2)) continue;

        // Flag pole
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(fPos.x, fPos.y + 2.5, fPos.z);
        track._add(pole);

        // Union Jack flag
        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128; flagCanvas.height = 96;
        const fCtx = flagCanvas.getContext('2d');
        // Blue background
        fCtx.fillStyle = '#00247d';
        fCtx.fillRect(0, 0, 128, 96);
        // White diagonals
        fCtx.strokeStyle = '#ffffff';
        fCtx.lineWidth = 16;
        fCtx.beginPath();
        fCtx.moveTo(0, 0); fCtx.lineTo(128, 96);
        fCtx.moveTo(128, 0); fCtx.lineTo(0, 96);
        fCtx.stroke();
        // Red diagonals (narrower)
        fCtx.strokeStyle = '#cc0000';
        fCtx.lineWidth = 6;
        fCtx.beginPath();
        fCtx.moveTo(0, 0); fCtx.lineTo(128, 96);
        fCtx.moveTo(128, 0); fCtx.lineTo(0, 96);
        fCtx.stroke();
        // White cross
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(52, 0, 24, 96);
        fCtx.fillRect(0, 36, 128, 24);
        // Red cross
        fCtx.fillStyle = '#cc0000';
        fCtx.fillRect(56, 0, 16, 96);
        fCtx.fillRect(0, 40, 128, 16);
        const flagTex = new THREE.CanvasTexture(flagCanvas);

        const flagGeo = new THREE.PlaneGeometry(2.0, 1.5);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(fPos.x, fPos.y + 4.2, fPos.z);
        flag.rotation.y = fAngle;
        track._add(flag);
      }
    }

    // ============================================================
    // 12. FLOODLIGHT TOWERS - Lighting for evening sessions
    // ============================================================
    {
      const lightPositions = [
        { t: 0.05, side: 1 },
        { t: 0.20, side: -1 },
        { t: 0.40, side: 1 },
        { t: 0.60, side: -1 },
        { t: 0.80, side: 1 },
        { t: 0.92, side: -1 },
      ];

      for (const lp of lightPositions) {
        const { pos } = safeOffset(lp.t, hw + 16, lp.side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const towerH = 16;

        // Tower pole
        const poleGeo = new THREE.CylinderGeometry(0.25, 0.4, towerH, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.4, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + towerH / 2, pos.z);
        pole.castShadow = true;
        track._add(pole);

        // Light bank
        const lightGeo = new THREE.BoxGeometry(4, 1.2, 0.5);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.0, roughness: 0.1
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(pos.x, pos.y + towerH - 0.8, pos.z);
        light.rotation.y = Math.atan2(
          track.spline.getTangentAt(lp.t).x,
          track.spline.getTangentAt(lp.t).z
        );
        track._add(light);

        // Base plate
        const baseGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.5, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(pos.x, pos.y + 0.25, pos.z);
        track._add(base);
      }
    }
}
