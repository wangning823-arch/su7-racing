import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSafeOffset, createIsSafe } from '../track-helpers.js';

/**
 * City Streets scenery builder — realistic urban environment
 * Features: modern buildings with glass facades, streetlights, sidewalks,
 * traffic lights, street trees, urban furniture, road markings
 */
export function buildCityStreetsScenery(track) {
  const hw = (track._trackWidth || CONFIG.trackWidth) / 2;
  const safeOffset = createSafeOffset(track);
  const isSafe = createIsSafe(track);

  _buildRealisticBuildings(track, hw, safeOffset, isSafe);
  _buildSidewalks(track, hw);
  _buildStreetlights(track, hw, safeOffset, isSafe);
  _buildTrafficLights(track, hw, safeOffset, isSafe);
  _buildStreetTrees(track, hw, safeOffset, isSafe);
  _buildUrbanFurniture(track, hw, safeOffset, isSafe);
  _buildRoadMarkings(track, hw);
  _buildShopSigns(track, hw, safeOffset, isSafe);
}

// ----------------------------------------------------------
// BUILDINGS — Modern urban architecture with glass facades
// ----------------------------------------------------------
function _buildRealisticBuildings(track, hw, safeOffset, isSafe) {
  const b = track.trackBounds;
  const buildRangeX = b ? Math.max(400, b.width + 200) / 2 : 200;
  const buildRangeZ = b ? Math.max(400, b.depth + 200) / 2 : 200;
  const count = 100;

  // Building style palettes — each gives a different architectural feel
  const styles = [
    // Modern glass office tower
    {
      bodyColor: 0x2a3a4a, roughness: 0.2, metalness: 0.7,
      glassColor: 0x88aacc, glassEmissive: 0x445566,
      minH: 25, maxH: 55, minW: 8, maxW: 16,
      hasCornice: true, hasRoofDetail: true
    },
    // Residential apartment block
    {
      bodyColor: 0x8a7a6a, roughness: 0.8, metalness: 0.1,
      glassColor: 0xaabbcc, glassEmissive: 0x334455,
      minH: 12, maxH: 28, minW: 10, maxW: 18,
      hasCornice: false, hasRoofDetail: true, hasBalconies: true
    },
    // Concrete commercial building
    {
      bodyColor: 0x6a6a6a, roughness: 0.9, metalness: 0.05,
      glassColor: 0x99aabb, glassEmissive: 0x334455,
      minH: 8, maxH: 20, minW: 12, maxW: 22,
      hasCornice: true, hasRoofDetail: false
    },
    // Dark steel & glass skyscraper
    {
      bodyColor: 0x1a2a3a, roughness: 0.15, metalness: 0.8,
      glassColor: 0x6699bb, glassEmissive: 0x223344,
      minH: 30, maxH: 60, minW: 8, maxW: 14,
      hasCornice: true, hasRoofDetail: true
    },
    // Brick residential
    {
      bodyColor: 0x8b4513, roughness: 0.85, metalness: 0.05,
      glassColor: 0x99aacc, glassEmissive: 0x223344,
      minH: 10, maxH: 22, minW: 10, maxW: 16,
      hasCornice: false, hasRoofDetail: false, hasBalconies: true
    },
  ];

  // Cache window grid textures by resolution
  const windowTextures = {};
  function getWindowTexture(cols, rows, litRatio) {
    const key = `${cols}_${rows}_${Math.round(litRatio * 10)}`;
    if (windowTextures[key]) return windowTextures[key];

    const canvas = document.createElement('canvas');
    const winW = 48, winH = 64;
    canvas.width = cols * winW;
    canvas.height = rows * winH;
    const ctx = canvas.getContext('2d');

    // Building face background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * winW + 4;
        const y = r * winH + 6;
        const w = winW - 8;
        const h = winH - 12;

        if (Math.random() < litRatio) {
          // Lit window — warm yellow/orange with slight variation
          const warmth = Math.random();
          const rr = 200 + Math.floor(warmth * 55);
          const gg = 170 + Math.floor(warmth * 60);
          const bb = 100 + Math.floor(warmth * 40);
          ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
          ctx.fillRect(x, y, w, h);
          // Window frame
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
          // Cross divider
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w / 2, y + h);
          ctx.moveTo(x, y + h / 2);
          ctx.lineTo(x + w, y + h / 2);
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.stroke();
        } else {
          // Dark window — reflective blue-gray
          const shade = 30 + Math.floor(Math.random() * 20);
          ctx.fillStyle = `rgb(${shade + 10},${shade + 15},${shade + 30})`;
          ctx.fillRect(x, y, w, h);
          // Subtle reflection highlight
          ctx.fillStyle = 'rgba(100,130,170,0.15)';
          ctx.fillRect(x + 2, y + 2, w * 0.4, h * 0.3);
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    windowTextures[key] = tex;
    return tex;
  }

  const placedBuildings = [];
  const minBuildingGap = 4;

  for (let i = 0; i < count; i++) {
    const style = styles[Math.floor(Math.random() * styles.length)];
    const w = style.minW + Math.random() * (style.maxW - style.minW);
    const d = style.minW + Math.random() * (style.maxW - style.minW);
    const h = style.minH + Math.random() * (style.maxH - style.minH);
    const actualHalfSize = Math.max(w, d) / 2;
    const requiredDist = hw + actualHalfSize + 12;

    let x, z, valid = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      x = (Math.random() - 0.5) * buildRangeX * 2;
      z = (Math.random() - 0.5) * buildRangeZ * 2;
      if (track.distToTrack(x, z) < requiredDist) continue;
      let tooClose = false;
      for (const pb of placedBuildings) {
        const dx = x - pb.x, dz = z - pb.z;
        if (Math.abs(dx) < minBuildingGap + (pb.w + w) / 2 &&
            Math.abs(dz) < minBuildingGap + (pb.d + d) / 2) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) { valid = true; break; }
    }
    if (!valid) continue;
    placedBuildings.push({ x, z, w, d, h });

    // --- Main building body ---
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: style.bodyColor, roughness: style.roughness, metalness: style.metalness
    });
    const building = new THREE.Mesh(geo, mat);
    building.position.set(x, h / 2 - 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    track._add(building);

    // --- Window grid textures on all 4 faces ---
    const winCols = Math.max(2, Math.floor(w / 2.5));
    const winRows = Math.max(2, Math.floor(h / 3.5));
    const litRatio = 0.3 + Math.random() * 0.4;
    const winTexF = getWindowTexture(winCols, winRows, litRatio);
    const winTexS = getWindowTexture(Math.max(2, Math.floor(d / 2.5)), winRows, litRatio);

    const frontGeo = new THREE.PlaneGeometry(w * 0.92, h * 0.92);
    const winMatF = new THREE.MeshStandardMaterial({ map: winTexF, roughness: 0.2, metalness: 0.6 });
    const winMatS = new THREE.MeshStandardMaterial({ map: winTexS, roughness: 0.2, metalness: 0.6 });

    const front = new THREE.Mesh(frontGeo, winMatF);
    front.position.set(x, h / 2 - 2, z + d / 2 + 0.06);
    track._add(front);

    const back = new THREE.Mesh(frontGeo, winMatF);
    back.position.set(x, h / 2 - 2, z - d / 2 - 0.06);
    back.rotation.y = Math.PI;
    track._add(back);

    const sideGeo = new THREE.PlaneGeometry(d * 0.92, h * 0.92);
    const s1 = new THREE.Mesh(sideGeo, winMatS);
    s1.position.set(x + w / 2 + 0.06, h / 2 - 2, z);
    s1.rotation.y = Math.PI / 2;
    track._add(s1);
    const s2 = new THREE.Mesh(sideGeo, winMatS);
    s2.position.set(x - w / 2 - 0.06, h / 2 - 2, z);
    s2.rotation.y = -Math.PI / 2;
    track._add(s2);

    // --- Glass curtain wall overlay (semi-transparent reflective) ---
    const glassMat = new THREE.MeshStandardMaterial({
      color: style.glassColor, emissive: style.glassEmissive,
      emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.8,
      transparent: true, opacity: 0.7
    });
    const curtainGeo = new THREE.PlaneGeometry(w * 0.88, h * 0.85);
    const curtain = new THREE.Mesh(curtainGeo, glassMat);
    curtain.position.set(x, h / 2 - 2, z + d / 2 + 0.1);
    track._add(curtain);

    // --- Cornice / ledge at top ---
    if (style.hasCornice) {
      const corniceGeo = new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6);
      const corniceMat = new THREE.MeshStandardMaterial({
        color: style.bodyColor, roughness: 0.5, metalness: 0.3
      });
      const cornice = new THREE.Mesh(corniceGeo, corniceMat);
      cornice.position.set(x, h - 1.8, z);
      cornice.castShadow = true;
      track._add(cornice);
    }

    // --- Roof details (AC units, water tanks) ---
    if (style.hasRoofDetail && Math.random() > 0.4) {
      const acGeo = new THREE.BoxGeometry(1.5 + Math.random(), 1, 1 + Math.random());
      const acMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.4 });
      const ac = new THREE.Mesh(acGeo, acMat);
      ac.position.set(x + (Math.random() - 0.5) * w * 0.5, h - 1.3, z + (Math.random() - 0.5) * d * 0.5);
      track._add(ac);
      const fanGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12);
      const fanMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6 });
      const fan = new THREE.Mesh(fanGeo, fanMat);
      fan.position.set(ac.position.x, ac.position.y + 0.53, ac.position.z);
      track._add(fan);
    }

    // --- Balconies for residential buildings ---
    if (style.hasBalconies && h > 12) {
      const balconyMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.7, metalness: 0.2 });
      const floors = Math.floor(h / 4);
      const balconyCols = Math.floor(w / 3);
      for (let f = 1; f < Math.min(floors, 6); f++) {
        for (let c = 0; c < balconyCols; c++) {
          if (Math.random() > 0.6) continue;
          const bGeo = new THREE.BoxGeometry(2.2, 0.15, 1.2);
          const balcony = new THREE.Mesh(bGeo, balconyMat);
          balcony.position.set(x - w / 2 + 2 + c * 3, f * 4 - 1, z + d / 2 + 0.6);
          track._add(balcony);
          const railGeo = new THREE.BoxGeometry(2.2, 0.6, 0.05);
          const rail = new THREE.Mesh(railGeo, balconyMat);
          rail.position.set(x - w / 2 + 2 + c * 3, f * 4 - 0.5, z + d / 2 + 1.2);
          track._add(rail);
        }
      }
    }
  }
}

