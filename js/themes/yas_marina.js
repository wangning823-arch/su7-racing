import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe, createPlaceStand, createPlaceBoard } from '../track-helpers.js';

/**
 * YasMarina Circuit scenery builder
 */
export function buildYasMarinaScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);
  const placeStand = createPlaceStand(track);
  const placeBoard = createPlaceBoard(track);

    // ============================================================
    // 1. W ABU DHABI YAS HOTEL - Iconic hotel spanning the track
    //    Two towers connected by a grid-shell LED canopy
    // ============================================================
    {
      const hotelT = 0.40;
      const { pos: hotelPos, angle: hotelAngle } = safeOffset(hotelT, hw + 0, 1);
      const cosA = Math.cos(hotelAngle), sinA = Math.sin(hotelAngle);

      const towerW = 8, towerD = 10, towerH = 22;
      const tower1Geo = new THREE.BoxGeometry(towerW, towerH, towerD);
      const tower1Mat = new THREE.MeshStandardMaterial({ color: 0x1a1a3a, roughness: 0.2, metalness: 0.7 });
      const tower1 = new THREE.Mesh(tower1Geo, tower1Mat);
      tower1.position.set(
        hotelPos.x + (-hw - 14) * cosA,
        hotelPos.y + towerH / 2,
        hotelPos.z - (-hw - 14) * sinA
      );
      tower1.rotation.y = hotelAngle;
      tower1.castShadow = true;
      tower1.receiveShadow = true;
      track._add(tower1);

      const tower2Geo = new THREE.BoxGeometry(towerW, towerH, towerD);
      const tower2 = new THREE.Mesh(tower2Geo, tower1Mat);
      tower2.position.set(
        hotelPos.x + (hw + 14) * cosA,
        hotelPos.y + towerH / 2,
        hotelPos.z - (hw + 14) * sinA
      );
      tower2.rotation.y = hotelAngle;
      tower2.castShadow = true;
      tower2.receiveShadow = true;
      track._add(tower2);

      // Grid-shell canopy spanning over the track
      const canopySpan = (hw + 14) * 2 + towerW;
      const canopyGeo = new THREE.BoxGeometry(canopySpan, 1.5, towerD + 4);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x222244, roughness: 0.1, metalness: 0.8,
        transparent: true, opacity: 0.7
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(hotelPos.x, hotelPos.y + towerH - 1, hotelPos.z);
      canopy.rotation.y = hotelAngle;
      canopy.castShadow = true;
      track._add(canopy);

      // LED light strips on grid-shell canopy
      const ledColors = [0x4400cc, 0x0066ff, 0xff0066, 0x00ccaa, 0xffcc00, 0xff6600];
      for (let i = 0; i < 8; i++) {
        const frac = (i - 3.5) / 4;
        const ledColor = ledColors[i % ledColors.length];
        const ledGeo = new THREE.BoxGeometry(0.3, 1.8, towerD + 3.5);
        const ledMat = new THREE.MeshStandardMaterial({
          color: ledColor, emissive: ledColor, emissiveIntensity: 1.2, roughness: 0.1
        });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(
          hotelPos.x + frac * (canopySpan / 2 - 1) * cosA,
          hotelPos.y + towerH - 1,
          hotelPos.z - frac * (canopySpan / 2 - 1) * sinA
        );
        led.rotation.y = hotelAngle;
        track._add(led);
      }

      // Transverse LED strips
      for (let i = 0; i < 4; i++) {
        const frac = (i - 1.5) / 2;
        const ledColor = ledColors[(i + 2) % ledColors.length];
        const ledGeo = new THREE.BoxGeometry(canopySpan - 2, 1.8, 0.3);
        const ledMat = new THREE.MeshStandardMaterial({
          color: ledColor, emissive: ledColor, emissiveIntensity: 1.0, roughness: 0.1
        });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(hotelPos.x, hotelPos.y + towerH - 1, hotelPos.z + frac * (towerD + 1));
        led.rotation.y = hotelAngle;
        track._add(led);
      }

      // Windows on both towers
      const windowMat = new THREE.MeshStandardMaterial({
        color: 0xffeeaa, emissive: 0xffeeaa, emissiveIntensity: 0.5, roughness: 0.1
      });
      const winGeo = new THREE.PlaneGeometry(0.8, 0.6);
      for (const tOffset of [-hw - 14, hw + 14]) {
        const floors = Math.floor(towerH / 3);
        const winCols = Math.floor(towerW / 2);
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < winCols; c++) {
            if (Math.random() > 0.5) continue;
            const win = new THREE.Mesh(winGeo, windowMat);
            win.position.set(
              hotelPos.x + tOffset * cosA + (c - winCols / 2 + 0.5) * 2 * cosA + towerD / 2 * sinA,
              hotelPos.y + 2 + f * 3,
              hotelPos.z - tOffset * sinA - (c - winCols / 2 + 0.5) * 2 * sinA + towerD / 2 * cosA
            );
            win.rotation.y = hotelAngle;
            track._add(win);
          }
        }
      }

      // Hotel sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512; signCanvas.height = 64;
      const signCtx = signCanvas.getContext('2d');
      signCtx.fillStyle = '#1a1a3a';
      signCtx.fillRect(0, 0, 512, 64);
      signCtx.fillStyle = '#c0a060';
      signCtx.font = 'bold 40px Arial';
      signCtx.textAlign = 'center';
      signCtx.textBaseline = 'middle';
      signCtx.fillText('W ABU DHABI - YAS ISLAND', 256, 32);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signGeo = new THREE.PlaneGeometry(14, 2);
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.2, metalness: 0.5 });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(hotelPos.x, hotelPos.y + towerH + 2, hotelPos.z);
      sign.rotation.y = hotelAngle;
      track._add(sign);
    }

    // ============================================================
    // 2. MARINA / WATERFRONT - Yas Marina harbor with luxury yachts
    // ============================================================
    {
      const waterT = 0.65;
      const { pos: waterPos, angle: waterAngle } = safeOffset(waterT, hw + 55, -1);

      const waterGeo = new THREE.PlaneGeometry(140, 40);
      waterGeo.rotateX(-Math.PI / 2);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x1a5580, roughness: 0.05, metalness: 0.3,
        transparent: true, opacity: 0.75
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.position.set(waterPos.x, -1.5, waterPos.z);
      track._add(water);

      const wallGeo = new THREE.BoxGeometry(150, 1.5, 2);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(waterPos.x, -0.5, waterPos.z - 22);
      wall.rotation.y = waterAngle;
      track._add(wall);

      const dockGeo = new THREE.BoxGeometry(50, 0.3, 5);
      const dockMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 });
      const dock = new THREE.Mesh(dockGeo, dockMat);
      dock.position.set(waterPos.x, -0.5, waterPos.z + 15);
      dock.rotation.y = waterAngle;
      track._add(dock);

      const dock2Geo = new THREE.BoxGeometry(45, 0.3, 4);
      const dock2 = new THREE.Mesh(dock2Geo, dockMat);
      dock2.position.set(waterPos.x + 5, -0.5, waterPos.z + 28);
      dock2.rotation.y = waterAngle;
      track._add(dock2);

      const yachtColors = [0xffffff, 0xf0f0f0, 0xe8e8e8, 0xd4d4d4, 0xf5f5f0];
      for (let i = 0; i < 10; i++) {
        const yachtW = 4 + Math.random() * 6;
        const yachtH = 1.2 + Math.random() * 0.8;
        const yachtD = 1.5 + Math.random() * 1.2;
        const yachtGeo = new THREE.BoxGeometry(yachtW, yachtH, yachtD);
        const yachtMat = new THREE.MeshStandardMaterial({
          color: yachtColors[i % yachtColors.length], roughness: 0.3, metalness: 0.2
        });
        const yacht = new THREE.Mesh(yachtGeo, yachtMat);
        const row = Math.floor(i / 5);
        const col = i % 5;
        const offsetX = (col - 2) * 10;
        const offsetZ = row * 13;
        yacht.position.set(
          waterPos.x + offsetX * Math.cos(waterAngle),
          -0.1,
          waterPos.z + 15 + offsetX * Math.sin(waterAngle) + offsetZ * Math.cos(waterAngle)
        );
        yacht.rotation.y = waterAngle + (Math.random() - 0.5) * 0.2;
        yacht.castShadow = true;
        track._add(yacht);

        if (yachtW > 5) {
          const cabinGeo = new THREE.BoxGeometry(yachtW * 0.35, 1.0, yachtD * 0.7);
          const cabinMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.2 });
          const cabin = new THREE.Mesh(cabinGeo, cabinMat);
          cabin.position.set(
            yacht.position.x + 0.3 * Math.cos(yacht.rotation.y),
            0.8,
            yacht.position.z - 0.3 * Math.sin(yacht.rotation.y)
          );
          cabin.rotation.y = yacht.rotation.y;
          track._add(cabin);
        }
      }
    }

    // ============================================================
    // 3. YAS MARINA CIRCUIT TOWER - Observation/control tower
    // ============================================================
    {
      const towerT = 0.18;
      const { pos: cTowerPos, angle: cTowerAngle } = safeOffset(towerT, hw + 35, -1);
      if (isSafe(cTowerPos.x, cTowerPos.z, 10)) {
        const cTowerH = 28;

        const shaftGeo = new THREE.CylinderGeometry(1.5, 2, cTowerH, 8);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x333355, roughness: 0.3, metalness: 0.6 });
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.position.set(cTowerPos.x, cTowerPos.y + cTowerH / 2, cTowerPos.z);
        shaft.castShadow = true;
        track._add(shaft);

        const deckGeo = new THREE.CylinderGeometry(4, 4, 3, 12);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.2, metalness: 0.7 });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(cTowerPos.x, cTowerPos.y + cTowerH + 1.5, cTowerPos.z);
        deck.castShadow = true;
        track._add(deck);

        const crownGeo = new THREE.TorusGeometry(4.2, 0.3, 8, 16);
        const crownMat = new THREE.MeshStandardMaterial({
          color: 0xc0a060, emissive: 0xc0a060, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.7
        });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(cTowerPos.x, cTowerPos.y + cTowerH + 3.2, cTowerPos.z);
        crown.rotation.x = Math.PI / 2;
        track._add(crown);

        const spireGeo = new THREE.CylinderGeometry(0.05, 0.15, 6, 6);
        const spireMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.set(cTowerPos.x, cTowerPos.y + cTowerH + 6, cTowerPos.z);
        track._add(spire);

        const beaconGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.5 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(cTowerPos.x, cTowerPos.y + cTowerH + 9.2, cTowerPos.z);
        track._add(beacon);
      }
    }

    // ============================================================
    // 4. MAIN GRANDSTAND & PIT BUILDING
    // ============================================================
    placeStand(0.03, hw + 20, 1, 42, 9, 9, 0x333344, 0x1a1a3a);

    {
      const { pos, angle } = safeOffset(0.06, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 38, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        track._add(pit);

        const garageColors = [0x1a1a3a, 0x2a2a4a, 0x1a1a3a, 0xc0a060, 0x1a1a3a];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.8, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.8;
          g.position.set(pos.x + localX * cosA - (pitD / 2) * sinA, pos.y + 0.5, pos.z - localX * sinA + (pitD / 2) * cosA);
          g.rotation.y = angle;
          track._add(g);
        }

        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#1a1a3a';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#c0a060';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('YAS MARINA CIRCUIT - ABU DHABI GP', 256, 32);
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
    // 5. SECONDARY GRANDSTANDS
    // ============================================================
    placeStand(0.15, hw + 18, -1, 26, 7, 7, 0x333344, 0xc0a060);
    placeStand(0.25, hw + 20, 1, 22, 5, 6, 0x2a3a4a, 0x666677);
    placeStand(0.55, hw + 18, -1, 28, 7, 7, 0x3a3a4a, 0x1a1a3a);
    placeStand(0.75, hw + 20, 1, 24, 6, 6, 0x2a3a4a, 0xc0a060);
    placeStand(0.90, hw + 18, -1, 30, 8, 8, 0x333344, 0x1a1a3a);

    // ============================================================
    // 6. SUNSET LIGHTING EFFECTS - Warm ambient glow
    // ============================================================
    {
      const warmLightPositions = [
        { t: 0.10, side: 1 }, { t: 0.25, side: -1 }, { t: 0.40, side: 1 },
        { t: 0.55, side: -1 }, { t: 0.70, side: 1 }, { t: 0.85, side: -1 },
      ];
      for (const sl of warmLightPositions) {
        const { pos } = safeOffset(sl.t, hw + 25, sl.side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 6, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 3, pos.z);
        track._add(pole);

        const lightGeo = new THREE.SphereGeometry(0.4, 8, 8);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xffdd88, emissive: 0xffaa44, emissiveIntensity: 1.5, roughness: 0.1
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(pos.x, pos.y + 6.2, pos.z);
        track._add(light);

        const glowGeo = new THREE.CircleGeometry(4, 16);
        glowGeo.rotateX(-Math.PI / 2);
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.15, roughness: 0.1
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(pos.x, pos.y + 0.1, pos.z);
        track._add(glow);
      }
    }

    // ============================================================
    // 7. PALM TREES - Abu Dhabi coastal vegetation
    // ============================================================
    {
      const palmCount = 40;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 5.5, 6);
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
        let x, z, attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (track.distToTrack(x, z) < 18 && attempts < 50);

        const y = track.getTerrainHeight(x, z);
        const scale = 0.8 + Math.random() * 0.6;
        dummy.position.set(x, y + 2.8 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + 6.0 * scale, z);
        dummy.scale.set(scale * 1.2, scale * 0.8, scale * 1.2);
        dummy.updateMatrix();
        if (i < palmCount * 0.6) canopy1.setMatrixAt(idx1++, dummy.matrix);
        else canopy2.setMatrixAt(idx2++, dummy.matrix);
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
    // 8. SPONSOR BOARDS - Abu Dhabi GP / F1 sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'ABU DHABI GP', bg: '#1a1a3a', fg: '#c0a060' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'ETIHAD', bg: '#c0a060', fg: '#1a1a3a' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'YAS ISLAND', bg: '#1a1a3a', fg: '#ff6600' },
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
    // 9. TIRE WALLS - Key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const tirePositions = [
        { t: 0.10, side: -1 }, { t: 0.20, side: 1 }, { t: 0.35, side: -1 },
        { t: 0.50, side: 1 }, { t: 0.65, side: -1 }, { t: 0.78, side: 1 }, { t: 0.92, side: -1 },
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
    // 10. ARABIAN DECORATIVE PYLONS
    // ============================================================
    {
      for (let i = 0; i < 8; i++) {
        const t = (i + 0.5) / 8;
        const side = i % 2 === 0 ? 1 : -1;
        const { pos } = safeOffset(t, hw + 30, side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const pylonGeo = new THREE.CylinderGeometry(0.2, 0.3, 8, 6);
        const pylonMat = new THREE.MeshStandardMaterial({ color: 0xc0a060, roughness: 0.3, metalness: 0.6 });
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.set(pos.x, pos.y + 4, pos.z);
        pylon.castShadow = true;
        track._add(pylon);

        const topGeo = new THREE.CylinderGeometry(0.8, 0.5, 1.5, 8);
        const topMat = new THREE.MeshStandardMaterial({
          color: 0xc0a060, emissive: 0xc0a060, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.7
        });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.set(pos.x, pos.y + 8.8, pos.z);
        track._add(top);
      }
    }
}
