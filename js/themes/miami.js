import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * Miami Circuit scenery builder
 */
export function buildMiamiScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. STADIUM STRUCTURE - Hard Rock Stadium style
    //    Iconic Miami GP feature: the circuit wraps around the stadium
    // ============================================================
    {
      const stadiumT = 0.85;
      const { pos: stadiumPos, angle: stadiumAngle } = safeOffset(stadiumT, hw + 55, 1);

      // Main stadium body (elliptical approximated as large cylinder)
      const stadiumGeo = new THREE.CylinderGeometry(25, 25, 12, 16);
      const stadiumMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.3 });
      const stadium = new THREE.Mesh(stadiumGeo, stadiumMat);
      stadium.position.set(stadiumPos.x, stadiumPos.y + 6, stadiumPos.z);
      stadium.castShadow = true;
      track._add(stadium);

      // Stadium ring (top edge) - teal accent
      const ringGeo = new THREE.TorusGeometry(25, 0.8, 8, 24);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x00838f, roughness: 0.3, metalness: 0.5 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(stadiumPos.x, stadiumPos.y + 12, stadiumPos.z);
      ring.rotation.x = Math.PI / 2;
      track._add(ring);

      // Stadium roof (partial dome segments)
      const roofSegGeo = new THREE.BoxGeometry(50, 0.6, 20);
      const roofSegMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.2 });
      for (let i = 0; i < 4; i++) {
        const rAngle = (i / 4) * Math.PI * 2;
        const roofSeg = new THREE.Mesh(roofSegGeo, roofSegMat);
        roofSeg.position.set(
          stadiumPos.x + Math.cos(rAngle) * 15,
          stadiumPos.y + 13,
          stadiumPos.z + Math.sin(rAngle) * 15
        );
        roofSeg.rotation.y = stadiumAngle + rAngle;
        roofSeg.castShadow = true;
        track._add(roofSeg);
      }

      // Stadium floodlights (distinctive Miami feature)
      const lightPoleGeo = new THREE.CylinderGeometry(0.2, 0.3, 20, 6);
      const lightPoleMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.4, metalness: 0.6 });
      for (let i = 0; i < 4; i++) {
        const lAngle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const lx = stadiumPos.x + Math.cos(lAngle) * 28;
        const lz = stadiumPos.z + Math.sin(lAngle) * 28;
        const pole = new THREE.Mesh(lightPoleGeo, lightPoleMat);
        pole.position.set(lx, stadiumPos.y + 10, lz);
        pole.castShadow = true;
        track._add(pole);

        // Light bank
        const lightGeo = new THREE.BoxGeometry(4, 1.2, 0.5);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.8, roughness: 0.1
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(lx, stadiumPos.y + 20.5, lz);
        light.rotation.y = stadiumAngle;
        track._add(light);
      }

      // Stadium sign - "MIAMI GRAND PRIX"
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512; signCanvas.height = 64;
      const signCtx = signCanvas.getContext('2d');
      signCtx.fillStyle = '#00838f';
      signCtx.fillRect(0, 0, 512, 64);
      signCtx.fillStyle = '#ffffff';
      signCtx.font = 'bold 42px Arial';
      signCtx.textAlign = 'center';
      signCtx.textBaseline = 'middle';
      signCtx.fillText('MIAMI GRAND PRIX', 256, 32);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signGeo = new THREE.PlaneGeometry(16, 2);
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(stadiumPos.x, stadiumPos.y + 13, stadiumPos.z);
      sign.rotation.y = stadiumAngle;
      track._add(sign);
    }

    // ============================================================
    // 2. GRANDSTANDS - Multiple spectator stands
    // ============================================================
    placeStand(0.03, hw + 20, 1, 35, 8, 8, 0x333344, 0x00838f);

    // Pit building - opposite side (t=0.06)
    {
      const { pos, angle } = safeOffset(0.06, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 32, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        // Pit garages with Miami colors (teal + orange + white)
        const garageColors = [0x00838f, 0xff6d00, 0xffffff, 0x00838f, 0xff6d00];
        for (let i = 0; i < 8; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 3.5) * 3.8;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          track._add(g);
        }
      }
    }

    // Secondary stands at key corners
    placeStand(0.20, hw + 18, -1, 25, 6, 6, 0x333344, 0xff6d00);
    placeStand(0.40, hw + 18, 1, 22, 5, 6, 0x2a3a4a, 0x666677);
    placeStand(0.60, hw + 20, -1, 28, 7, 7, 0x3a3a4a, 0x00838f);
    placeStand(0.80, hw + 18, 1, 20, 5, 6, 0x2a3a4a, 0x666677);

    // ============================================================
    // 3. PALM TREES - Abundant tropical palms (Florida signature)
    // ============================================================
    {
      const palmCount = 60;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 5.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });

      const canopyGeo1 = new THREE.ConeGeometry(2.5, 2.0, 6);
      const canopyGeo2 = new THREE.ConeGeometry(2.0, 2.5, 8);
      const canopyMat1 = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
      const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.8 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
      const canopy1 = new THREE.InstancedMesh(canopyGeo1, canopyMat1, Math.floor(palmCount * 0.6));
      const canopy2 = new THREE.InstancedMesh(canopyGeo2, canopyMat2, Math.ceil(palmCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = track.trackBounds ? Math.max(400, track.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = track.trackBounds ? Math.max(400, track.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < palmCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 16 && attempts < 50);

        const y = track.getTerrainHeight(x, z);
        const scale = 0.8 + Math.random() * 0.6;

        // Trunk
        dummy.position.set(x, y + 2.5 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        // Palm canopy
        dummy.position.set(x, y + 5.5 * scale, z);
        dummy.scale.set(scale * 1.2, scale * 0.8, scale * 1.2);
        dummy.updateMatrix();
        if (i < palmCount * 0.6) {
          canopy1.setMatrixAt(idx1++, dummy.matrix);
        } else {
          canopy2.setMatrixAt(idx2++, dummy.matrix);
        }
      }

      trunkMesh.instanceMatrix.needsUpdate = true;
      canopy1.count = idx1;
      canopy1.instanceMatrix.needsUpdate = true;
      canopy2.count = idx2;
      canopy2.instanceMatrix.needsUpdate = true;
      track._add(trunkMesh);
      track._add(canopy1);
      track._add(canopy2);
    }

    // ============================================================
    // 4. WATERFRONT / MARINA - Miami is a coastal city
    // ============================================================
    {
      const waterGeo = new THREE.PlaneGeometry(120, 30);
      waterGeo.rotateX(-Math.PI / 2);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x1a6b8a, roughness: 0.1, metalness: 0.3,
        transparent: true, opacity: 0.7
      });
      const water = new THREE.Mesh(waterGeo, waterMat);

      const waterT = 0.5;
      const { pos: waterPos, angle: waterAngle } = safeOffset(waterT, hw + 70, -1);
      water.position.set(waterPos.x, -1.5, waterPos.z);
      track._add(water);

      // Dock / pier
      const dockGeo = new THREE.BoxGeometry(40, 0.3, 6);
      const dockMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 });
      const dock = new THREE.Mesh(dockGeo, dockMat);
      dock.position.set(waterPos.x, -0.7, waterPos.z + 18);
      dock.rotation.y = waterAngle;
      track._add(dock);

      // Yachts / boats on the marina
      const boatColors = [0xffffff, 0xf5f5f5, 0xe8e8e8, 0xdcdcdc];
      for (let i = 0; i < 6; i++) {
        const boatW = 3 + Math.random() * 4;
        const boatH = 1.0 + Math.random() * 0.5;
        const boatD = 1.5 + Math.random() * 1;
        const boatGeo = new THREE.BoxGeometry(boatW, boatH, boatD);
        const boatMat = new THREE.MeshStandardMaterial({
          color: boatColors[i % boatColors.length], roughness: 0.4, metalness: 0.2
        });
        const boat = new THREE.Mesh(boatGeo, boatMat);
        const offsetX = (i - 2.5) * 8;
        const cosA = Math.cos(waterAngle), sinA = Math.sin(waterAngle);
        boat.position.set(
          waterPos.x + offsetX * cosA,
          -0.2,
          waterPos.z + 18 + offsetX * sinA
        );
        boat.rotation.y = waterAngle;
        boat.castShadow = true;
        track._add(boat);

        // Cabin on larger boats
        if (boatW > 4) {
          const cabinGeo = new THREE.BoxGeometry(boatW * 0.4, 1.2, boatD * 0.8);
          const cabinMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 });
          const cabin = new THREE.Mesh(cabinGeo, cabinMat);
          cabin.position.set(
            waterPos.x + offsetX * cosA,
            0.5,
            waterPos.z + 18 + offsetX * sinA
          );
          cabin.rotation.y = waterAngle;
          track._add(cabin);
        }
      }
    }

    // ============================================================
    // 5. LUXURY HOTELS / CONDOS - Miami Beach style buildings
    // ============================================================
    {
      const hotelColors = [0xf5e6d3, 0xe8d5b7, 0xf0e0c8, 0xdcc8a8, 0xfff5ee];
      const hotelCount = 6;
      for (let i = 0; i < hotelCount; i++) {
        const ang = (i / hotelCount) * Math.PI * 2 + 0.5;
        const r = 80 + Math.random() * 30;
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        if (track.distToTrack(x, z) < hw + 25) continue;

        const w = 8 + Math.random() * 6;
        const d = 8 + Math.random() * 6;
        const h = 12 + Math.random() * 15;

        const bodyGeo = new THREE.BoxGeometry(w, h, d);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: hotelColors[i % hotelColors.length], roughness: 0.5, metalness: 0.1
        });
        const building = new THREE.Mesh(bodyGeo, bodyMat);
        building.position.set(x, h / 2 - 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        track._add(building);

        // Windows
        const windowMat = new THREE.MeshStandardMaterial({
          color: 0x87ceeb, emissive: 0x87ceeb, emissiveIntensity: 0.2,
          roughness: 0.1, metalness: 0.5
        });
        const winGeo = new THREE.PlaneGeometry(0.8, 0.6);
        const floors = Math.floor(h / 3);
        const winCols = Math.floor(w / 2);
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < winCols; c++) {
            if (Math.random() > 0.5) continue;
            const win = new THREE.Mesh(winGeo, windowMat);
            win.position.set(
              x - w / 2 + 1 + c * 2,
              1 + f * 3,
              z + d / 2 + 0.05
            );
            track._add(win);
          }
        }

        // Rooftop pool
        if (Math.random() > 0.4) {
          const poolGeo = new THREE.PlaneGeometry(w * 0.6, d * 0.6);
          poolGeo.rotateX(-Math.PI / 2);
          const poolMat = new THREE.MeshStandardMaterial({
            color: 0x00bfff, roughness: 0.05, metalness: 0.1,
            transparent: true, opacity: 0.8
          });
          const pool = new THREE.Mesh(poolGeo, poolMat);
          pool.position.set(x, h - 2 + 0.1, z);
          track._add(pool);
        }
      }
    }

    // ============================================================
    // 6. PALM TREE GROVES - Clustered along straights
    // ============================================================
    {
      const grovePositions = [
        { t: 0.10, side: 1 },
        { t: 0.30, side: -1 },
        { t: 0.50, side: 1 },
        { t: 0.70, side: -1 },
        { t: 0.90, side: 1 },
      ];

      for (const gp of grovePositions) {
        const { pos } = safeOffset(gp.t, hw + 30, gp.side);
        if (!isSafe(pos.x, pos.z, 10)) continue;

        const clusterCount = 4 + Math.floor(Math.random() * 4);
        for (let j = 0; j < clusterCount; j++) {
          const cx = pos.x + (Math.random() - 0.5) * 12;
          const cz = pos.z + (Math.random() - 0.5) * 12;
          if (track.distToTrack(cx, cz) < hw + 12) continue;

          const cy = track.getTerrainHeight(cx, cz);
          const scale = 0.9 + Math.random() * 0.5;

          const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 6 * scale, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.set(cx, cy + 3 * scale, cz);
          track._add(trunk);

          const canopyGeo = new THREE.ConeGeometry(2.2 * scale, 1.8 * scale, 6);
          const canopyMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
          const canopy = new THREE.Mesh(canopyGeo, canopyMat);
          canopy.position.set(cx, cy + 6.5 * scale, cz);
          track._add(canopy);
        }
      }
    }

    // ============================================================
    // 7. SPONSOR BOARDS - Miami GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MIAMI GP', bg: '#00838f', fg: '#ffffff' },
        { name: 'F1', bg: '#e10600', fg: '#ffffff' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#ff6d00', fg: '#ffffff' },
      ];

      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;

        if (track.distToTrack(x, z) < hw + 8) continue;

        placeBoard(t, dist, side, sponsors[i % sponsors.length]);
      }
    }

    // ============================================================
    // 8. TIRE WALLS - At corner exits
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
    // 9. BEACH / SAND DUNES - Coastal landscaping
    // ============================================================
    {
      const sandGeo = new THREE.SphereGeometry(3, 8, 6);
      const sandMat = new THREE.MeshStandardMaterial({ color: 0xf5deb3, roughness: 1.0 });
      const sandCount = 15;

      for (let i = 0; i < sandCount; i++) {
        const t = Math.random();
        const p = track.spline.getPointAt(t);
        const tangent = track.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 25 + Math.random() * 35;
        const sx = p.x + right.x * dist * side;
        const sz = p.z + right.z * dist * side;
        if (track.distToTrack(sx, sz) < hw + 20) continue;

        const dune = new THREE.Mesh(sandGeo, sandMat);
        const scale = 0.4 + Math.random() * 1.2;
        dune.position.set(sx, track.getTerrainHeight(sx, sz) - 0.3, sz);
        dune.scale.set(scale * (1 + Math.random()), scale * 0.3, scale * (1 + Math.random()));
        track._add(dune);
      }
    }
}