// ----------------------------------------------------------
// SIDEWALKS — Raised concrete along road edges
// ----------------------------------------------------------
function _buildSidewalks(track, hw) {
  const segs = 300;
  const frames = track.spline.computeFrenetFrames(segs, true);
  const sidewalkW = 2.5;
  const sidewalkH = 0.25;
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.85, metalness: 0.05 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.7, metalness: 0.1 });

  for (let side of [-1, 1]) {
    // Sidewalk surface
    const verts = [], uvs = [], indices = [];
    for (let i = 0; i <= segs; i++) {
      const p = track.spline.getPointAt(i / segs);
      const bin = frames.binormals[i];
      const inner = p.clone().add(bin.clone().multiplyScalar(hw * side));
      const outer = p.clone().add(bin.clone().multiplyScalar((hw + sidewalkW) * side));
      verts.push(inner.x, inner.y + 0.06, inner.z, outer.x, outer.y + sidewalkH, outer.z);
      uvs.push(0, i / segs * 100, 1, i / segs * 100);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1;
      const c = ((i + 1) % (segs + 1)) * 2, d = c + 1;
      if (side === -1) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, sidewalkMat);
    mesh.receiveShadow = true;
    track._add(mesh);

    // Curb stones — thin raised strip at road boundary
    const curbVerts = [], curbIndices = [];
    const curbH = 0.15;
    for (let i = 0; i <= segs; i++) {
      const p = track.spline.getPointAt(i / segs);
      const bin = frames.binormals[i];
      const cp = p.clone().add(bin.clone().multiplyScalar(hw * side));
      curbVerts.push(cp.x, cp.y + 0.06, cp.z, cp.x, cp.y + 0.06 + curbH, cp.z);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1, c = (i + 1) * 2, d = c + 1;
      if (side === -1) curbIndices.push(a, b, c, b, d, c);
      else curbIndices.push(a, c, b, b, c, d);
    }
    const curbGeo = new THREE.BufferGeometry();
    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
    curbGeo.setIndex(curbIndices);
    curbGeo.computeVertexNormals();
    const curbMesh = new THREE.Mesh(curbGeo, curbMat);
    curbMesh.receiveShadow = true;
    track._add(curbMesh);
  }
}

// ----------------------------------------------------------
// STREETLIGHTS — Modern LED lamp posts
// ----------------------------------------------------------
function _buildStreetlights(track, hw, safeOffset, isSafe) {
  const count = 40;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.4, metalness: 0.7 });
  const armMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.4, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffee, emissive: 0xffeebb, emissiveIntensity: 1.5, roughness: 0.1
  });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.6, metalness: 0.3 });

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const side = i % 2 === 0 ? 1 : -1;
    const { pos, angle } = safeOffset(t, hw + 3.5, side);
    if (!isSafe(pos.x, pos.z, 2)) continue;

    const poleH = 6;
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, poleH, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(pos.x, pos.y + poleH / 2, pos.z);
    pole.castShadow = true;
    track._add(pole);

    // Curved arm extending toward road center
    const armLen = 2.5;
    const armDir = side === 1 ? -1 : 1;
    const armGeo = new THREE.BoxGeometry(armLen, 0.1, 0.1);
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(
      pos.x + armDir * armLen / 2 * Math.cos(angle),
      pos.y + poleH,
      pos.z + armDir * armLen / 2 * Math.sin(angle)
    );
    arm.rotation.y = angle;
    track._add(arm);

    // LED lamp head
    const lampGeo = new THREE.BoxGeometry(0.8, 0.15, 0.4);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(
      pos.x + armDir * armLen * Math.cos(angle),
      pos.y + poleH - 0.1,
      pos.z + armDir * armLen * Math.sin(angle)
    );
    lamp.rotation.y = angle;
    track._add(lamp);

    // Base plate
    const baseGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.1, 8);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(pos.x, pos.y + 0.05, pos.z);
    track._add(base);
  }
}

// ----------------------------------------------------------
// TRAFFIC LIGHTS — At key positions along the track
// ----------------------------------------------------------
function _buildTrafficLights(track, hw, safeOffset, isSafe) {
  const positions = [0.15, 0.35, 0.55, 0.75, 0.92];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.3 });

  for (const t of positions) {
    const side = t < 0.5 ? 1 : -1;
    const { pos } = safeOffset(t, hw + 3, side);
    if (!isSafe(pos.x, pos.z, 2)) continue;

    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.5, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(pos.x, pos.y + 2.25, pos.z);
    track._add(pole);

    const housingGeo = new THREE.BoxGeometry(0.5, 1.5, 0.3);
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.set(pos.x, pos.y + 4.8, pos.z);
    track._add(housing);

    // Red / Yellow / Green lenses
    const lensDefs = [
      { color: 0xff0000, emissive: 0xff0000, y: 0.45 },
      { color: 0xffaa00, emissive: 0xffaa00, y: 0 },
      { color: 0x00ff00, emissive: 0x00ff00, y: -0.45 },
    ];
    for (const lens of lensDefs) {
      const geo = new THREE.CircleGeometry(0.12, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: lens.color, emissive: lens.emissive, emissiveIntensity: 0.4, roughness: 0.3
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y + 4.8 + lens.y, pos.z + 0.16);
      track._add(mesh);
    }

    // Active green light (brighter)
    const activeGeo = new THREE.CircleGeometry(0.14, 8);
    const activeMat = new THREE.MeshStandardMaterial({
      color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 2.0, roughness: 0.1
    });
    const active = new THREE.Mesh(activeGeo, activeMat);
    active.position.set(pos.x, pos.y + 4.35, pos.z + 0.17);
    track._add(active);
  }
}

// ----------------------------------------------------------
// STREET TREES — Urban tree planting with planters
// ----------------------------------------------------------
function _buildStreetTrees(track, hw, safeOffset, isSafe) {
  const treeCount = 30;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9, metalness: 0.0 });
  const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x2d6b1e, roughness: 0.8, metalness: 0.0 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3a8a2a, roughness: 0.75, metalness: 0.0 });
  const pitMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.95 });

  for (let i = 0; i < treeCount; i++) {
    const t = (i + 0.5) / treeCount;
    const side = i % 2 === 0 ? 1 : -1;
    const { pos } = safeOffset(t, hw + 5, side);
    if (!isSafe(pos.x, pos.z, 3)) continue;

    const scale = 0.8 + Math.random() * 0.4;
    const trunkH = 3.5 * scale;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, trunkH, 6);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(pos.x, pos.y + trunkH / 2, pos.z);
    trunk.castShadow = true;
    track._add(trunk);

    // Multi-layered canopy for volume
    const canopyR = 2.0 * scale;
    const canopyY = pos.y + trunkH + canopyR * 0.5;
    const canopyGeo = new THREE.SphereGeometry(canopyR, 8, 6);
    const canopy = new THREE.Mesh(canopyGeo, Math.random() > 0.5 ? leafMat1 : leafMat2);
    canopy.position.set(pos.x, canopyY, pos.z);
    canopy.castShadow = true;
    track._add(canopy);

    for (let j = 0; j < 3; j++) {
      const angle = (j / 3) * Math.PI * 2 + Math.random() * 0.5;
      const offsetR = canopyR * 0.5;
      const smallGeo = new THREE.SphereGeometry(canopyR * 0.6, 6, 5);
      const small = new THREE.Mesh(smallGeo, Math.random() > 0.5 ? leafMat1 : leafMat2);
      small.position.set(
        pos.x + Math.cos(angle) * offsetR,
        canopyY + (Math.random() - 0.5) * canopyR * 0.4,
        pos.z + Math.sin(angle) * offsetR
      );
      small.castShadow = true;
      track._add(small);
    }

    // Tree pit planter
    const pitGeo = new THREE.BoxGeometry(1.6, 0.1, 1.6);
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.position.set(pos.x, pos.y + 0.12, pos.z);
    track._add(pit);

    const soilGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(pos.x, pos.y + 0.18, pos.z);
    track._add(soil);
  }
}

// ----------------------------------------------------------
// URBAN FURNITURE — Benches, trash cans, bollards
// ----------------------------------------------------------
function _buildUrbanFurniture(track, hw, safeOffset, isSafe) {
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8, metalness: 0.1 });
  const benchMetalMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.7 });
  const trashMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.4 });
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0xdddd00, roughness: 0.5, metalness: 0.3 });
  const bollardBaseMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.5 });
  const reflectMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 });

  // --- Benches ---
  for (let i = 0; i < 15; i++) {
    const t = (i + 0.3) / 15;
    const side = i % 2 === 0 ? 1 : -1;
    const { pos, angle } = safeOffset(t, hw + 4.5, side);
    if (!isSafe(pos.x, pos.z, 2)) continue;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.6), benchMat);
    seat.position.set(pos.x, pos.y + 0.6, pos.z);
    seat.rotation.y = angle;
    track._add(seat);

    const backOff = side === 1 ? -0.25 : 0.25;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.08), benchMat);
    back.position.set(
      pos.x + backOff * Math.cos(angle + Math.PI / 2),
      pos.y + 0.9,
      pos.z + backOff * Math.sin(angle + Math.PI / 2)
    );
    back.rotation.y = angle;
    track._add(back);

    for (let leg = -1; leg <= 1; leg += 2) {
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), benchMetalMat);
      legMesh.position.set(pos.x + leg * 0.8 * Math.cos(angle), pos.y + 0.3, pos.z + leg * 0.8 * Math.sin(angle));
      track._add(legMesh);
    }
  }

  // --- Trash cans ---
  for (let i = 0; i < 10; i++) {
    const t = (i + 0.7) / 10;
    const side = i % 2 === 0 ? -1 : 1;
    const { pos } = safeOffset(t, hw + 4, side);
    if (!isSafe(pos.x, pos.z, 1.5)) continue;

    const trash = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8), trashMat);
    trash.position.set(pos.x, pos.y + 0.4, pos.z);
    track._add(trash);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 8), trashMat);
    lid.position.set(pos.x, pos.y + 0.82, pos.z);
    track._add(lid);
  }

  // --- Bollards (yellow reflective posts) ---
  for (let i = 0; i < 25; i++) {
    const t = (i + 0.1) / 25;
    const side = i % 2 === 0 ? 1 : -1;
    const { pos } = safeOffset(t, hw + 1.8, side);
    if (!isSafe(pos.x, pos.z, 0.5)) continue;

    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6), bollardMat);
    bollard.position.set(pos.x, pos.y + 0.35, pos.z);
    track._add(bollard);

    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 6), reflectMat);
    stripe.position.set(pos.x, pos.y + 0.5, pos.z);
    track._add(stripe);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 8), bollardBaseMat);
    base.position.set(pos.x, pos.y + 0.03, pos.z);
    track._add(base);
  }
}

// ----------------------------------------------------------
// ROAD MARKINGS — Crosswalks, stop lines
// ----------------------------------------------------------
function _buildRoadMarkings(track, hw) {
  const crosswalkPositions = [0.1, 0.3, 0.5, 0.7, 0.9];

  for (const t of crosswalkPositions) {
    const p = track.spline.getPointAt(t);
    const tangent = track.spline.getTangentAt(t);
    const angle = Math.atan2(tangent.x, tangent.z);
    const stripeLen = hw * 1.8;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);

    // White crosswalk stripes
    ctx.fillStyle = '#ffffff';
    const stripeCount = 8;
    const stripePixelW = 256 / stripeCount;
    for (let s = 0; s < stripeCount; s++) {
      ctx.fillRect(s * stripePixelW + 4, 0, stripePixelW - 8, 64);
    }

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(stripeLen, 3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, transparent: true, opacity: 0.85 });
    const marking = new THREE.Mesh(geo, mat);

    const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    marking.quaternion.multiplyQuaternions(rotY, rotX);
    marking.position.set(p.x, p.y + 0.09, p.z);
    track._add(marking);
  }

  // Stop line at start
  const stopP = track.spline.getPointAt(0.0);
  const stopT = track.spline.getTangentAt(0.0);
  const stopAngle = Math.atan2(stopT.x, stopT.z);
  const stopGeo = new THREE.PlaneGeometry(hw * 1.6, 0.5);
  const stopMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const stopLine = new THREE.Mesh(stopGeo, stopMat);
  const qRotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const qRotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), stopAngle);
  stopLine.quaternion.multiplyQuaternions(qRotY, qRotX);
  stopLine.position.set(stopP.x, stopP.y + 0.09, stopP.z);
  track._add(stopLine);
}

// ----------------------------------------------------------
// SHOP SIGNS AND NEON — Commercial district atmosphere
// ----------------------------------------------------------
function _buildShopSigns(track, hw, safeOffset, isSafe) {
  const signs = [
    { name: '便利店', bg: '#00aa44', fg: '#ffffff' },
    { name: '咖啡', bg: '#6b3a2a', fg: '#ffffff' },
    { name: '银行', bg: '#003388', fg: '#ffffff' },
    { name: '超市', bg: '#cc0000', fg: '#ffffff' },
    { name: '餐厅', bg: '#ff6600', fg: '#ffffff' },
    { name: '药店', bg: '#0066cc', fg: '#ffffff' },
    { name: '书店', bg: '#8b4513', fg: '#ffffff' },
    { name: '花店', bg: '#cc3366', fg: '#ffffff' },
    { name: '理发', bg: '#222222', fg: '#ffffff' },
    { name: '手机', bg: '#333333', fg: '#00ccff' },
    { name: 'KTV', bg: '#ff0066', fg: '#ffffff' },
    { name: '网咖', bg: '#0066ff', fg: '#ffffff' },
  ];

  const postMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 });

  for (let i = 0; i < signs.length; i++) {
    const t = (i + 0.5) / signs.length;
    const side = i % 2 === 0 ? 1 : -1;
    const { pos, angle } = safeOffset(t, hw + 5, side);
    if (!isSafe(pos.x, pos.z, 2)) continue;

    const sign = signs[i];

    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.5, 4);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(pos.x, pos.y + 1.75, pos.z);
    track._add(post);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = sign.bg;
    ctx.fillRect(0, 0, 256, 80);
    ctx.strokeStyle = sign.fg;
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 250, 74);
    ctx.fillStyle = sign.fg;
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sign.name, 128, 42);

    const tex = new THREE.CanvasTexture(canvas);
    const boardGeo = new THREE.BoxGeometry(4, 1.5, 0.15);
    const boardMat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.3,
      emissive: new THREE.Color(sign.bg), emissiveIntensity: 0.3
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(pos.x, pos.y + 3.8, pos.z);
    board.rotation.y = angle;
    track._add(board);
  }

  // Neon accent strips on nearby buildings
  const neonColors = [0xff0066, 0x00ffaa, 0x00aaff, 0xffaa00, 0xff00ff];
  for (let i = 0; i < 12; i++) {
    const t = Math.random();
    const p = track.spline.getPointAt(t);
    const tangent = track.spline.getTangentAt(t);
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const side = Math.random() > 0.5 ? 1 : -1;
    const dist = 15 + Math.random() * 15;
    const x = p.x + right.x * dist * side;
    const z = p.z + right.z * dist * side;
    if (track.distToTrack(x, z) < hw + 10) continue;

    const color = neonColors[Math.floor(Math.random() * neonColors.length)];
    const neon = new THREE.Mesh(
      new THREE.BoxGeometry(3 + Math.random() * 4, 0.15, 0.15),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.2 })
    );
    neon.position.set(x, 5 + Math.random() * 8, z);
    neon.rotation.y = Math.atan2(tangent.x, tangent.z);
    track._add(neon);
  }
}
