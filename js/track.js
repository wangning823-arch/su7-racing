import * as THREE from 'three';
import { CONFIG } from './config.js?v=2';

export class TrackBuilder {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.world = physicsWorld;
    this.spline = null;
    this.waypoints = [];
    this.trackLength = 0;
    this.checkpoints = [];
    this.meshes = [];
    this.theme = null;
  }

  clear() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach(mt => mt.dispose());
        else m.material.dispose();
      }
    }
    this.meshes = [];
    this.spline = null;
    this._frames = null;
    this._frameCount = 0;
    this.waypoints = [];
    this.checkpoints = [];
  }

  _add(mesh) {
    this.scene.add(mesh);
    this.meshes.push(mesh);
  }

  build(trackDef, theme = null) {
    this.trackDef = trackDef;
    this.theme = theme || trackDef.theme || null;

    // Convert [x,y,z] arrays to Vector3
    const pts = trackDef.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));

    // Apply track width override if provided
    if (trackDef.trackWidth) {
      this._trackWidth = trackDef.trackWidth;
    }

    this.spline = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    this.trackLength = this.spline.getLength();

    // Compute track bounds for dynamic ranges
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    this.trackBounds = { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };

    // Store Frenet frames for physics tilt computation
    const segs = CONFIG.trackSegments;
    this._frames = this.spline.computeFrenetFrames(segs, true);
    this._frameCount = segs;

    this.buildRoad();
    this.buildCurbs();
    this.buildBarriers();
    this.buildGround();
    this.buildTrees();
    this.generateWaypoints();
    this.generateCheckpoints();
    this.buildStartLine();
    this.buildArrows();
    this.buildScenery();
    this.buildBuildings();
    this.buildSpecialScenery();
  }

  buildRoad() {
    const segs = CONFIG.trackSegments;
    const frames = this.spline.computeFrenetFrames(segs, true);
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;
    const verts = [], uvs = [], indices = [];

    for (let i = 0; i <= segs; i++) {
      const p = this.spline.getPointAt(i / segs);
      const b = frames.binormals[i];
      const lp = p.clone().add(b.clone().multiplyScalar(-hw));
      const rp = p.clone().add(b.clone().multiplyScalar(hw));
      verts.push(lp.x, lp.y + 0.06, lp.z, rp.x, rp.y + 0.06, rp.z);
      uvs.push(0, i / segs * 80, 1, i / segs * 80);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1;
      const c = ((i + 1) % (segs + 1)) * 2, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#333';
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 16; j++)
        if ((i + j) % 2 === 0) ctx.fillRect(i * 16, j * 16, 16, 16);
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 120, 256, 16);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 256, 3);
    ctx.fillRect(0, 253, 256, 3);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this._add(mesh);
  }

  buildCurbs() {
    const segs = 200;
    const frames = this.spline.computeFrenetFrames(segs, true);
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;
    const curbW = 1.0;

    for (let side of [-1, 1]) {
      const verts = [], uvs = [], indices = [];
      for (let i = 0; i <= segs; i++) {
        const p = this.spline.getPointAt(i / segs);
        const b = frames.binormals[i];
        const inner = p.clone().add(b.clone().multiplyScalar(hw * side));
        const outer = p.clone().add(b.clone().multiplyScalar((hw + curbW) * side));
        verts.push(inner.x, inner.y + 0.07, inner.z, outer.x, outer.y + 0.07, outer.z);
        uvs.push(0, i / segs * 40, 1, i / segs * 40);
      }
      for (let i = 0; i < segs; i++) {
        const a = i * 2, b = a + 1;
        const c = ((i + 1) % (segs + 1)) * 2, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#e74c3c' : '#ffffff';
        ctx.fillRect(i * 8, 0, 8, 64);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      this._add(mesh);
    }
  }

  /**
   * 构建赛道护栏
   * 改进点：在急弯处，内侧护栏会穿入路面，通过检测并跳过这些点
   * 让护栏自动绕过弯道外侧
   */
  buildBarriers() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;
    const barrierOffset = hw + 2; // 护栏位于路面边缘外2单位
    const h = 0.8;
    const N = 800;

    // 采样路面中心点
    const pts = [];
    for (let i = 0; i <= N; i++) {
      pts.push(this.spline.getPointAt(i / N));
    }

    // 计算每个路段的垂直方向（用于护栏偏移）
    const perps = [];
    for (let i = 0; i < N; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dz = pts[i + 1].z - pts[i].z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      perps.push({ x: -dz / len, z: dx / len });
    }

    // 检测护栏候选点是否在路面内（急弯时内侧偏移会穿入路面）
    const bo2 = barrierOffset * barrierOffset;
    function insideRoad(px, pz) {
      for (let k = 0; k <= N; k += 2) {
        const dx = px - pts[k].x, dz = pz - pts[k].z;
        if (dx * dx + dz * dz < bo2) return true;
      }
      return false;
    }

    for (let side of [-1, 1]) {
      const verts = [], indices = [];
      const barrier = [];

      for (let i = 0; i <= N; i++) {
        // Candidate barrier point: road center + perpendicular offset
        const bx = pts[i].x + perps[Math.min(i, N - 1)].x * barrierOffset * side;
        const bz = pts[i].z + perps[Math.min(i, N - 1)].z * barrierOffset * side;

        // If this point falls inside the road surface, skip it.
        // On sharp curves the inside offset lands on the road — skip it
        // so the barrier draws a straight line from the last valid point
        // to the next valid point, naturally going around the outside.
        if (insideRoad(bx, bz)) continue;

        barrier.push({ x: bx, y: pts[i].y, z: bz });
      }

      // Build geometry
      for (let i = 0; i < barrier.length; i++) {
        const p = barrier[i];
        verts.push(p.x, p.y, p.z, p.x, p.y + h, p.z);
      }
      for (let i = 0; i < barrier.length - 1; i++) {
        const a = i * 2, b = a + 1, c = (i + 1) * 2, d = c + 1;
        if (side === -1) indices.push(a, b, c, b, d, c);
        else indices.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      this._add(mesh);
    }
  }

  buildGround() {
    const b = this.trackBounds;
    const groundW = b ? Math.max(500, b.width + 300) : 500;
    const groundD = b ? Math.max(500, b.depth + 300) : 500;
    const geo = new THREE.PlaneGeometry(groundW, groundD);
    geo.rotateX(-Math.PI / 2);

    const g = this.theme?.ground || {};

    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, g.centerColor || '#3d7a28');
    grad.addColorStop(1, g.edgeColor || '#2d5a1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = g.dotColor || '#4a8c35';
    for (let i = 0; i < (g.dotCount ?? 40); i++) {
      const x = Math.random() * 120, y = Math.random() * 120;
      ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: g.roughness ?? 0.95 });
    const ground = new THREE.Mesh(geo, mat);
    ground.position.y = -2;
    ground.receiveShadow = true;
    this._add(ground);
  }

  _createLeafGeometry(type) {
    switch (type) {
      case 'cactus': return new THREE.ConeGeometry(0.4, 4.0, 6);
      case 'dead': return new THREE.ConeGeometry(0.3, 2.0, 4);
      case 'cone': return new THREE.ConeGeometry(1.5, 3.5, 8);
      case 'palm': return new THREE.ConeGeometry(2.0, 1.5, 6);
      case 'pine': return new THREE.ConeGeometry(1.2, 5.0, 8);
      case 'crystal': return new THREE.CylinderGeometry(0.3, 0.5, 4.0, 6);
      default: return new THREE.SphereGeometry(1.8, 8, 6);
    }
  }

  buildTrees() {
    const t = this.theme?.trees || {};
    const count = t.count ?? 400;
    if (count === 0) return;

    const trunkGeo = new THREE.CylinderGeometry(
      t.trunkRadiusTop ?? 0.15, t.trunkRadiusBottom ?? 0.25, t.trunkHeight ?? 2.5, 6
    );
    const trunkMat = new THREE.MeshStandardMaterial({ color: t.trunkColor ?? 0x5a3a1a });
    const leafGeo1 = this._createLeafGeometry(t.leafGeometries?.[0] ?? 'sphere');
    const leafGeo2 = this._createLeafGeometry(t.leafGeometries?.[1] ?? 'cone');
    const leavesMat1 = new THREE.MeshStandardMaterial({ color: t.leafColors?.[0] ?? 0x2e7d32 });
    const leavesMat2 = new THREE.MeshStandardMaterial({ color: t.leafColors?.[1] ?? 0x388e3c });

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const leaves1 = new THREE.InstancedMesh(leafGeo1, leavesMat1, Math.floor(count * 0.6));
    const leaves2 = new THREE.InstancedMesh(leafGeo2, leavesMat2, Math.ceil(count * 0.4));
    const dummy = new THREE.Object3D();

    const minDist = t.minDistToTrack ?? 18;
    let idx1 = 0, idx2 = 0;
    const b = this.trackBounds;
    const treeRangeX = b ? Math.max(400, b.width + 160) / 2 : 200;
    const treeRangeZ = b ? Math.max(400, b.depth + 160) / 2 : 200;
    for (let i = 0; i < count; i++) {
      let x, z;
      do {
        x = (Math.random() - 0.5) * treeRangeX * 2;
        z = (Math.random() - 0.5) * treeRangeZ * 2;
      } while (this.distToTrack(x, z) < minDist);
      const y = this.getTerrainHeight(x, z);
      const scale = 0.7 + Math.random() * 0.8;
      dummy.position.set(x, y + 1.2 * scale, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      if (i < count * 0.6) {
        dummy.position.set(x, y + 3.2 * scale, z);
        dummy.updateMatrix();
        leaves1.setMatrixAt(idx1++, dummy.matrix);
      } else {
        dummy.position.set(x, y + 3.5 * scale, z);
        dummy.updateMatrix();
        leaves2.setMatrixAt(idx2++, dummy.matrix);
      }
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    leaves1.instanceMatrix.needsUpdate = true;
    leaves2.instanceMatrix.needsUpdate = true;
    this._add(trunkMesh);
    this._add(leaves1);
    this._add(leaves2);
  }

  buildStartLine() {
    const p = this.spline.getPointAt(0);
    // Use waypoint direction instead of spline tangent (more reliable)
    const wp0 = this.waypoints[0].pos;
    const wp1 = this.waypoints[1].pos;
    const fwdDx = wp1.x - wp0.x;
    const fwdDz = wp1.z - wp0.z;
    const fwdLen = Math.sqrt(fwdDx * fwdDx + fwdDz * fwdDz);
    const t = new THREE.Vector3(fwdDx / fwdLen, 0, fwdDz / fwdLen);
    const angle = Math.atan2(t.x, t.z);
    const right = new THREE.Vector3(t.z, 0, -t.x).normalize();

    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#fff' : '#111';
        ctx.fillRect(i * 8, j * 8, 8, 8);
      }
    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(this._trackWidth || CONFIG.trackWidth, 2);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
    const line = new THREE.Mesh(geo, mat);
    // Use quaternions to avoid Euler rotation order issues
    // Step 1: rotate around X to flatten the plane to the ground
    const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    // Step 2: rotate around Y to align plane width (X axis) with track direction
    const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    // multiplyQuaternions(a, b) applies b first, then a → flatten first, then align direction
    line.quaternion.multiplyQuaternions(rotY, rotX);
    line.position.set(p.x, p.y + 0.08, p.z);
    this._add(line);

    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7 });
    for (let side of [-1, 1]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      const offset = right.clone().multiplyScalar((this._trackWidth || CONFIG.trackWidth) / 2 * side);
      pole.position.set(p.x + offset.x, p.y + 2, p.z + offset.z);
      this._add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.8),
        new THREE.MeshStandardMaterial({ color: side === -1 ? 0xe74c3c : 0x3498db, side: THREE.DoubleSide })
      );
      flag.position.set(p.x + offset.x, p.y + 3.6, p.z + offset.z);
      flag.rotation.y = angle;
      this._add(flag);
    }
  }

  buildArrows() {
    // Classic filled arrow in XZ plane, pointing +Z
    const headW = 0.8;  // head half width
    const headLen = 0.7; // head length
    const stemW = 0.2;   // stem half width
    const stemLen = 1.3; // stem length
    const tipZ = headLen;
    const baseZ = 0;
    const tailZ = -stemLen;

    const verts = [
      0,          0, tipZ,       // 0: tip
      -headW,     0, baseZ,     // 1: left head
      headW,      0, baseZ,     // 2: right head
      -stemW,     0, baseZ,     // 3: left stem start
      stemW,      0, baseZ,     // 4: right stem start
      -stemW,     0, tailZ,     // 5: left tail
      stemW,      0, tailZ,     // 6: right tail
    ];

    const indices = [
      // Head: two triangles
      0, 1, 2,
      // Head-to-stem transition: fill corners between head and stem
      1, 3, 2,
      3, 4, 2,
      // Stem: two triangles
      3, 5, 6,
      3, 6, 4,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });

    const count = 40;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const angle = Math.atan2(tangent.x, tangent.z);

      const arrow = new THREE.Mesh(geo, mat);
      arrow.rotation.y = angle;
      arrow.position.set(p.x, p.y + 0.1, p.z);
      this._add(arrow);
    }
  }

  buildScenery() {
    const s = this.theme?.scenery || {};
    const p90 = this.spline.getPointAt(0.9);
    const t90 = this.spline.getTangentAt(0.9);
    const right90 = new THREE.Vector3(t90.z, 0, -t90.x).normalize();

    const standPos = p90.clone().add(right90.clone().multiplyScalar(25));
    // Skip scenery if it would be too close to the track (e.g. on sharp curves)
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;
    if (this.distToTrack(standPos.x, standPos.z) < hw + 12) return;
    const standGeo = new THREE.BoxGeometry(20, 4, 6);
    const standMat = new THREE.MeshStandardMaterial({ color: s.standColor ?? 0x34495e, roughness: 0.6 });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(standPos.x, standPos.y + 2, standPos.z);
    stand.rotation.y = Math.atan2(t90.x, t90.z);
    stand.castShadow = true;
    this._add(stand);

    const roofGeo = new THREE.BoxGeometry(22, 0.3, 8);
    const roofMat = new THREE.MeshStandardMaterial({ color: s.roofColor ?? 0xe74c3c });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(standPos.x, standPos.y + 4.3, standPos.z);
    roof.rotation.y = Math.atan2(t90.x, t90.z);
    this._add(roof);

    const seatColors = s.seatColors ?? [0xe74c3c, 0x3498db, 0xf1c40f];
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 3; j++) {
        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.8, 0.5),
          new THREE.MeshStandardMaterial({ color: seatColors[j % 3] })
        );
        const sx = standPos.x + (i - 5) * 1.8;
        const sy = standPos.y + 0.5 + j * 1.2;
        const sz = standPos.z + (j - 1) * 2;
        seat.position.set(sx, sy, sz);
        seat.rotation.y = Math.atan2(t90.x, t90.z);
        this._add(seat);
      }
    }

    const p25 = this.spline.getPointAt(0.25);
    const t25 = this.spline.getTangentAt(0.25);
    const right25 = new THREE.Vector3(t25.z, 0, -t25.x).normalize();
    const boardPos = p25.clone().add(right25.clone().multiplyScalar(-20));
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3, 0.3),
      new THREE.MeshStandardMaterial({ color: s.boardColor ?? 0x2c3e50, roughness: 0.3 })
    );
    board.position.set(boardPos.x, boardPos.y + 2.5, boardPos.z);
    board.rotation.y = Math.atan2(t25.x, t25.z);
    this._add(board);

    const tireGeo = new THREE.TorusGeometry(0.4, 0.2, 8, 12);
    const tireMat = new THREE.MeshStandardMaterial({ color: s.tireColor ?? 0x222222 });
    const p60 = this.spline.getPointAt(0.6);
    const t60 = this.spline.getTangentAt(0.6);
    const right60 = new THREE.Vector3(t60.z, 0, -t60.x).normalize();
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        const tx = p60.x + right60.x * (10 + j * 1.2) - t60.x * (i - 2) * 1.5;
        const tz = p60.z + right60.z * (10 + j * 1.2) - t60.z * (i - 2) * 1.5;
        // Skip tire if it would be too close to the track surface
        if (this.distToTrack(tx, tz) < hw + 1) continue;
        const tire = new THREE.Mesh(tireGeo, tireMat);
        const ty = this.getTerrainHeight(tx, tz) + 0.4 + j * 0.8;
        tire.position.set(tx, ty, tz);
        tire.rotation.x = Math.PI / 2;
        this._add(tire);
      }
    }
  }

  buildSpecialScenery() {
    if (!this.theme || !this.trackDef) return;

    const id = this.trackDef.themeId;

    if (id === 'coastal') this._buildLighthouse();
    if (id === 'snow') this._buildIgloos();
    if (id === 'farm') this._buildBarns();
    if (id === 'nightmarket') this._buildNeonSigns();
    if (id === 'nurburgring') {
      this._buildBilsteinBridge();
      this._buildSponsorBoards();
    }
    if (id === 'losail') {
      this._buildLosailScenery();
    }
    if (id === 'jeddah') {
      this._buildJeddahScenery();
    }
    if (id === 'marina_bay') {
      this._buildMarinaBayScenery();
    }
    if (id === 'vegas') {
      this._buildVegasScenery();
    }
    if (id === 'miami') {
      this._buildMiamiScenery();
    }
    if (id === 'red_bull_ring') {
      this._buildRedBullRingScenery();
    }
    if (id === 'rodriguez') {
      this._buildRodriguezScenery();
    }
    if (id === 'zandvoort') {
      this._buildZandvoortScenery();
    }
    if (id === 'villeneuve') {
      this._buildVilleneuveScenery();
    }
    if (id === 'yas_marina') {
      this._buildYasMarinaScenery();
    }
    if (id === 'silverstone') {
      this._buildSilverstoneScenery();
    }
    if (id === 'monza') {
      this._buildMonzaScenery();
    }
    if (id === 'spa') {
      this._buildSpaScenery();
    }
    if (id === 'monaco') {
      this._buildMonacoScenery();
    }
    if (id === 'suzuka') {
      this._buildSuzukaScenery();
    }
    if (id === 'catalunya') {
      this._buildCatalunyaScenery();
    }
    if (id === 'hungaroring') {
      this._buildHungaroringScenery();
    }
    if (id === 'interlagos') {
      this._buildInterlagosScenery();
    }
    if (id === 'americas') {
      this._buildAmericasScenery();
    }
    if (id === 'baku') {
      this._buildBakuScenery();
    }
    if (id === 'albert_park') {
      this._buildAlbertParkScenery();
    }
    if (id === 'shanghai') {
      this._buildShanghaiScenery();
    }
  }

  _buildLighthouse() {
    const p = this.spline.getPointAt(0.15);
    const t = this.spline.getTangentAt(0.15);
    const right = new THREE.Vector3(t.z, 0, -t.x).normalize();
    const pos = p.clone().add(right.clone().multiplyScalar(-30));

    // Base cylinder
    const baseGeo = new THREE.CylinderGeometry(1.5, 2, 12, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(pos.x, pos.y + 4, pos.z);
    base.castShadow = true;
    this._add(base);

    // Red stripe
    const stripeGeo = new THREE.CylinderGeometry(1.6, 1.6, 2, 8);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.5 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(pos.x, pos.y + 8, pos.z);
    this._add(stripe);

    // Top lantern room
    const topGeo = new THREE.CylinderGeometry(1.8, 1.2, 2, 8);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.6 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(pos.x, pos.y + 14, pos.z);
    this._add(top);

    // Light
    const lightGeo = new THREE.SphereGeometry(0.8, 8, 8);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 1.0 });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(pos.x, pos.y + 14, pos.z);
    this._add(light);
  }

  _buildIgloos() {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 80 + Math.random() * 30;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (this.distToTrack(x, z) < 20 + (this._trackWidth || CONFIG.trackWidth) / 2) continue;

      // Dome
      const domeGeo = new THREE.SphereGeometry(3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, roughness: 0.6 });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.position.set(x, -2, z);
      dome.castShadow = true;
      this._add(dome);

      // Entrance tunnel
      const tunnelGeo = new THREE.CylinderGeometry(1, 1.2, 3, 6);
      const tunnel = new THREE.Mesh(tunnelGeo, domeMat);
      tunnel.rotation.x = Math.PI / 2;
      tunnel.position.set(x + 2.5, -1.5, z);
      this._add(tunnel);
    }
  }

  _buildBarns() {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const r = 60 + Math.random() * 20;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (this.distToTrack(x, z) < 22 + (this._trackWidth || CONFIG.trackWidth) / 2) continue;

      const w = 10 + Math.random() * 5;
      const d = 14 + Math.random() * 5;
      const h = 6 + Math.random() * 3;

      // Main barn body
      const bodyGeo = new THREE.BoxGeometry(w, h, d);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b2500, roughness: 0.8 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(x, h / 2 - 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      this._add(body);

      // Roof (prism shape via two triangles)
      const roofGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.75, 4, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(x, h + 0.5, z);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this._add(roof);
    }
  }

  _buildNeonSigns() {
    const neonColors = [0xff0066, 0x00ffaa, 0xffaa00, 0x00aaff, 0xff00ff, 0xffff00];
    const count = 20;
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const side = Math.random() > 0.5 ? 1 : -1;
      const dist = 8 + Math.random() * 5;
      const x = p.x + right.x * dist * side;
      const z = p.z + right.z * dist * side;

      const color = neonColors[Math.floor(Math.random() * neonColors.length)];

      // Neon sign post
      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 4, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 0, z);
      this._add(post);

      // Neon sign board
      const signGeo = new THREE.BoxGeometry(3, 1.5, 0.15);
      const signMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.3 });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(x, 3.5, z);
      sign.rotation.y = Math.atan2(tangent.x, tangent.z);
      this._add(sign);
    }
  }

  _buildBilsteinBridge() {
    // Place bridge at ~88% along track (Döttinger Höhe straight, near end)
    const t = 0.88;
    const p = this.spline.getPointAt(t);
    const tangent = this.spline.getTangentAt(t);
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const angle = Math.atan2(tangent.x, tangent.z);

    const bridgeWidth = (this._trackWidth || CONFIG.trackWidth) + 6;
    const pillarH = 8;
    const beamH = 1.2;

    // Blue pillars on each side
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, pillarH, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0055aa, roughness: 0.4, metalness: 0.5 });
    for (let side of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      const offset = right.clone().multiplyScalar(bridgeWidth / 2 * side);
      pillar.position.set(p.x + offset.x, p.y + pillarH / 2, p.z + offset.z);
      pillar.castShadow = true;
      this._add(pillar);
    }

    // Yellow+blue横梁 (beam across the track)
    const beamGeo = new THREE.BoxGeometry(bridgeWidth, beamH, 1.5);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xddaa00, roughness: 0.3, metalness: 0.4 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(p.x, p.y + pillarH + beamH / 2, p.z);
    beam.rotation.y = angle;
    beam.castShadow = true;
    this._add(beam);

    // Blue accent strip on beam
    const stripGeo = new THREE.BoxGeometry(bridgeWidth + 0.2, 0.3, 1.6);
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x0055aa, roughness: 0.3, metalness: 0.5 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(p.x, p.y + pillarH + beamH + 0.15, p.z);
    strip.rotation.y = angle;
    this._add(strip);

    // BILSTEIN text on canvas
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#003388';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BILSTEIN', 128, 32);
    const tex = new THREE.CanvasTexture(canvas);

    const signGeo = new THREE.PlaneGeometry(8, 2);
    const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(p.x, p.y + pillarH + beamH + 1.5, p.z);
    sign.rotation.y = angle;
    this._add(sign);
  }

  _buildSponsorBoards() {
    const sponsors = [
      { name: 'BILSTEIN', bg: '#003388', fg: '#ffcc00' },
      { name: 'AUDI', bg: '#000000', fg: '#ffffff' },
      { name: 'MERCEDES-AMG', bg: '#222222', fg: '#c0c0c0' },
      { name: 'MICHELIN', bg: '#003399', fg: '#ffffff' },
      { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
      { name: 'RECARO', bg: '#1a1a1a', fg: '#ff6600' },
      { name: 'Sparco', bg: '#0066cc', fg: '#ffffff' },
      { name: 'BRIDGESTONE', bg: '#cc0000', fg: '#ffffff' },
    ];

    const boardCount = 8;
    for (let i = 0; i < boardCount; i++) {
      const t = (i + 0.5) / boardCount;
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const side = i % 2 === 0 ? 1 : -1;
      const dist = 12 + Math.random() * 4;
      const x = p.x + right.x * dist * side;
      const z = p.z + right.z * dist * side;

      const sponsor = sponsors[i % sponsors.length];

      // Post
      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 0, z);
      this._add(post);

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

      const boardGeo = new THREE.BoxGeometry(5, 2.5, 0.15);
      const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(x, 2.8, z);
      board.rotation.y = Math.atan2(tangent.x, tangent.z);
      board.castShadow = true;
      this._add(board);
    }
  }

  buildBuildings() {
    const b = this.theme?.buildings;
    if (!b || !b.count) return;
    console.log('[buildBuildings] theme buildings:', b);

    const count = b.count ?? 80;
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;
    const configMinDist = b.minDistToTrack ?? 30;

    const buildingColors = [0x555566, 0x4a4a5a, 0x606070, 0x505060, 0x484858, 0x5a5a6a];

    const b2 = this.trackBounds;
    const buildRangeX = b2 ? Math.max(400, b2.width + 200) / 2 : 200;
    const buildRangeZ = b2 ? Math.max(400, b2.depth + 200) / 2 : 200;

    for (let i = 0; i < count; i++) {
      const w = (b.minWidth ?? 6) + Math.random() * ((b.maxWidth ?? 14) - (b.minWidth ?? 6));
      const d = (b.minWidth ?? 6) + Math.random() * ((b.maxWidth ?? 14) - (b.minWidth ?? 6));
      const h = (b.minHeight ?? 8) + Math.random() * ((b.maxHeight ?? 30) - (b.minHeight ?? 8));
      const actualHalfSize = Math.max(w, d) / 2;

      // 所需最小距离：赛道半宽 + 建筑物半宽 + 配置的最小距离
      const requiredDist = hw + actualHalfSize + configMinDist;

      let x, z;
      let attempts = 0;
      let valid = false;
      while (attempts < 300) {
        x = (Math.random() - 0.5) * buildRangeX * 2;
        z = (Math.random() - 0.5) * buildRangeZ * 2;
        attempts++;

        const dist = this.distToTrack(x, z);
        if (dist >= requiredDist) {
          valid = true;
          break;
        }
      }
      if (!valid) continue;

      const geo = new THREE.BoxGeometry(w, h, d);
      const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
      const building = new THREE.Mesh(geo, mat);
      building.position.set(x, h / 2 - 2, z);
      building.castShadow = true;
      building.receiveShadow = true;

      this._add(building);

      // Windows: emissive dots on building faces
      const windowMat = new THREE.MeshStandardMaterial({ color: 0xffeeaa, emissive: 0xffeeaa, emissiveIntensity: 0.3 });
      const winGeo = new THREE.PlaneGeometry(0.8, 0.6);
      const floors = Math.floor(h / 3);
      const winCols = Math.floor(w / 2);
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < winCols; c++) {
          if (Math.random() > 0.6) continue;
          const win = new THREE.Mesh(winGeo, windowMat);
          win.position.set(
            x - w / 2 + 1 + c * 2,
            1 + f * 3,
            z + d / 2 + 0.05
          );
          this._add(win);
        }
      }
    }
  }

  distToTrack(x, z) {
    let minD = Infinity;
    for (let t = 0; t < 1; t += 0.002) {
      const p = this.spline.getPointAt(t);
      const d = Math.sqrt((x - p.x) ** 2 + (z - p.z) ** 2);
      if (d < minD) minD = d;
    }
    return minD;
  }

  getTerrainHeight(x, z) {
    if (!this.spline) return 0;
    let minD = Infinity;
    let bestT = 0;
    for (let t = 0; t < 1; t += 0.002) {
      const p = this.spline.getPointAt(t);
      const d = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (d < minD) { minD = d; bestT = t; }
    }
    return this.spline.getPointAt(bestT).y;
  }

  generateWaypoints() {
    this.waypoints = [];
    const n = 100;
    for (let i = 0; i < n; i++) {
      const p = this.spline.getPointAt(i / n);
      const t = this.spline.getTangentAt(i / n);
      this.waypoints.push({ pos: p, tangent: t, index: i });
    }
  }

  generateCheckpoints() {
    this.checkpoints = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      this.checkpoints.push({
        t: i / n,
        pos: this.spline.getPointAt(i / n)
      });
    }
  }

  /**
   * Losail Circuit (Qatar) - Night race under floodlights
   * Features: desert sand ground, palm trees, floodlight towers,
   *          grandstands with Qatar maroon/white theme, sponsor boards
   */
  _buildLosailScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Qatar national colors: maroon + white)
      const seatColors = [0x800020, 0xffffff, 0x800020];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

    // ============================================================
    // 1. MAIN GRANDSTAND - Start/Finish straight (t=0.03)
    //    Losail Circuit main grandstand with Qatar maroon theme
    // ============================================================
    placeStand(0.03, hw + 20, 1, 40, 9, 9, 0x2a2a2a, 0x800020);

    // Pit building - opposite side (t=0.07)
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
        this._add(pit);

        // Pit garages with maroon doors
        const garageColors = [0x800020, 0xffffff, 0x800020, 0xffffff, 0x800020];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.2;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          this._add(g);
        }

        // LOSAIL CIRCUIT sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#800020';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('LOSAIL INTERNATIONAL CIRCUIT', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(16, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        this._add(sign);
      }
    }

    // ============================================================
    // 2. FLOODLIGHT TOWERS - Artificial lighting structures
    //    Losail is famous for its night race under floodlights
    // ============================================================
    {
      const lightTowerPositions = [
        { t: 0.05, side: 1 },
        { t: 0.15, side: -1 },
        { t: 0.25, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.45, side: 1 },
        { t: 0.55, side: -1 },
        { t: 0.65, side: 1 },
        { t: 0.75, side: -1 },
        { t: 0.85, side: 1 },
        { t: 0.95, side: -1 },
      ];

      for (const lt of lightTowerPositions) {
        const { pos, angle } = safeOffset(lt.t, hw + 14, lt.side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const towerH = 18;

        // Main tower pole (steel gray)
        const poleGeo = new THREE.CylinderGeometry(0.3, 0.5, towerH, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.4, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + towerH / 2, pos.z);
        pole.castShadow = true;
        this._add(pole);

        // Cross-arm at top (holds the light bank)
        const armGeo = new THREE.BoxGeometry(6, 0.4, 0.8);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.4, metalness: 0.5 });
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(pos.x, pos.y + towerH, pos.z);
        arm.rotation.y = angle;
        this._add(arm);

        // Light bank (emissive glow)
        const lightBankGeo = new THREE.BoxGeometry(5, 1.5, 0.6);
        const lightBankMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.2, roughness: 0.1
        });
        const lightBank = new THREE.Mesh(lightBankGeo, lightBankMat);
        lightBank.position.set(pos.x, pos.y + towerH - 1.2, pos.z);
        lightBank.rotation.y = angle;
        this._add(lightBank);

        // Base plate
        const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.5, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(pos.x, pos.y + 0.25, pos.z);
        this._add(base);
      }
    }

    // ============================================================
    // 3. SECONDARY GRANDSTANDS - Key corners
    // ============================================================
    placeStand(0.22, hw + 20, -1, 28, 7, 7, 0x333344, 0x800020);  // Turn 1 area
    placeStand(0.40, hw + 18, 1, 22, 5, 6, 0x2a3a4a, 0x666677);   // Mid-section
    placeStand(0.60, hw + 20, -1, 25, 6, 7, 0x3a3a4a, 0x800020);  // Back section
    placeStand(0.80, hw + 18, 1, 20, 5, 6, 0x2a3a4a, 0x666677);   // Near final corner

    // ============================================================
    // 4. PALM TREES - Desert vegetation (scattered around circuit)
    // ============================================================
    {
      const palmCount = 40;
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 5.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
      const leafGeo = new THREE.ConeGeometry(2.5, 2.0, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, palmCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx = 0;
      for (let i = 0; i < palmCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 16 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
        const scale = 0.8 + Math.random() * 0.6;

        // Trunk
        dummy.position.set(x, y + 2.8 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);

        // Palm canopy
        dummy.position.set(x, y + 6.2 * scale, z);
        dummy.scale.set(scale * 1.2, scale * 0.8, scale * 1.2);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(idx, dummy.matrix);
        idx++;
      }

      trunkMesh.count = idx;
      leafMesh.count = idx;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leafMesh.instanceMatrix.needsUpdate = true;
      this._add(trunkMesh);
      this._add(leafMesh);
    }

    // ============================================================
    // 5. DESERT SAND DUNES - Low desert landscaping
    // ============================================================
    {
      const duneGeo = new THREE.SphereGeometry(4, 8, 6);
      const duneMat = new THREE.MeshStandardMaterial({ color: 0xc8a870, roughness: 1.0 });
      const duneCount = 20;

      for (let i = 0; i < duneCount; i++) {
        const t = Math.random();
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 25 + Math.random() * 40;
        const dx = p.x + right.x * dist * side;
        const dz = p.z + right.z * dist * side;
        if (this.distToTrack(dx, dz) < hw + 20) continue;

        const dune = new THREE.Mesh(duneGeo, duneMat);
        const scale = 0.5 + Math.random() * 1.5;
        dune.position.set(dx, this.getTerrainHeight(dx, dz) - 0.5, dz);
        dune.scale.set(scale * (1 + Math.random()), scale * 0.4, scale * (1 + Math.random()));
        this._add(dune);
      }
    }

    // ============================================================
    // 6. SPONSOR BOARDS - Qatar GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'QATAR AIRWAYS', bg: '#7c0053', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'QATAR GP', bg: '#800020', fg: '#ffffff' },
        { name: 'LOSAIL', bg: '#1a1a2e', fg: '#c0a060' },
      ];

      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;

        if (this.distToTrack(x, z) < hw + 8) continue;

        placeBoard(t, dist, side, sponsors[i % sponsors.length]);
      }
    }

    // ============================================================
    // 7. TIRE WALLS - Key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.10, side: -1 },
        { t: 0.20, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.50, side: 1 },
        { t: 0.65, side: -1 },
        { t: 0.78, side: 1 },
        { t: 0.90, side: -1 },
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
          this._add(tire);
        }
      }
    }
  }

  /**
   * Red Bull Ring (Austria) - Alpine mountain scenery
   * Features: Alps mountain backdrop, Red Bull branded buildings,
   *          alpine pine/conifer trees, grandstands, sponsor boards
   */
  _buildRedBullRingScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // ============================================================
    // 1. ALPS MOUNTAIN BACKDROP - Large distant mountain shapes
    //    Spielberg is in the Styrian mountains, surrounded by Alps
    // ============================================================
    {
      const mountainMat1 = new THREE.MeshStandardMaterial({ color: 0x5a6a52, roughness: 0.95 });
      const mountainMat2 = new THREE.MeshStandardMaterial({ color: 0x4a5a42, roughness: 0.95 });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, roughness: 0.7 });

      const mountains = [
        { x: 300, z: -400, scale: 1.4, height: 80, mat: mountainMat1 },
        { x: -200, z: -350, scale: 1.2, height: 65, mat: mountainMat2 },
        { x: -500, z: -300, scale: 1.6, height: 90, mat: mountainMat1 },
        { x: 500, z: -350, scale: 1.0, height: 55, mat: mountainMat2 },
        { x: 100, z: 400, scale: 1.3, height: 70, mat: mountainMat1 },
        { x: -350, z: 350, scale: 1.5, height: 85, mat: mountainMat2 },
        { x: 400, z: 300, scale: 1.1, height: 60, mat: mountainMat1 },
        { x: -100, z: 450, scale: 1.2, height: 75, mat: mountainMat2 },
      ];

      for (const m of mountains) {
        // Main mountain cone
        const geo = new THREE.ConeGeometry(60 * m.scale, m.height * m.scale, 8);
        const mountain = new THREE.Mesh(geo, m.mat);
        mountain.position.set(m.x, m.height * m.scale / 2 - 10, m.z);
        mountain.castShadow = true;
        this._add(mountain);

        // Snow cap
        const snowGeo = new THREE.ConeGeometry(20 * m.scale, 15 * m.scale, 8);
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.set(m.x, m.height * m.scale - 15, m.z);
        this._add(snow);
      }

      // Additional smaller rolling hills
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.95 });
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const r = 250 + Math.random() * 150;
        const hx = Math.cos(angle) * r;
        const hz = Math.sin(angle) * r;
        if (this.distToTrack(hx, hz) < 60) continue;

        const hillGeo = new THREE.SphereGeometry(30 + Math.random() * 20, 8, 6);
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.position.set(hx, -5, hz);
        hill.scale.set(1, 0.3, 1);
        this._add(hill);
      }
    }

    // ============================================================
    // 2. RED BULL BRANDED BUILDINGS - Paddock / Energy Station
    //    Place at start/finish area (t=0.0) and another key position
    // ============================================================
    {
      // Main Red Bull paddock building (near start/finish)
      const { pos: padPos, angle: padAngle } = safeOffset(0.95, hw + 25, -1);
      if (isSafe(padPos.x, padPos.z, 12)) {
        // Main building body - dark blue (Red Bull primary)
        const bodyGeo = new THREE.BoxGeometry(30, 8, 12);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.5, metalness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(padPos.x, padPos.y + 4, padPos.z);
        body.rotation.y = padAngle;
        body.castShadow = true;
        body.receiveShadow = true;
        this._add(body);

        // Silver/gray accent stripe
        const stripeGeo = new THREE.BoxGeometry(30.2, 1.5, 12.2);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.3, metalness: 0.6 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(padPos.x, padPos.y + 5.5, padPos.z);
        stripe.rotation.y = padAngle;
        this._add(stripe);

        // Red Bull sign on the building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 128;
        const signCtx = signCanvas.getContext('2d');
        // Dark blue background
        signCtx.fillStyle = '#0a1a4a';
        signCtx.fillRect(0, 0, 512, 128);
        // Yellow/gold text
        signCtx.fillStyle = '#f5c518';
        signCtx.font = 'bold 56px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('RED BULL RING', 256, 64);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(14, 3.5);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(padPos.x, padPos.y + 9.5, padPos.z);
        sign.rotation.y = padAngle;
        this._add(sign);

        // Garage doors (Red Bull colors: dark blue + yellow accents)
        const garageColors = [0x0a1a4a, 0x0a1a4a, 0x1a2a5a, 0x0a1a4a, 0x0a1a4a];
        for (let i = 0; i < 8; i++) {
          const gGeo = new THREE.PlaneGeometry(2.8, 3.5);
          const gMat = new THREE.MeshStandardMaterial({
            color: garageColors[i % garageColors.length],
            roughness: 0.5,
            metalness: 0.3
          });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(padAngle), sinA = Math.sin(padAngle);
          const localX = (i - 3.5) * 3.5;
          g.position.set(
            padPos.x + localX * cosA - 6 * sinA,
            padPos.y + 1.8,
            padPos.z - localX * sinA + 6 * cosA
          );
          g.rotation.y = padAngle;
          this._add(g);
        }
      }

      // Red Bull Tower / observation structure (higher position, t=0.3)
      const { pos: towerPos, angle: towerAngle } = safeOffset(0.3, hw + 20, 1);
      if (isSafe(towerPos.x, towerPos.z, 8)) {
        const towerH = 16;
        // Main tower pillar
        const pillarGeo = new THREE.BoxGeometry(3, towerH, 3);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.4, metalness: 0.4 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(towerPos.x, towerPos.y + towerH / 2, towerPos.z);
        pillar.castShadow = true;
        this._add(pillar);

        // Top observation deck
        const deckGeo = new THREE.BoxGeometry(8, 2, 8);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.4, metalness: 0.3 });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(towerPos.x, towerPos.y + towerH + 1, towerPos.z);
        deck.castShadow = true;
        this._add(deck);

        // Yellow accent ring
        const ringGeo = new THREE.TorusGeometry(3.5, 0.3, 8, 16);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.3, metalness: 0.5 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(towerPos.x, towerPos.y + towerH + 2.2, towerPos.z);
        ring.rotation.x = Math.PI / 2;
        this._add(ring);

        // Red Bull text sign on tower
        const towerSignCanvas = document.createElement('canvas');
        towerSignCanvas.width = 256; towerSignCanvas.height = 128;
        const towerSignCtx = towerSignCanvas.getContext('2d');
        towerSignCtx.fillStyle = '#0a1a4a';
        towerSignCtx.fillRect(0, 0, 256, 128);
        towerSignCtx.fillStyle = '#f5c518';
        towerSignCtx.font = 'bold 40px Arial';
        towerSignCtx.textAlign = 'center';
        towerSignCtx.textBaseline = 'middle';
        towerSignCtx.fillText('RED BULL', 128, 64);
        const towerSignTex = new THREE.CanvasTexture(towerSignCanvas);

        for (let face = 0; face < 4; face++) {
          const faceSignGeo = new THREE.PlaneGeometry(2.8, 1.5);
          const faceSignMat = new THREE.MeshStandardMaterial({ map: towerSignTex, roughness: 0.3 });
          const faceSign = new THREE.Mesh(faceSignGeo, faceSignMat);
          const fAngle = towerAngle + (face * Math.PI / 2);
          faceSign.position.set(
            towerPos.x + Math.sin(fAngle) * 1.6,
            towerPos.y + towerH - 2,
            towerPos.z + Math.cos(fAngle) * 1.6
          );
          faceSign.rotation.y = fAngle;
          this._add(faceSign);
        }
      }
    }

    // ============================================================
    // 3. MAIN GRANDSTAND - Start/Finish straight
    //    Austrian flag colors: red-white-red for seats
    // ============================================================
    {
      const { pos: standPos, angle: standAngle } = safeOffset(0.02, hw + 18, 1);
      if (isSafe(standPos.x, standPos.z, 10)) {
        const standW = 35, standH = 8, standD = 8;
        // Stand body - dark gray
        const standGeo = new THREE.BoxGeometry(standW, standH, standD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.6 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(standPos.x, standPos.y + standH / 2, standPos.z);
        stand.rotation.y = standAngle;
        stand.castShadow = true;
        stand.receiveShadow = true;
        this._add(stand);

        // Roof canopy - Red Bull dark blue
        const roofGeo = new THREE.BoxGeometry(standW + 3, 0.4, standD + 3);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(standPos.x, standPos.y + standH + 0.2, standPos.z);
        roof.rotation.y = standAngle;
        roof.castShadow = true;
        this._add(roof);

        // Seats - Austrian flag pattern: red-white-red rows
        const seatColors = [0xcc0000, 0xffffff, 0xcc0000];
        const rows = 3;
        const cols = Math.floor(standW / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - cols / 2 + 0.5) * 1.8;
            const localZ = (r - 1) * (standD / 2.5);
            const cosA = Math.cos(standAngle), sinA = Math.sin(standAngle);
            seat.position.set(
              standPos.x + localX * cosA + localZ * sinA,
              standPos.y + 0.5 + r * 1.2,
              standPos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = standAngle;
            this._add(seat);
          }
        }
      }
    }

    // ============================================================
    // 4. SECONDARY GRANDSTANDS - Key corners
    // ============================================================
    {
      const secondaryStands = [
        { t: 0.18, side: -1, w: 25, h: 6, d: 6 },
        { t: 0.35, side: 1, w: 22, h: 5, d: 6 },
        { t: 0.55, side: -1, w: 25, h: 6, d: 6 },
        { t: 0.75, side: 1, w: 22, h: 5, d: 6 },
      ];

      for (const s of secondaryStands) {
        const { pos: sPos, angle: sAngle } = safeOffset(s.t, hw + 16, s.side);
        if (!isSafe(sPos.x, sPos.z, s.w / 2)) continue;

        const sGeo = new THREE.BoxGeometry(s.w, s.h, s.d);
        const sMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.6 });
        const standMesh = new THREE.Mesh(sGeo, sMat);
        standMesh.position.set(sPos.x, sPos.y + s.h / 2, sPos.z);
        standMesh.rotation.y = sAngle;
        standMesh.castShadow = true;
        standMesh.receiveShadow = true;
        this._add(standMesh);

        // Roof - alternating Red Bull blue/yellow
        const roofGeo = new THREE.BoxGeometry(s.w + 2, 0.35, s.d + 2);
        const roofColor = s.side > 0 ? 0x0a1a4a : 0xf5c518;
        const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(sPos.x, sPos.y + s.h + 0.2, sPos.z);
        roof.rotation.y = sAngle;
        roof.castShadow = true;
        this._add(roof);

        // Red-white-red seats
        const sSeatColors = [0xcc0000, 0xffffff, 0xcc0000];
        const sRows = 2;
        const sCols = Math.floor(s.w / 2);
        for (let r = 0; r < sRows; r++) {
          for (let c = 0; c < sCols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.45, 0.6, 0.45);
            const seatMat = new THREE.MeshStandardMaterial({ color: sSeatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - sCols / 2 + 0.5) * 1.7;
            const localZ = (r - 0.5) * (s.d / 3);
            const cosA = Math.cos(sAngle), sinA = Math.sin(sAngle);
            seat.position.set(
              sPos.x + localX * cosA + localZ * sinA,
              sPos.y + 0.4 + r * 1.0,
              sPos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = sAngle;
            this._add(seat);
          }
        }
      }
    }

    // ============================================================
    // 5. ALPINE CONIFER TREES - Additional mountain vegetation
    //    (supplements the theme trees with more mountain-specific conifers)
    // ============================================================
    {
      const coniferCount = 60;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 4.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x463918, roughness: 0.9 });
      // Alpine dark green conifers
      const leafGeo1 = new THREE.ConeGeometry(1.5, 5.5, 8);
      const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x1a5a1a, roughness: 0.85 });
      const leafGeo2 = new THREE.ConeGeometry(1.2, 4.5, 7);
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x2a6a2a, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, coniferCount);
      const leaves1 = new THREE.InstancedMesh(leafGeo1, leafMat1, Math.floor(coniferCount * 0.6));
      const leaves2 = new THREE.InstancedMesh(leafGeo2, leafMat2, Math.ceil(coniferCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < coniferCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 16 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
        const scale = 0.7 + Math.random() * 0.7;

        // Trunk
        dummy.position.set(x, y + 2.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        if (i < coniferCount * 0.6) {
          dummy.position.set(x, y + 5.5 * scale, z);
          dummy.updateMatrix();
          leaves1.setMatrixAt(idx1++, dummy.matrix);
        } else {
          dummy.position.set(x, y + 5.0 * scale, z);
          dummy.updateMatrix();
          leaves2.setMatrixAt(idx2++, dummy.matrix);
        }
      }

      trunkMesh.count = coniferCount;
      leaves1.count = idx1;
      leaves2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leaves1.instanceMatrix.needsUpdate = true;
      leaves2.instanceMatrix.needsUpdate = true;
      this._add(trunkMesh);
      this._add(leaves1);
      this._add(leaves2);
    }

    // ============================================================
    // 6. SPONSOR BOARDS - F1 & Red Bull ecosystem sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'RED BULL', bg: '#0a1a4a', fg: '#f5c518' },
        { name: 'ASTON MARTIN', bg: '#006a4e', fg: '#ffffff' },
        { name: 'MOBIL 1', bg: '#003399', fg: '#ffffff' },
        { name: 'TAG HEUER', bg: '#1a1a1a', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
      ];

      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;

        if (this.distToTrack(x, z) < hw + 8) continue;

        const sponsor = sponsors[i % sponsors.length];

        // Post
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0, z);
        this._add(post);

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
        const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.set(x, 4.5, z);
        board.rotation.y = Math.atan2(tangent.x, tangent.z);
        board.castShadow = true;
        this._add(board);
      }
    }

    // ============================================================
    // 7. TIRE WALLS - Key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.10, side: -1 },
        { t: 0.20, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.50, side: 1 },
        { t: 0.65, side: -1 },
        { t: 0.78, side: 1 },
        { t: 0.90, side: -1 },
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
          this._add(tire);
        }
      }
    }

    // ============================================================
    // 8. AUSTRIAN FLAG BANNERS - Along the main straight
    // ============================================================
    {
      const bannerPositions = [
        { t: 0.01, side: 1 },
        { t: 0.04, side: -1 },
        { t: 0.07, side: 1 },
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
        this._add(pole);

        // Austrian flag (red-white-red horizontal stripes)
        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128; flagCanvas.height = 96;
        const fCtx = flagCanvas.getContext('2d');
        fCtx.fillStyle = '#cc0000';
        fCtx.fillRect(0, 0, 128, 32);
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(0, 32, 128, 32);
        fCtx.fillStyle = '#cc0000';
        fCtx.fillRect(0, 64, 128, 32);
        const flagTex = new THREE.CanvasTexture(flagCanvas);

        const flagGeo = new THREE.PlaneGeometry(1.8, 1.4);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(bPos.x, bPos.y + 4.2, bPos.z);
        flag.rotation.y = bAngle;
        this._add(flag);
      }
    }
  }

  /**
   * Autódromo Hermanos Rodríguez (Mexico City)
   * Features: Foro Sol stadium section, high-altitude environment,
   *           Mexican tricolor decorations, grandstands, sponsor boards,
   *           papel picado banners, cactus vegetation
   */
  _buildRodriguezScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Mexico tricolor: green, white, red)
      const seatColors = [0x006847, 0xffffff, 0xce1126];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

    // ============================================================
    // 1. FORO SOL STADIUM - The iconic stadium section
    //    The track passes through a massive stadium with
    //    steep concrete stands on both sides
    // ============================================================
    {
      // Stadium position: around t=0.3 (the tight chicane section)
      const stadiumT = 0.30;
      const p = this.spline.getPointAt(stadiumT);
      const tangent = this.spline.getTangentAt(stadiumT);
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
        this._add(stand);

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
            this._add(tierMesh);
          }
        }

        // Stadium roof overhang
        const roofGeo = new THREE.BoxGeometry(stadiumW + 4, 0.5, 6);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.4 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(sx, p.y + stadiumH + 0.5, sz + side * -4);
        roof.rotation.y = angle;
        this._add(roof);
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
          this._add(sign);
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
        this._add(pit);

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
          this._add(g);
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
        this._add(sign);
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
        this._add(pylon);

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
        this._add(flag);
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

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx = 0;
      for (let i = 0; i < cactusCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 18 && attempts < 50);
        if (attempts >= 50) continue;

        const y = this.getTerrainHeight(x, z);
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
      this._add(trunkMesh);
      this._add(leafMesh);
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
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
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
          this._add(pole);
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
        this._add(banner);
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
          this._add(tire);
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
        if (this.distToTrack(x, z) < hw + 30) continue;

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
        const y = this.getTerrainHeight(x, z);
        sign.position.set(x, y + 3, z);
        this._add(sign);

        // Post
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, y + 1.5, z);
        this._add(post);
      }
    }
  }

  /**
   * Circuit Zandvoort (Netherlands) - Beach/dune circuit
   * Features: North Sea sand dunes, orange army (Verstappen fans),
   *          grandstands with Dutch orange theme, sponsor boards,
   *          coastal atmosphere, marram grass vegetation
   */
  _buildZandvoortScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Dutch orange army theme: orange, white, blue)
      const seatColors = [0xff6600, 0xffffff, 0x003399];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

    // ============================================================
    // 1. SAND DUNES - North Sea coastal dune landscape
    //    Zandvoort is literally on the sand, surrounded by dunes
    // ============================================================
    {
      const duneGeo = new THREE.SphereGeometry(4, 8, 6);
      const duneMat = new THREE.MeshStandardMaterial({ color: 0xd4c090, roughness: 1.0 });
      const duneCount = 30;

      for (let i = 0; i < duneCount; i++) {
        const t = Math.random();
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 20 + Math.random() * 50;
        const dx = p.x + right.x * dist * side;
        const dz = p.z + right.z * dist * side;
        if (this.distToTrack(dx, dz) < hw + 18) continue;

        const dune = new THREE.Mesh(duneGeo, duneMat);
        const scale = 0.6 + Math.random() * 2.0;
        dune.position.set(dx, this.getTerrainHeight(dx, dz) - 0.3, dz);
        dune.scale.set(scale * (1 + Math.random()), scale * 0.35, scale * (1 + Math.random()));
        this._add(dune);
      }

      // Extra tall dune ridges (signature Zandvoort feature)
      const ridgeMat = new THREE.MeshStandardMaterial({ color: 0xc8b480, roughness: 0.95 });
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = 100 + Math.random() * 60;
        const rx = Math.cos(angle) * r;
        const rz = Math.sin(angle) * r;
        if (this.distToTrack(rx, rz) < hw + 40) continue;

        const ridgeGeo = new THREE.BoxGeometry(30 + Math.random() * 20, 3 + Math.random() * 3, 60 + Math.random() * 40);
        const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
        ridge.position.set(rx, -0.5, rz);
        ridge.rotation.y = angle;
        this._add(ridge);
      }
    }

    // ============================================================
    // 2. MARRAM GRASS - Coastal dune grass vegetation
    //    Sparse, windswept vegetation typical of Dutch dunes
    // ============================================================
    {
      const grassCount = 80;
      const trunkGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.2, 4);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b8a3a, roughness: 0.9 });
      const leafGeo1 = new THREE.ConeGeometry(0.3, 1.8, 5);
      const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x5a8a2a, roughness: 0.9 });
      const leafGeo2 = new THREE.ConeGeometry(0.25, 1.4, 5);
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x7aa83a, roughness: 0.9 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, grassCount);
      const leaves1 = new THREE.InstancedMesh(leafGeo1, leafMat1, Math.floor(grassCount * 0.6));
      const leaves2 = new THREE.InstancedMesh(leafGeo2, leafMat2, Math.ceil(grassCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < grassCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 18 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
        const scale = 0.5 + Math.random() * 0.8;

        // Trunk
        dummy.position.set(x, y + 0.6 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        if (i < grassCount * 0.6) {
          dummy.position.set(x, y + 1.5 * scale, z);
          dummy.updateMatrix();
          leaves1.setMatrixAt(idx1++, dummy.matrix);
        } else {
          dummy.position.set(x, y + 1.3 * scale, z);
          dummy.updateMatrix();
          leaves2.setMatrixAt(idx2++, dummy.matrix);
        }
      }

      trunkMesh.count = grassCount;
      leaves1.count = idx1;
      leaves2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leaves1.instanceMatrix.needsUpdate = true;
      leaves2.instanceMatrix.needsUpdate = true;
      this._add(trunkMesh);
      this._add(leaves1);
      this._add(leaves2);
    }

    // ============================================================
    // 3. ORANGE ARMY FLAGS - Verstappen fan banners
    //    The iconic sea of orange at the Dutch GP
    // ============================================================
    {
      const flagPositions = [
        { t: 0.02, side: 1 }, { t: 0.04, side: -1 },
        { t: 0.08, side: 1 }, { t: 0.12, side: -1 },
        { t: 0.16, side: 1 }, { t: 0.20, side: -1 },
        { t: 0.24, side: 1 }, { t: 0.28, side: -1 },
        { t: 0.32, side: 1 }, { t: 0.36, side: -1 },
        { t: 0.40, side: 1 }, { t: 0.44, side: -1 },
        { t: 0.48, side: 1 }, { t: 0.52, side: -1 },
        { t: 0.56, side: 1 }, { t: 0.60, side: -1 },
        { t: 0.64, side: 1 }, { t: 0.68, side: -1 },
        { t: 0.72, side: 1 }, { t: 0.76, side: -1 },
        { t: 0.80, side: 1 }, { t: 0.84, side: -1 },
        { t: 0.88, side: 1 }, { t: 0.92, side: -1 },
        { t: 0.96, side: 1 }, { t: 0.99, side: -1 },
      ];

      // Orange Verstappen flags
      const orangeFlagCanvas = document.createElement('canvas');
      orangeFlagCanvas.width = 128; orangeFlagCanvas.height = 96;
      const oCtx = orangeFlagCanvas.getContext('2d');
      oCtx.fillStyle = '#ff6600';
      oCtx.fillRect(0, 0, 128, 96);
      oCtx.fillStyle = '#ffffff';
      oCtx.font = 'bold 36px Arial';
      oCtx.textAlign = 'center';
      oCtx.textBaseline = 'middle';
      oCtx.fillText('P1', 64, 48);
      const orangeFlagTex = new THREE.CanvasTexture(orangeFlagCanvas);

      // Dutch flag (red-white-blue)
      const dutchFlagCanvas = document.createElement('canvas');
      dutchFlagCanvas.width = 128; dutchFlagCanvas.height = 96;
      const dCtx = dutchFlagCanvas.getContext('2d');
      dCtx.fillStyle = '#ae1c28';
      dCtx.fillRect(0, 0, 128, 32);
      dCtx.fillStyle = '#ffffff';
      dCtx.fillRect(0, 32, 128, 32);
      dCtx.fillStyle = '#21468b';
      dCtx.fillRect(0, 64, 128, 32);
      const dutchFlagTex = new THREE.CanvasTexture(dutchFlagCanvas);

      // Max 1 flag
      const maxFlagCanvas = document.createElement('canvas');
      maxFlagCanvas.width = 128; maxFlagCanvas.height = 96;
      const mCtx = maxFlagCanvas.getContext('2d');
      mCtx.fillStyle = '#ff6600';
      mCtx.fillRect(0, 0, 128, 96);
      mCtx.fillStyle = '#003399';
      mCtx.font = 'bold 28px Arial';
      mCtx.textAlign = 'center';
      mCtx.textBaseline = 'middle';
      mCtx.fillText('MAX', 64, 32);
      mCtx.fillText('1', 64, 68);
      const maxFlagTex = new THREE.CanvasTexture(maxFlagCanvas);

      const flagTextures = [orangeFlagTex, dutchFlagTex, maxFlagTex];

      for (const fp of flagPositions) {
        const { pos: fPos, angle: fAngle } = safeOffset(fp.t, hw + 5, fp.side);
        if (!isSafe(fPos.x, fPos.z, 1)) continue;

        // Flag pole
        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 4.5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(fPos.x, fPos.y + 2.25, fPos.z);
        this._add(pole);

        // Flag
        const flagTex = flagTextures[Math.floor(Math.random() * flagTextures.length)];
        const flagGeo = new THREE.PlaneGeometry(1.8, 1.3);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(fPos.x, fPos.y + 3.8, fPos.z);
        flag.rotation.y = fAngle;
        this._add(flag);
      }
    }

    // ============================================================
    // 4. MAIN GRANDSTAND - Start/Finish straight
    //    Orange-themed grandstand for the Dutch GP
    // ============================================================
    placeStand(0.03, hw + 20, 1, 40, 9, 9, 0x333344, 0xff6600);

    // Pit building - opposite side (t=0.06)
    {
      const { pos, angle } = safeOffset(0.06, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 35, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        this._add(pit);

        // Pit garages with Dutch colors (orange + blue + white)
        const garageColors = [0xff6600, 0x003399, 0xffffff, 0xff6600, 0x003399];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.2;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          this._add(g);
        }

        // ZANDVOORT sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#ff6600';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 40px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('CIRCUIT ZANDVOORT', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(16, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        this._add(sign);
      }
    }

    // ============================================================
    // 5. SECONDARY GRANDSTANDS - Key corners
    // ============================================================
    placeStand(0.20, hw + 18, -1, 26, 7, 7, 0x333344, 0xff6600);
    placeStand(0.40, hw + 20, 1, 22, 5, 6, 0x2a3a4a, 0x003399);
    placeStand(0.60, hw + 18, -1, 28, 7, 7, 0x3a3a4a, 0xff6600);
    placeStand(0.80, hw + 20, 1, 20, 5, 6, 0x2a3a4a, 0x003399);

    // ============================================================
    // 6. HUGO BOSS / RED BULL PIT COMPLEX - Prominent structures
    //    Red Bull is the dominant team at Zandvoort (Verstappen)
    // ============================================================
    {
      // Red Bull hospitality building near start/finish
      const { pos: rbPos, angle: rbAngle } = safeOffset(0.95, hw + 30, 1);
      if (isSafe(rbPos.x, rbPos.z, 10)) {
        // Main building - dark navy blue (Red Bull)
        const bodyGeo = new THREE.BoxGeometry(20, 8, 10);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.4, metalness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(rbPos.x, rbPos.y + 4, rbPos.z);
        body.rotation.y = rbAngle;
        body.castShadow = true;
        body.receiveShadow = true;
        this._add(body);

        // Orange accent stripe (Verstappen orange)
        const stripeGeo = new THREE.BoxGeometry(20.2, 1.2, 10.2);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.3, metalness: 0.4 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(rbPos.x, rbPos.y + 6.5, rbPos.z);
        stripe.rotation.y = rbAngle;
        this._add(stripe);

        // "RED BULL RACING" sign
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 128;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#0a1a4a';
        signCtx.fillRect(0, 0, 512, 128);
        signCtx.fillStyle = '#ff6600';
        signCtx.font = 'bold 48px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('RED BULL RACING', 256, 64);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(12, 3);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(rbPos.x, rbPos.y + 9.5, rbPos.z);
        sign.rotation.y = rbAngle;
        this._add(sign);

        // Garage doors (orange)
        for (let i = 0; i < 6; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3.5);
          const gMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(rbAngle), sinA = Math.sin(rbAngle);
          const localX = (i - 2.5) * 3.0;
          g.position.set(
            rbPos.x + localX * cosA - 5 * sinA,
            rbPos.y + 1.8,
            rbPos.z - localX * sinA + 5 * cosA
          );
          g.rotation.y = rbAngle;
          this._add(g);
        }
      }
    }

    // ============================================================
    // 7. SPONSOR BOARDS - Dutch GP / F1 sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'DUTCH GP', bg: '#ff6600', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'ZANDVOORT', bg: '#ff6600', fg: '#003399' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'F1', bg: '#e10600', fg: '#ffffff' },
        { name: 'ORANJE', bg: '#ff6600', fg: '#ffffff' },
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
        { t: 0.10, side: -1 },
        { t: 0.20, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.50, side: 1 },
        { t: 0.65, side: -1 },
        { t: 0.78, side: 1 },
        { t: 0.90, side: -1 },
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
          this._add(tire);
        }
      }
    }

    // ============================================================
    // 9. WIND SHIELD FENCES - Coastal wind protection
    //    Glass/acrylic wind fences common at Zandvoort
    // ============================================================
    {
      const fencePositions = [
        { t: 0.05, side: 1, count: 6 },
        { t: 0.15, side: -1, count: 5 },
        { t: 0.25, side: 1, count: 6 },
        { t: 0.35, side: -1, count: 5 },
        { t: 0.45, side: 1, count: 6 },
        { t: 0.55, side: -1, count: 5 },
        { t: 0.65, side: 1, count: 6 },
        { t: 0.75, side: -1, count: 5 },
        { t: 0.85, side: 1, count: 6 },
        { t: 0.95, side: -1, count: 5 },
      ];

      for (const fp of fencePositions) {
        const { pos: fPos, angle: fAngle, tangent } = safeOffset(fp.t, hw + 12, fp.side);
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
          this._add(post);

          // Transparent panel
          const panelGeo = new THREE.PlaneGeometry(2.2, 3);
          const panelMat = new THREE.MeshStandardMaterial({
            color: 0xaabbcc,
            transparent: true,
            opacity: 0.25,
            roughness: 0.1,
            metalness: 0.3,
            side: THREE.DoubleSide
          });
          const panel = new THREE.Mesh(panelGeo, panelMat);
          panel.position.set(fx, fPos.y + 2, fz);
          panel.rotation.y = fAngle;
          this._add(panel);
        }
      }
    }

    // ============================================================
    // 10. DUTCH ORANGE BANNERS - String banners along the straight
    // ============================================================
    {
      const bannerCount = 8;
      for (let i = 0; i < bannerCount; i++) {
        const t = (i + 0.5) / bannerCount;
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const angle = Math.atan2(tangent.x, tangent.z);

        // Two poles on each side of track
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        for (let side of [-1, 1]) {
          const dist = hw + 3;
          const bx = p.x + right.x * dist * side;
          const bz = p.z + right.z * dist * side;

          const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 5, 6);
          const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(bx, p.y + 2.5, bz);
          this._add(pole);
        }

        // Banner string across track (orange)
        const bannerGeo = new THREE.PlaneGeometry(hw * 2 - 2, 1.0);
        const bannerColor = i % 3 === 0 ? 0xff6600 : (i % 3 === 1 ? 0x003399 : 0xffffff);
        const bannerMat = new THREE.MeshStandardMaterial({
          color: bannerColor,
          side: THREE.DoubleSide,
          roughness: 0.9
        });
        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(p.x, p.y + 5, p.z);
        banner.rotation.y = angle;
        this._add(banner);
      }
    }
  }

  /**
   * Miami Grand Prix (Florida) - Stadium-style circuit
   * Features: Hard Rock Stadium structure, palm trees, waterfront/marina,
   *          grandstands with Miami teal/orange theme, sponsor boards,
   *          tropical landscaping, luxury yacht marina
   */
  _buildMiamiScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Miami colors: teal/orange/white)
      const seatColors = [0x00838f, 0xff6d00, 0xffffff];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

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
      this._add(stadium);

      // Stadium ring (top edge) - teal accent
      const ringGeo = new THREE.TorusGeometry(25, 0.8, 8, 24);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x00838f, roughness: 0.3, metalness: 0.5 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(stadiumPos.x, stadiumPos.y + 12, stadiumPos.z);
      ring.rotation.x = Math.PI / 2;
      this._add(ring);

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
        this._add(roofSeg);
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
        this._add(pole);

        // Light bank
        const lightGeo = new THREE.BoxGeometry(4, 1.2, 0.5);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.8, roughness: 0.1
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(lx, stadiumPos.y + 20.5, lz);
        light.rotation.y = stadiumAngle;
        this._add(light);
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
      this._add(sign);
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
        this._add(pit);

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
          this._add(g);
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

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < palmCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 16 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
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
      this._add(trunkMesh);
      this._add(canopy1);
      this._add(canopy2);
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
      this._add(water);

      // Dock / pier
      const dockGeo = new THREE.BoxGeometry(40, 0.3, 6);
      const dockMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 });
      const dock = new THREE.Mesh(dockGeo, dockMat);
      dock.position.set(waterPos.x, -0.7, waterPos.z + 18);
      dock.rotation.y = waterAngle;
      this._add(dock);

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
        this._add(boat);

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
          this._add(cabin);
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
        if (this.distToTrack(x, z) < hw + 25) continue;

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
        this._add(building);

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
            this._add(win);
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
          this._add(pool);
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
          if (this.distToTrack(cx, cz) < hw + 12) continue;

          const cy = this.getTerrainHeight(cx, cz);
          const scale = 0.9 + Math.random() * 0.5;

          const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 6 * scale, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.set(cx, cy + 3 * scale, cz);
          this._add(trunk);

          const canopyGeo = new THREE.ConeGeometry(2.2 * scale, 1.8 * scale, 6);
          const canopyMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
          const canopy = new THREE.Mesh(canopyGeo, canopyMat);
          canopy.position.set(cx, cy + 6.5 * scale, cz);
          this._add(canopy);
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
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;

        if (this.distToTrack(x, z) < hw + 8) continue;

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
          this._add(tire);
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
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 25 + Math.random() * 35;
        const sx = p.x + right.x * dist * side;
        const sz = p.z + right.z * dist * side;
        if (this.distToTrack(sx, sz) < hw + 20) continue;

        const dune = new THREE.Mesh(sandGeo, sandMat);
        const scale = 0.4 + Math.random() * 1.2;
        dune.position.set(sx, this.getTerrainHeight(sx, sz) - 0.3, sz);
        dune.scale.set(scale * (1 + Math.random()), scale * 0.3, scale * (1 + Math.random()));
        this._add(dune);
      }
    }
  }


  /**
   * Las Vegas Street Circuit - Night race on the Strip
   * Features: casino buildings, neon signs, street lamps, grandstands,
   *          sponsor billboards, night-time dark atmosphere
   */
  _buildVegasScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

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
        this._add(building);

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
          this._add(crown);
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
        this._add(sign);

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
              this._add(win);
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

        const archSpan = (this._trackWidth || CONFIG.trackWidth) + 10;
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
        this._add(leftPillar);

        const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
        rightPillar.position.set(
          pos.x + perpX * archSpan / 2,
          pos.y + archH / 2,
          pos.z + perpZ * archSpan / 2
        );
        this._add(rightPillar);

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
        this._add(beam);

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
          this._add(deco);
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
        this._add(pole);

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
        this._add(arm);

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
        this._add(bulb);
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
        this._add(stand);

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
        this._add(roof);

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
            this._add(seat);
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
          this._add(post);
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
        this._add(board);

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
        this._add(frame);
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
          this._add(tire);
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
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
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
        this._add(strip);
      }
    }
  }

  /**
   * Jeddah Corniche Circuit (Saudi Arabia) - Night street race
   * Features: Red Sea waterfront barriers, modern glass skyscrapers,
   *          floodlight towers, Saudi-themed grandstands, sponsor boards,
   *          street lamps, flag poles
   */
  _buildJeddahScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;
      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);
      const seatColors = [0x00843d, 0xffffff, 0x00843d];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;
      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);
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
      this._add(board);
    };

    const placeBuilding = (x, z, w, d, h, glassColor) => {
      if (!isSafe(x, z, Math.max(w, d) / 2 + 2)) return;
      if (this.distToTrack(x, z) < hw + 8) return;
      const bodyGeo = new THREE.BoxGeometry(w, h, d);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.2, metalness: 0.7 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(x, h / 2 - 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      this._add(body);
      const glassMat = new THREE.MeshStandardMaterial({ color: glassColor, emissive: glassColor, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.8 });
      const panelGeo = new THREE.PlaneGeometry(w * 0.8, h * 0.8);
      const panel1 = new THREE.Mesh(panelGeo, glassMat);
      panel1.position.set(x, h / 2 - 2, z + d / 2 + 0.05);
      this._add(panel1);
      const panel2 = new THREE.Mesh(panelGeo, glassMat);
      panel2.position.set(x, h / 2 - 2, z - d / 2 - 0.05);
      panel2.rotation.y = Math.PI;
      this._add(panel2);
    };

    const placeFloodlight = (t, dist, side) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;
      const towerH = 20;
      const poleGeo = new THREE.CylinderGeometry(0.25, 0.45, towerH, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.4, metalness: 0.6 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(pos.x, pos.y + towerH / 2, pos.z);
      pole.castShadow = true;
      this._add(pole);
      const armGeo = new THREE.BoxGeometry(7, 0.4, 0.8);
      const armMat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.4, metalness: 0.5 });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(pos.x, pos.y + towerH, pos.z);
      arm.rotation.y = angle;
      this._add(arm);
      const lightBankGeo = new THREE.BoxGeometry(6, 1.5, 0.6);
      const lightBankMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.5, roughness: 0.1 });
      const lightBank = new THREE.Mesh(lightBankGeo, lightBankMat);
      lightBank.position.set(pos.x, pos.y + towerH - 1.2, pos.z);
      lightBank.rotation.y = angle;
      this._add(lightBank);
      const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.5, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(pos.x, pos.y + 0.25, pos.z);
      this._add(base);
    };

    // 1. COASTAL BARRIERS
    {
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.6, metalness: 0.3 });
      for (let i = 0; i < 10; i++) {
        const t = (i + 0.5) / 10;
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const angle = Math.atan2(tangent.x, tangent.z);
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 4;
        const wx = p.x + right.x * dist * side;
        const wz = p.z + right.z * dist * side;
        if (!isSafe(wx, wz, 3)) continue;
        const wallGeo = new THREE.BoxGeometry(8, 1.5, 0.5);
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(wx, p.y + 0.75, wz);
        wall.rotation.y = angle;
        wall.castShadow = true;
        this._add(wall);
      }
    }

    // 2. FLOODLIGHT TOWERS
    {
      const positions = [
        { t: 0.03, side: 1 }, { t: 0.08, side: -1 },
        { t: 0.14, side: 1 }, { t: 0.20, side: -1 },
        { t: 0.26, side: 1 }, { t: 0.32, side: -1 },
        { t: 0.38, side: 1 }, { t: 0.44, side: -1 },
        { t: 0.50, side: 1 }, { t: 0.56, side: -1 },
        { t: 0.62, side: 1 }, { t: 0.68, side: -1 },
        { t: 0.74, side: 1 }, { t: 0.80, side: -1 },
        { t: 0.86, side: 1 }, { t: 0.92, side: -1 },
        { t: 0.97, side: 1 },
      ];
      for (const fl of positions) {
        placeFloodlight(fl.t, hw + 14, fl.side);
      }
    }

    // 3. MODERN SKYSCRAPERS
    {
      const buildings = [
        { x: 180, z: -250, w: 14, d: 14, h: 45, gc: 0x1a3355 },
        { x: 220, z: -240, w: 12, d: 12, h: 55, gc: 0x1a4466 },
        { x: 260, z: -230, w: 16, d: 16, h: 38, gc: 0x1a3355 },
        { x: 300, z: -210, w: 10, d: 10, h: 50, gc: 0x225577 },
        { x: 340, z: -100, w: 12, d: 12, h: 42, gc: 0x1a4466 },
        { x: 350, z: 0, w: 14, d: 14, h: 48, gc: 0x1a3355 },
        { x: 330, z: 100, w: 10, d: 10, h: 36, gc: 0x225577 },
        { x: 280, z: 160, w: 16, d: 16, h: 52, gc: 0x1a4466 },
        { x: 200, z: 190, w: 12, d: 12, h: 40, gc: 0x1a3355 },
        { x: 100, z: 170, w: 14, d: 14, h: 46, gc: 0x225577 },
        { x: -10, z: 150, w: 10, d: 10, h: 54, gc: 0x1a4466 },
        { x: -50, z: -240, w: 12, d: 12, h: 44, gc: 0x1a3355 },
        { x: -80, z: -250, w: 16, d: 16, h: 38, gc: 0x225577 },
        { x: -120, z: -200, w: 10, d: 10, h: 60, gc: 0x1a4466 },
        { x: -140, z: -170, w: 14, d: 14, h: 42, gc: 0x1a3355 },
        { x: 120, z: -240, w: 8, d: 8, h: 28, gc: 0x224466 },
        { x: 160, z: -230, w: 10, d: 10, h: 32, gc: 0x1a3355 },
        { x: 250, z: -190, w: 8, d: 8, h: 30, gc: 0x225577 },
        { x: 320, z: -50, w: 10, d: 10, h: 26, gc: 0x1a4466 },
        { x: 310, z: 50, w: 8, d: 8, h: 34, gc: 0x224466 },
        { x: 250, z: 140, w: 10, d: 10, h: 28, gc: 0x1a3355 },
        { x: 50, z: 160, w: 8, d: 8, h: 30, gc: 0x225577 },
        { x: -30, z: -230, w: 10, d: 10, h: 36, gc: 0x1a4466 },
        { x: -90, z: -240, w: 8, d: 8, h: 32, gc: 0x224466 },
        { x: 200, z: -260, w: 10, d: 10, h: 40, gc: 0x1a3355 },
        { x: 280, z: -240, w: 8, d: 8, h: 48, gc: 0x225577 },
        { x: 350, z: -60, w: 10, d: 10, h: 44, gc: 0x1a4466 },
        { x: 340, z: 60, w: 8, d: 8, h: 38, gc: 0x1a3355 },
        { x: 220, z: 200, w: 10, d: 10, h: 42, gc: 0x225577 },
        { x: -100, z: -230, w: 12, d: 12, h: 50, gc: 0x1a4466 },
      ];
      for (const b of buildings) {
        placeBuilding(b.x, b.z, b.w, b.d, b.h, b.gc);
      }
    }

    // 4. MAIN GRANDSTAND
    placeStand(0.03, hw + 22, 1, 45, 10, 10, 0x1a2a1a, 0x00843d);

    // Pit building
    {
      const { pos, angle } = safeOffset(0.07, hw + 20, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 40, pitH = 5, pitD = 8;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.4, metalness: 0.5 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        this._add(pit);
        const garageColors = [0x00843d, 0xffffff, 0x00843d, 0xffffff, 0x00843d];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.8;
          g.position.set(pos.x + localX * cosA - (pitD / 2) * sinA, pos.y + 0.5, pos.z - localX * sinA + (pitD / 2) * cosA);
          g.rotation.y = angle;
          this._add(g);
        }
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#00843d';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 32px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('JEDDAH CORNICHE CIRCUIT', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(16, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        this._add(sign);
      }
    }

    // 5. SECONDARY GRANDSTANDS
    placeStand(0.18, hw + 22, -1, 30, 8, 8, 0x1a2a1a, 0x00843d);
    placeStand(0.35, hw + 20, 1, 24, 6, 7, 0x2a3a2a, 0x006633);
    placeStand(0.55, hw + 22, -1, 28, 7, 8, 0x1a2a1a, 0x00843d);
    placeStand(0.75, hw + 20, 1, 22, 6, 7, 0x2a3a2a, 0x006633);

    // 6. SPONSOR BOARDS
    {
      const sponsors = [
        { name: 'SAUDI ARAMCO', bg: '#004d2d', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'ARAMCO', bg: '#004d2d', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'CROWNSTELL', bg: '#1a1a2e', fg: '#c0a060' },
        { name: 'SAUDI GP', bg: '#004d2d', fg: '#ffffff' },
        { name: 'JEDDAH GP', bg: '#1a1a2e', fg: '#00843d' },
        { name: 'F1', bg: '#e10600', fg: '#ffffff' },
      ];
      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;
        if (this.distToTrack(x, z) < hw + 8) continue;
        placeBoard(t, dist, side, sponsors[i % sponsors.length]);
      }
    }

    // 7. STREET LAMP POSTS
    {
      const lampCount = 24;
      for (let i = 0; i < lampCount; i++) {
        const t = (i + 0.5) / lampCount;
        const { pos } = safeOffset(t, hw + 6, i % 2 === 0 ? 1 : -1);
        if (!isSafe(pos.x, pos.z, 2)) continue;
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.7 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 2.5, pos.z);
        this._add(pole);
        const lampGeo = new THREE.SphereGeometry(0.3, 6, 6);
        const lampMat = new THREE.MeshStandardMaterial({ color: 0xffeedd, emissive: 0xffeebb, emissiveIntensity: 1.2, roughness: 0.1 });
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(pos.x, pos.y + 5.2, pos.z);
        this._add(lamp);
      }
    }

    // 8. TIRE WALLS
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const tirePositions = [
        { t: 0.10, side: -1 }, { t: 0.22, side: 1 },
        { t: 0.36, side: -1 }, { t: 0.48, side: 1 },
        { t: 0.62, side: -1 }, { t: 0.76, side: 1 },
        { t: 0.88, side: -1 }, { t: 0.95, side: 1 },
      ];
      for (const tp of tirePositions) {
        const { pos } = safeOffset(tp.t, hw + 4, tp.side);
        if (!isSafe(pos.x, pos.z, 1)) continue;
        for (let j = 0; j < 4; j++) {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          tire.position.set(pos.x + (j % 2) * 1.0 - 0.5, pos.y + 0.35 + Math.floor(j / 2) * 0.7, pos.z + (Math.floor(j / 2)) * 0.5);
          tire.rotation.x = Math.PI / 2;
          this._add(tire);
        }
      }
    }

    // 9. SAUDI FLAG POLES
    {
      const flagColors = [0x00843d, 0xffffff];
      const flagPositions = [
        { t: 0.02, side: 1 }, { t: 0.04, side: -1 },
        { t: 0.06, side: 1 }, { t: 0.08, side: -1 },
      ];
      for (const fp of flagPositions) {
        const { pos } = safeOffset(fp.t, hw + 8, fp.side);
        if (!isSafe(pos.x, pos.z, 2)) continue;
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 8, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 4, pos.z);
        this._add(pole);
        const flagGeo = new THREE.PlaneGeometry(2, 1.2);
        for (let f = 0; f < 2; f++) {
          const flagMat = new THREE.MeshStandardMaterial({ color: flagColors[f], side: THREE.DoubleSide });
          const flag = new THREE.Mesh(flagGeo, flagMat);
          flag.position.set(pos.x, pos.y + 7 - f * 1.5, pos.z + 0.5);
          this._add(flag);
        }
      }
    }
  }



  /**
   * Marina Bay (Singapore) - Iconic night street race
   * Features: city skyline buildings, Gardens by the Bay supertrees,
   *          floodlight towers, night lighting, grandstands, sponsor boards
   */
  _buildMarinaBayScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Singapore red + white + silver)
      const seatColors = [0xcc0000, 0xffffff, 0xcccccc];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

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
        this._add(building);

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
            this._add(win);
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
        this._add(trunk);

        // Canopy: inverted cone at the top
        const canopyGeo = new THREE.ConeGeometry(5, 4, 8);
        const canopyMat = new THREE.MeshStandardMaterial({
          color: 0x3a8a4a, emissive: 0x22aa44, emissiveIntensity: 0.4,
          roughness: 0.6, side: THREE.DoubleSide
        });
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.set(pos.x, pos.y + treeH + 1, pos.z);
        canopy.rotation.x = Math.PI;
        this._add(canopy);

        // Illuminated ring at the canopy edge
        const ringGeo = new THREE.TorusGeometry(4.5, 0.15, 8, 24);
        const ringColor = [0x00ffaa, 0xff6600, 0x0088ff, 0xff0066, 0xaa00ff][Math.floor(Math.random() * 5)];
        const ringMat = new THREE.MeshStandardMaterial({
          color: ringColor, emissive: ringColor, emissiveIntensity: 1.0, roughness: 0.2
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(pos.x, pos.y + treeH + 1, pos.z);
        ring.rotation.x = Math.PI / 2;
        this._add(ring);

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
          this._add(strand);
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
        this._add(pole);

        // Cross-arm at top
        const armGeo = new THREE.BoxGeometry(5, 0.35, 0.7);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x666677, roughness: 0.4, metalness: 0.5 });
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(pos.x, pos.y + towerH, pos.z);
        arm.rotation.y = angle;
        this._add(arm);

        // Light bank (bright white glow for night illumination)
        const lightBankGeo = new THREE.BoxGeometry(4.5, 1.2, 0.5);
        const lightBankMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.5, roughness: 0.1
        });
        const lightBank = new THREE.Mesh(lightBankGeo, lightBankMat);
        lightBank.position.set(pos.x, pos.y + towerH - 1.0, pos.z);
        lightBank.rotation.y = angle;
        this._add(lightBank);

        // Base plate
        const baseGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.5, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(pos.x, pos.y + 0.25, pos.z);
        this._add(base);
      }
    }

    // ============================================================
    // 4. MARINA BAY SANDS - Iconic 3-tower hotel with SkyPark
    //    Placed in the background as a landmark
    // ============================================================
    {
      const b = this.trackBounds;
      const mbsX = b ? (b.minX + b.maxX) / 2 + (b.maxX - b.minX) * 0.8 : 180;
      const mbsZ = b ? (b.minZ + b.maxZ) / 2 - (b.maxZ - b.minZ) * 0.6 : -80;
      if (this.distToTrack(mbsX, mbsZ) >= hw + 30) {
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
          this._add(tower);

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
              this._add(win);
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
        this._add(skyPark);

        // SkyPark underside edge lighting (blue accent)
        const edgeGeo = new THREE.BoxGeometry(gap * 2 + towerW + 8, 0.3, 5.2);
        const edgeMat = new THREE.MeshStandardMaterial({
          color: 0x00aaff, emissive: 0x0088ff, emissiveIntensity: 0.6
        });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(mbsX, towerH - 2.4, mbsZ);
        this._add(edge);
      }
    }

    // ============================================================
    // 5. SINGAPORE FLYER - Giant observation wheel (landmark)
    // ============================================================
    {
      const b = this.trackBounds;
      const flyerX = b ? (b.minX + b.maxX) / 2 - (b.maxX - b.minX) * 0.7 : -120;
      const flyerZ = b ? (b.minZ + b.maxZ) / 2 + (b.maxZ - b.minZ) * 0.5 : 60;
      if (this.distToTrack(flyerX, flyerZ) >= hw + 25) {
        const wheelR = 12;
        const wheelGeo = new THREE.TorusGeometry(wheelR, 0.3, 8, 48);
        const wheelMat = new THREE.MeshStandardMaterial({
          color: 0xaaaaaa, roughness: 0.4, metalness: 0.6
        });
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(flyerX, wheelR + 5, flyerZ);
        this._add(wheel);

        // Spokes
        for (let s = 0; s < 12; s++) {
          const sa = (s / 12) * Math.PI * 2;
          const spokeGeo = new THREE.CylinderGeometry(0.08, 0.08, wheelR * 2, 4);
          const spokeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
          const spoke = new THREE.Mesh(spokeGeo, spokeMat);
          spoke.position.set(flyerX, wheelR + 5, flyerZ);
          spoke.rotation.z = sa;
          this._add(spoke);
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
          this._add(capsule);
        }

        // Support structure (two A-frame legs)
        for (let leg = -1; leg <= 1; leg += 2) {
          const legGeo = new THREE.CylinderGeometry(0.4, 0.6, 20, 6);
          const legMat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.5, metalness: 0.5 });
          const legMesh = new THREE.Mesh(legGeo, legMat);
          legMesh.position.set(flyerX + leg * 3, 8, flyerZ);
          legMesh.rotation.z = leg * 0.15;
          legMesh.castShadow = true;
          this._add(legMesh);
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
        this._add(pit);

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
          this._add(g);
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
        this._add(sign);
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
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const color = stripColors[i % stripColors.length];

        for (let side of [-1, 1]) {
          const dist = hw + 2.5;
          const sx = p.x + right.x * dist * side;
          const sz = p.z + right.z * dist * side;

          if (this.distToTrack(sx, sz) < hw + 1) continue;

          const stripMat = new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: 0.8, roughness: 0.3
          });
          const strip = new THREE.Mesh(stripGeo, stripMat);
          strip.position.set(sx, p.y + 0.1, sz);
          strip.rotation.y = Math.atan2(tangent.x, tangent.z);
          this._add(strip);
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
          this._add(tire);
        }
      }
    }
  }


  /**
   * Autodromo Enzo e Dino Ferrari (Imola) - Italian countryside
   * Features: Tamburello chicane grandstands, Italian cypress trees,
   *           rolling hills backdrop, olive groves, vineyard rows,
   *           Italian village buildings, tricolor decorations, sponsor boards
   */
  _buildVilleneuveScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // 1. TAMBURELLO CHICANE GRANDSTAND - main (t~0.08)
    {
      const { pos, angle } = safeOffset(0.08, hw + 22, 1);
      if (isSafe(pos.x, pos.z, 15)) {
        const standW = 40, standH = 9, standD = 10;
        const standGeo = new THREE.BoxGeometry(standW, standH, standD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(pos.x, pos.y + standH / 2, pos.z);
        stand.rotation.y = angle;
        stand.castShadow = true;
        stand.receiveShadow = true;
        this._add(stand);

        const roofGeo = new THREE.BoxGeometry(standW + 3, 0.4, standD + 3);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.4, metalness: 0.2 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + standH + 0.2, pos.z);
        roof.rotation.y = angle;
        roof.castShadow = true;
        this._add(roof);

        const seatColors = [0x009246, 0xffffff, 0xce2b37];
        const rows = 4;
        const cols = Math.floor(standW / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.45, 0.65, 0.45);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - cols / 2 + 0.5) * 1.7;
            const localZ = (r - 1.5) * (standD / 3);
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            seat.position.set(
              pos.x + localX * cosA + localZ * sinA,
              pos.y + 0.5 + r * 1.2,
              pos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = angle;
            this._add(seat);
          }
        }
      }
    }

    // 2. TAMBURELLO CHICANE - opposite side grandstand
    {
      const { pos, angle } = safeOffset(0.06, hw + 20, -1);
      if (isSafe(pos.x, pos.z, 12)) {
        const standW = 30, standH = 7, standD = 8;
        const standGeo = new THREE.BoxGeometry(standW, standH, standD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x7a4020, roughness: 0.7 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(pos.x, pos.y + standH / 2, pos.z);
        stand.rotation.y = angle;
        stand.castShadow = true;
        this._add(stand);

        const roofGeo = new THREE.BoxGeometry(standW + 2, 0.35, standD + 2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x009246, roughness: 0.4, metalness: 0.2 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + standH + 0.2, pos.z);
        roof.rotation.y = angle;
        this._add(roof);

        const seatColors = [0x009246, 0xffffff, 0xce2b37];
        const rows = 3;
        const cols = Math.floor(standW / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.4, 0.6, 0.4);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - cols / 2 + 0.5) * 1.6;
            const localZ = (r - 1) * (standD / 3);
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            seat.position.set(
              pos.x + localX * cosA + localZ * sinA,
              pos.y + 0.4 + r * 1.1,
              pos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = angle;
            this._add(seat);
          }
        }
      }
    }

    // 3. VILLAGE BUILDINGS - Italian countryside with terracotta roofs
    {
      const villageBuildings = [
        { t: 0.20, side: 1, dist: 45, w: 12, h: 8, d: 10 },
        { t: 0.20, side: -1, dist: 40, w: 10, h: 6, d: 8 },
        { t: 0.35, side: 1, dist: 50, w: 14, h: 10, d: 12 },
        { t: 0.50, side: -1, dist: 45, w: 11, h: 7, d: 9 },
        { t: 0.65, side: 1, dist: 48, w: 13, h: 9, d: 11 },
        { t: 0.78, side: -1, dist: 42, w: 10, h: 6, d: 8 },
        { t: 0.90, side: 1, dist: 46, w: 12, h: 8, d: 10 },
        { t: 0.15, side: -1, dist: 38, w: 9, h: 5, d: 7 },
      ];

      const stoneColors = [0xc4a882, 0xb8986a, 0xd4b896, 0xa88a62];
      const roofTileColor = 0xc44a1a;

      for (const b of villageBuildings) {
        const { pos, angle } = safeOffset(b.t, hw + b.dist, b.side);
        if (!isSafe(pos.x, pos.z, b.w / 2 + 5)) continue;

        const bodyGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
        const bodyColor = stoneColors[Math.floor(Math.random() * stoneColors.length)];
        const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(pos.x, pos.y + b.h / 2, pos.z);
        body.rotation.y = angle;
        body.castShadow = true;
        body.receiveShadow = true;
        this._add(body);

        const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.7, 3, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: roofTileColor, roughness: 0.85 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + b.h + 1.2, pos.z);
        roof.rotation.y = Math.PI / 4 + angle;
        roof.castShadow = true;
        this._add(roof);

        const windowMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.3, metalness: 0.1 });
        const winGeo = new THREE.PlaneGeometry(1.2, 1.8);
        const floors = Math.floor(b.h / 4);
        const winCols = Math.floor(b.w / 3);
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < winCols; c++) {
            if (Math.random() > 0.7) continue;
            const win = new THREE.Mesh(winGeo, windowMat);
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            const localX = (c - winCols / 2 + 0.5) * 3;
            win.position.set(
              pos.x + localX * cosA - (b.d / 2 + 0.05) * sinA,
              pos.y + 2 + f * 3.5,
              pos.z - localX * sinA + (b.d / 2 + 0.05) * cosA
            );
            win.rotation.y = angle;
            this._add(win);
          }
        }
      }
    }

    // 4. CYPRESS TREES - Iconic Italian tall narrow cypresses
    {
      const cypressCount = 50;
      const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 4.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 0.9 });
      const leafGeo = new THREE.ConeGeometry(0.8, 8.0, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a4a1a, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, cypressCount);
      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, cypressCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx = 0;
      for (let i = 0; i < cypressCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 14 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
        const scale = 0.7 + Math.random() * 0.6;

        dummy.position.set(x, y + 2.2 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(x, y + 7.0 * scale, z);
        dummy.scale.set(scale * 0.8, scale * 1.0, scale * 0.8);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(idx, dummy.matrix);
        idx++;
      }

      trunkMesh.count = idx;
      leafMesh.count = idx;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leafMesh.instanceMatrix.needsUpdate = true;
      this._add(trunkMesh);
      this._add(leafMesh);
    }

    // 5. OLIVE GROVES - Low rounded Mediterranean trees
    {
      const oliveCount = 30;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 2.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a28, roughness: 0.9 });
      const leafGeo = new THREE.SphereGeometry(2.0, 8, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x6b8e23, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, oliveCount);
      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, oliveCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx = 0;
      for (let i = 0; i < oliveCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 15 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
        const scale = 0.6 + Math.random() * 0.5;

        dummy.position.set(x, y + 1.2 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(x, y + 3.5 * scale, z);
        dummy.scale.set(scale * 1.3, scale * 0.7, scale * 1.3);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(idx, dummy.matrix);
        idx++;
      }

      trunkMesh.count = idx;
      leafMesh.count = idx;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leafMesh.instanceMatrix.needsUpdate = true;
      this._add(trunkMesh);
      this._add(leafMesh);
    }

    // 6. VINEYARD ROWS - Parallel rows of grapevines
    {
      const vineRows = 6;
      const vinesPerRow = 12;
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
      const vineGeo = new THREE.SphereGeometry(0.8, 6, 5);
      const vineMat = new THREE.MeshStandardMaterial({ color: 0x4a8a2a, roughness: 0.85 });

      for (let row = 0; row < vineRows; row++) {
        const t = 0.3 + row * 0.1;
        if (t > 0.95) break;
        const { pos, tangent, right } = safeOffset(t, 55 + row * 5, row % 2 === 0 ? 1 : -1);
        if (!isSafe(pos.x, pos.z, 15)) continue;

        for (let v = 0; v < vinesPerRow; v++) {
          const localT = t + (v - vinesPerRow / 2) * 0.004;
          const clampedT = Math.max(0.01, Math.min(0.99, localT));
          const vp = this.spline.getPointAt(clampedT);
          const vt = this.spline.getTangentAt(clampedT);
          const vr = new THREE.Vector3(vt.z, 0, -vt.x).normalize();
          const vx = vp.x + vr.x * (55 + row * 5) * (row % 2 === 0 ? 1 : -1);
          const vz = vp.z + vr.z * (55 + row * 5) * (row % 2 === 0 ? 1 : -1);
          if (this.distToTrack(vx, vz) < 30) continue;

          const vy = this.getTerrainHeight(vx, vz);

          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(vx, vy + 1.1, vz);
          this._add(post);

          const vine = new THREE.Mesh(vineGeo, vineMat);
          vine.position.set(vx, vy + 2.0, vz);
          vine.scale.set(1 + Math.random() * 0.3, 0.6 + Math.random() * 0.3, 1 + Math.random() * 0.3);
          this._add(vine);
        }
      }
    }

    // 7. ROLLING HILLS - Soft Italian countryside terrain
    {
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x4a7a2c, roughness: 0.95 });
      const hillPositions = [
        { x: 250, z: -300, scaleX: 1.3, scaleY: 0.25, scaleZ: 1.1 },
        { x: -200, z: -250, scaleX: 1.5, scaleY: 0.3, scaleZ: 1.2 },
        { x: 300, z: 200, scaleX: 1.2, scaleY: 0.2, scaleZ: 1.4 },
        { x: -250, z: 300, scaleX: 1.4, scaleY: 0.28, scaleZ: 1.1 },
        { x: 150, z: 350, scaleX: 1.1, scaleY: 0.22, scaleZ: 1.3 },
        { x: -350, z: -150, scaleX: 1.3, scaleY: 0.26, scaleZ: 1.2 },
        { x: 400, z: -100, scaleX: 1.0, scaleY: 0.18, scaleZ: 1.0 },
        { x: -100, z: 400, scaleX: 1.2, scaleY: 0.24, scaleZ: 1.1 },
      ];

      for (const h of hillPositions) {
        if (this.distToTrack(h.x, h.z) < 50) continue;
        const hillGeo = new THREE.SphereGeometry(35, 8, 6);
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.position.set(h.x, -3, h.z);
        hill.scale.set(h.scaleX, h.scaleY, h.scaleZ);
        this._add(hill);
      }
    }

    // 8. ITALIAN FLAG BANNERS - Tricolore decorations
    {
      const bannerPositions = [
        { t: 0.02, side: 1 },
        { t: 0.05, side: -1 },
        { t: 0.12, side: 1 },
        { t: 0.88, side: -1 },
        { t: 0.94, side: 1 },
        { t: 0.97, side: -1 },
      ];

      for (const bp of bannerPositions) {
        const { pos: bPos, angle: bAngle } = safeOffset(bp.t, hw + 8, bp.side);
        if (!isSafe(bPos.x, bPos.z, 2)) continue;

        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(bPos.x, bPos.y + 2.5, bPos.z);
        this._add(pole);

        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128; flagCanvas.height = 96;
        const fCtx = flagCanvas.getContext('2d');
        fCtx.fillStyle = '#009246';
        fCtx.fillRect(0, 0, 43, 96);
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(43, 0, 42, 96);
        fCtx.fillStyle = '#ce2b37';
        fCtx.fillRect(85, 0, 43, 96);
        const flagTex = new THREE.CanvasTexture(flagCanvas);

        const flagGeo = new THREE.PlaneGeometry(1.8, 1.4);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(bPos.x, bPos.y + 4.2, bPos.z);
        flag.rotation.y = bAngle;
        this._add(flag);
      }
    }

    // 9. SPONSOR BOARDS - F1 & Italian GP sponsors
    {
      const sponsors = [
        { name: 'IMOLA', bg: '#1a3a6a', fg: '#ffffff' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'EMILIA-ROMAGNA', bg: '#006633', fg: '#ffffff' },
        { name: 'FERRARI', bg: '#cc0000', fg: '#ffffff' },
      ];

      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;

        if (this.distToTrack(x, z) < hw + 8) continue;

        const sponsor = sponsors[i % sponsors.length];

        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0, z);
        this._add(post);

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
        board.position.set(x, 4.5, z);
        board.rotation.y = Math.atan2(tangent.x, tangent.z);
        board.castShadow = true;
        this._add(board);
      }
    }

    // 10. TIRE WALLS - Key corner exits
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.10, side: -1 },
        { t: 0.20, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.50, side: 1 },
        { t: 0.65, side: -1 },
        { t: 0.78, side: 1 },
        { t: 0.90, side: -1 },
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
          this._add(tire);
        }
      }
    }
  }

  /**
   * Yas Marina Circuit (Abu Dhabi) - Twilight/Sunset waterfront race
   * Features: iconic W Abu Dhabi Yas Hotel spanning the track,
   *           marina waterfront, sunset warm lighting, palm trees,
   *           grandstands, sponsor boards, circuit tower
   */
  _buildYasMarinaScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // UAE flag colors: red, green, white, black
      const seatColors = [0xff0000, 0x009639, 0xffffff, 0x000000];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % seatColors.length] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

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
      this._add(tower1);

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
      this._add(tower2);

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
      this._add(canopy);

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
        this._add(led);
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
        this._add(led);
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
            this._add(win);
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
      this._add(sign);
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
      this._add(water);

      const wallGeo = new THREE.BoxGeometry(150, 1.5, 2);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(waterPos.x, -0.5, waterPos.z - 22);
      wall.rotation.y = waterAngle;
      this._add(wall);

      const dockGeo = new THREE.BoxGeometry(50, 0.3, 5);
      const dockMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 });
      const dock = new THREE.Mesh(dockGeo, dockMat);
      dock.position.set(waterPos.x, -0.5, waterPos.z + 15);
      dock.rotation.y = waterAngle;
      this._add(dock);

      const dock2Geo = new THREE.BoxGeometry(45, 0.3, 4);
      const dock2 = new THREE.Mesh(dock2Geo, dockMat);
      dock2.position.set(waterPos.x + 5, -0.5, waterPos.z + 28);
      dock2.rotation.y = waterAngle;
      this._add(dock2);

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
        this._add(yacht);

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
          this._add(cabin);
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
        this._add(shaft);

        const deckGeo = new THREE.CylinderGeometry(4, 4, 3, 12);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.2, metalness: 0.7 });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(cTowerPos.x, cTowerPos.y + cTowerH + 1.5, cTowerPos.z);
        deck.castShadow = true;
        this._add(deck);

        const crownGeo = new THREE.TorusGeometry(4.2, 0.3, 8, 16);
        const crownMat = new THREE.MeshStandardMaterial({
          color: 0xc0a060, emissive: 0xc0a060, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.7
        });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(cTowerPos.x, cTowerPos.y + cTowerH + 3.2, cTowerPos.z);
        crown.rotation.x = Math.PI / 2;
        this._add(crown);

        const spireGeo = new THREE.CylinderGeometry(0.05, 0.15, 6, 6);
        const spireMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.set(cTowerPos.x, cTowerPos.y + cTowerH + 6, cTowerPos.z);
        this._add(spire);

        const beaconGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.5 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(cTowerPos.x, cTowerPos.y + cTowerH + 9.2, cTowerPos.z);
        this._add(beacon);
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
        this._add(pit);

        const garageColors = [0x1a1a3a, 0x2a2a4a, 0x1a1a3a, 0xc0a060, 0x1a1a3a];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.8, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.8;
          g.position.set(pos.x + localX * cosA - (pitD / 2) * sinA, pos.y + 0.5, pos.z - localX * sinA + (pitD / 2) * cosA);
          g.rotation.y = angle;
          this._add(g);
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
        this._add(sign);
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
        this._add(pole);

        const lightGeo = new THREE.SphereGeometry(0.4, 8, 8);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xffdd88, emissive: 0xffaa44, emissiveIntensity: 1.5, roughness: 0.1
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(pos.x, pos.y + 6.2, pos.z);
        this._add(light);

        const glowGeo = new THREE.CircleGeometry(4, 16);
        glowGeo.rotateX(-Math.PI / 2);
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.15, roughness: 0.1
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(pos.x, pos.y + 0.1, pos.z);
        this._add(glow);
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
      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < palmCount; i++) {
        let x, z, attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 18 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
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
      this._add(trunkMesh);
      this._add(canopy1);
      this._add(canopy2);
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
          this._add(tire);
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
        this._add(pylon);

        const topGeo = new THREE.CylinderGeometry(0.8, 0.5, 1.5, 8);
        const topMat = new THREE.MeshStandardMaterial({
          color: 0xc0a060, emissive: 0xc0a060, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.7
        });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.set(pos.x, pos.y + 8.8, pos.z);
        this._add(top);
      }
    }
  }

  /**
   * Circuit de Spa-Francorchamps (Belgium) - Ardennes forest mountain circuit
   * Features: La Source hairpin grandstand, Eau Rouge/Raidillon grandstand and signage,
   *           Kemmel Straight grandstand, Ardenne pine forests, mountain hills,
   *           sponsor boards, safety barriers and catch fencing
   */
  _buildSpaScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Belgian flag colors: black, yellow, red)
      const seatColors = [0x1a1a1a, 0xfdda24, 0xed2939];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

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
          this._add(sign);

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
            this._add(post);
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
        this._add(pit);

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
          this._add(g);
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
        this._add(sign);
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
        this._add(hill);
      }

      // Smaller rolling hills near the track
      const rollMat = new THREE.MeshStandardMaterial({ color: 0x3a7a28, roughness: 0.95 });
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const r = 200 + Math.random() * 120;
        const hx = Math.cos(angle) * r;
        const hz = Math.sin(angle) * r;
        if (this.distToTrack(hx, hz) < 50) continue;

        const hillGeo = new THREE.SphereGeometry(25 + Math.random() * 18, 8, 6);
        const hill = new THREE.Mesh(hillGeo, rollMat);
        hill.position.set(hx, -3, hz);
        hill.scale.set(1, 0.3, 1);
        this._add(hill);
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

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < pineCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 18 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
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
      this._add(trunkMesh);
      this._add(leaves1);
      this._add(leaves2);
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
          this._add(tire);
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
          this._add(post);

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
          this._add(panel);
        }
      }
    }
  }



  /**
   * Autodromo Nazionale Monza (Italy) - Royal Park circuit
   * Features: Royal Park of Monza setting with ancient trees,
   *          Tifosi (Ferrari fans) grandstands with Italian tricolor theme,
   *          Parabolica grandstand, Italian sponsor boards, park fencing
   */
  _buildMonzaScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Italian tricolor: green, white, red)
      const seatColors = [0x009246, 0xffffff, 0xce2b37];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

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
        this._add(pit);

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
          this._add(g);
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
        this._add(sign);
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
        this._add(stand);

        // Red canopy roof (Ferrari red)
        const roofGeo = new THREE.BoxGeometry(standW + 3, 0.4, standD + 3);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + standH + 0.2, pos.z);
        roof.rotation.y = angle;
        roof.castShadow = true;
        this._add(roof);

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
        this._add(paraSign);

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
            this._add(seat);
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
        this._add(tfStand);

        // Red canopy
        const tfRoofGeo = new THREE.BoxGeometry(tf.w + 2, 0.35, tf.d + 2);
        const tfRoofMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.3, metalness: 0.3 });
        const tfRoof = new THREE.Mesh(tfRoofGeo, tfRoofMat);
        tfRoof.position.set(tfPos.x, tfPos.y + tf.h + 0.2, tfPos.z);
        tfRoof.rotation.y = tfAngle;
        tfRoof.castShadow = true;
        this._add(tfRoof);

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
            this._add(seat);
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
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();

        // Park fence on alternating sides, at a comfortable distance
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 32 + Math.random() * 8;
        const fx = p.x + right.x * dist * side;
        const fz = p.z + right.z * dist * side;
        if (this.distToTrack(fx, fz) < hw + 28) continue;

        const fy = this.getTerrainHeight(fx, fz);

        // Fence post (dark green wrought-iron style)
        const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.0, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x2d4a2d, roughness: 0.5, metalness: 0.6 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(fx, fy + 1.0, fz);
        this._add(post);

        // Decorative top cap
        const capGeo = new THREE.SphereGeometry(0.12, 6, 4);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x2d4a2d, roughness: 0.3, metalness: 0.7 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(fx, fy + 2.1, fz);
        this._add(cap);

        // Fence rail between consecutive posts (horizontal bar)
        const nextT = ((i + 1) % fenceSegments + 0.5) / fenceSegments;
        const np = this.spline.getPointAt(nextT);
        const nt = this.spline.getTangentAt(nextT);
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
        this._add(rail);
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

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < ancientCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 22 && attempts < 50);
        if (attempts >= 50) continue;

        const y = this.getTerrainHeight(x, z);
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
      this._add(trunkMesh);
      this._add(canopy1);
      this._add(canopy2);
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
          this._add(tire);
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
        this._add(pole);

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
        this._add(flag);
      }
    }
  }

  /**
   * Silverstone Circuit (UK) - Historic British Grand Prix venue
   * Features: The Wing media centre (iconic modern architecture at pit straight),
   *          Copse, Maggotts-Becketts, Stowe grandstands, British GP sponsor boards,
   *          English countryside grassland, low perimeter fencing,
   *          old airfield heritage (RAF Silverstone).
   */
  _buildSilverstoneScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (British theme: Union Jack red-white-blue)
      const seatColors = [0xcc0000, 0xffffff, 0x00247d];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

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
        this._add(body);

        // Wing-shaped roof canopy (curved overhang)
        const roofGeo = new THREE.BoxGeometry(44, 0.5, 14);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ee, roughness: 0.2, metalness: 0.6 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(wingPos.x, wingPos.y + 5.5, wingPos.z);
        roof.rotation.y = wingAngle;
        roof.castShadow = true;
        this._add(roof);

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
        this._add(glass);

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
        this._add(sign);

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
          this._add(g);
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
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 25 + Math.random() * 50;
        const gx = p.x + right.x * dist * side;
        const gz = p.z + right.z * dist * side;
        if (this.distToTrack(gx, gz) < hw + 20) continue;

        const grassGeo = new THREE.SphereGeometry(4 + Math.random() * 3, 8, 6);
        const grass = new THREE.Mesh(grassGeo, Math.random() > 0.5 ? grassMat : grassMat2);
        grass.position.set(gx, this.getTerrainHeight(gx, gz) - 0.5, gz);
        grass.scale.set(1 + Math.random(), 0.2 + Math.random() * 0.15, 1 + Math.random());
        this._add(grass);
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
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10;
        const fx = p.x + right.x * dist * side;
        const fz = p.z + right.z * dist * side;
        if (this.distToTrack(fx, fz) < hw + 8) continue;

        const angle = Math.atan2(tangent.x, tangent.z);

        // Fence posts
        for (let j = -1; j <= 1; j++) {
          const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 4);
          const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 });
          const post = new THREE.Mesh(postGeo, postMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          post.position.set(
            fx + j * 2.5 * cosA,
            this.getTerrainHeight(fx, fz) + 1.25,
            fz - j * 2.5 * sinA
          );
          this._add(post);
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
        panel.position.set(fx, this.getTerrainHeight(fx, fz) + 1.2, fz);
        panel.rotation.y = angle;
        this._add(panel);
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
        if (this.distToTrack(hx, hz) < hw + 40) continue;

        // Concrete slab (old runway section)
        const slabGeo = new THREE.BoxGeometry(20, 0.3, 8);
        const slab = new THREE.Mesh(slabGeo, hangarMat);
        slab.position.set(hx, this.getTerrainHeight(hx, hz) - 0.1, hz);
        slab.rotation.y = hp.angle;
        slab.receiveShadow = true;
        this._add(slab);

        // Old Nissen hut shape (semi-cylindrical military building)
        const hutGeo = new THREE.CylinderGeometry(3, 3, 8, 8, 1, false, 0, Math.PI);
        const hutMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.9 });
        const hut = new THREE.Mesh(hutGeo, hutMat);
        hut.position.set(hx + 8, this.getTerrainHeight(hx, hz) + 2, hz);
        hut.rotation.y = hp.angle + Math.PI / 2;
        hut.castShadow = true;
        this._add(hut);
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
          this._add(tire);
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
        this._add(pole);

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
        this._add(flag);
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
        this._add(pole);

        // Light bank
        const lightGeo = new THREE.BoxGeometry(4, 1.2, 0.5);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.0, roughness: 0.1
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(pos.x, pos.y + towerH - 0.8, pos.z);
        light.rotation.y = Math.atan2(
          this.spline.getTangentAt(lp.t).x,
          this.spline.getTangentAt(lp.t).z
        );
        this._add(light);

        // Base plate
        const baseGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.5, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(pos.x, pos.y + 0.25, pos.z);
        this._add(base);
      }
    }
  }



  /**
   * Circuit de Monaco (Monte Carlo) - Iconic street circuit
   * Features: tunnel entrance/exit, harbor with yachts, Casino Square,
   *           grandstands between buildings, dense sponsor boards,
   *           street barriers, swimming pool section decorations
   */
  _buildMonacoScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 4 + extraDist;
    };

    // ============================================================
    // 1. TUNNEL ENTRANCE/EXIT - The famous Monaco tunnel
    //    Place tunnel structure at ~20% and ~30% along track
    // ============================================================
    {
      const tunnelPositions = [
        { t: 0.20, label: 'TUNNEL' },
        { t: 0.30, label: '' },
      ];

      for (const tp of tunnelPositions) {
        const { pos, angle } = safeOffset(tp.t, 0, 1);
        const tunnelW = hw + 10;
        const tunnelH = 10;
        const tunnelD = 18;

        // Tunnel roof/canopy spanning over the track
        const roofGeo = new THREE.BoxGeometry(tunnelW, 1.2, tunnelD);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + tunnelH, pos.z);
        roof.rotation.y = angle;
        roof.castShadow = true;
        roof.receiveShadow = true;
        this._add(roof);

        // Side walls
        const wallGeo = new THREE.BoxGeometry(1, tunnelH, tunnelD);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x666677, roughness: 0.7 });
        for (const side of [-1, 1]) {
          const wall = new THREE.Mesh(wallGeo, wallMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          wall.position.set(
            pos.x + (tunnelW / 2) * cosA * side,
            pos.y + tunnelH / 2,
            pos.z - (tunnelW / 2) * sinA * side
          );
          wall.rotation.y = angle;
          this._add(wall);
        }

        // Tunnel entrance arch frame
        const archGeo = new THREE.BoxGeometry(tunnelW + 2, 2, 2);
        const archMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.4, metalness: 0.5 });
        const arch = new THREE.Mesh(archGeo, archMat);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        arch.position.set(
          pos.x - cosA * (tunnelD / 2),
          pos.y + tunnelH - 1,
          pos.z + sinA * (tunnelD / 2)
        );
        arch.rotation.y = angle;
        this._add(arch);

        // Interior lighting strip (emissive)
        const lightGeo = new THREE.BoxGeometry(2, 0.3, tunnelD - 2);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.8, roughness: 0.1
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(pos.x, pos.y + tunnelH - 0.5, pos.z);
        light.rotation.y = angle;
        this._add(light);

        // "TUNNEL" sign at entrance (only on the first one)
        if (tp.label) {
          const signCanvas = document.createElement('canvas');
          signCanvas.width = 256; signCanvas.height = 64;
          const signCtx = signCanvas.getContext('2d');
          signCtx.fillStyle = '#003366';
          signCtx.fillRect(0, 0, 256, 64);
          signCtx.fillStyle = '#ffffff';
          signCtx.font = 'bold 40px Arial';
          signCtx.textAlign = 'center';
          signCtx.textBaseline = 'middle';
          signCtx.fillText('TUNNEL', 128, 32);
          const signTex = new THREE.CanvasTexture(signCanvas);
          const signGeo2 = new THREE.PlaneGeometry(6, 1.5);
          const signMat2 = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
          const sign = new THREE.Mesh(signGeo2, signMat2);
          sign.position.set(
            pos.x - cosA * (tunnelD / 2) - 1,
            pos.y + tunnelH - 3,
            pos.z + sinA * (tunnelD / 2) + 1
          );
          sign.rotation.y = angle;
          this._add(sign);
        }
      }
    }

    // ============================================================
    // 2. HARBOR/MARINA AREA - Yachts and Mediterranean vibes
    //    Place at ~42% along track (harbor side)
    // ============================================================
    {
      const harborT = 0.42;
      const { pos: harborCenter, angle: harborAngle } = safeOffset(harborT, hw + 35, 1);

      // Water surface
      const waterGeo = new THREE.PlaneGeometry(60, 40);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x1a6faa, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.rotation.z = -harborAngle;
      water.position.set(harborCenter.x, harborCenter.y - 1.5, harborCenter.z);
      water.receiveShadow = true;
      this._add(water);

      // Yachts floating on the harbor
      const yachtColors = [0xffffff, 0xf0f0f0, 0xe8e8e8, 0xd0d0d0];
      for (let i = 0; i < 6; i++) {
        const yawX = harborCenter.x + (i - 2.5) * 8 + (Math.random() - 0.5) * 4;
        const yawZ = harborCenter.z + (Math.random() - 0.5) * 25;
        if (this.distToTrack(yawX, yawZ) < hw + 12) continue;

        // Hull
        const hullGeo = new THREE.BoxGeometry(2.5, 1.5, 8);
        const hullMat = new THREE.MeshStandardMaterial({
          color: yachtColors[i % yachtColors.length], roughness: 0.4, metalness: 0.3
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.position.set(yawX, harborCenter.y - 0.5, yawZ);
        hull.rotation.y = harborAngle + (Math.random() - 0.5) * 0.3;
        hull.castShadow = true;
        this._add(hull);

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(2, 1.8, 3);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(yawX, harborCenter.y + 0.5, yawZ + 1);
        cabin.rotation.y = harborAngle;
        this._add(cabin);

        // Mast
        const mastGeo = new THREE.CylinderGeometry(0.05, 0.08, 6, 6);
        const mastMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7 });
        const mast = new THREE.Mesh(mastGeo, mastMat);
        mast.position.set(yawX, harborCenter.y + 3, yawZ - 1);
        this._add(mast);
      }

      // Harbor grandstands
      for (const side of [-1, 1]) {
        const { pos: standPos, angle: standAngle } = safeOffset(harborT, hw + 16, side);
        if (!isSafe(standPos.x, standPos.z, 6)) continue;

        const standW = 16, standH = 5, standD = 5;
        const standGeo = new THREE.BoxGeometry(standW, standH, standD);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.6 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(standPos.x, standPos.y + standH / 2, standPos.z);
        stand.rotation.y = standAngle;
        stand.castShadow = true;
        this._add(stand);

        // Roof
        const roofGeo = new THREE.BoxGeometry(standW + 2, 0.3, standD + 2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(standPos.x, standPos.y + standH + 0.15, standPos.z);
        roof.rotation.y = standAngle;
        this._add(roof);

        // Seats (Monaco colors: red, white, blue)
        const seatColors = [0xcc0000, 0xffffff, 0x0044aa];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < Math.floor(standW / 2); c++) {
            const seatGeo = new THREE.BoxGeometry(0.5, 0.6, 0.5);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const cosA = Math.cos(standAngle), sinA = Math.sin(standAngle);
            const localX = (c - Math.floor(standW / 4) + 0.5) * 1.8;
            const localZ = (r - 1) * (standD / 3);
            seat.position.set(
              standPos.x + localX * cosA + localZ * sinA,
              standPos.y + 0.5 + r * 1.0,
              standPos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = standAngle;
            this._add(seat);
          }
        }
      }
    }

    // ============================================================
    // 3. CASINO SQUARE DECORATIONS - The famous Casino turn
    //    Place at ~12% along track
    // ============================================================
    {
      const casinoT = 0.12;
      const { pos: casinoPos, angle: casinoAngle } = safeOffset(casinoT, hw + 12, 1);
      if (isSafe(casinoPos.x, casinoPos.z, 4)) {
        // Casino building facade
        const facadeW = 18, facadeH = 14, facadeD = 3;
        const facadeGeo = new THREE.BoxGeometry(facadeW, facadeH, facadeD);
        const facadeMat = new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.5 });
        const facade = new THREE.Mesh(facadeGeo, facadeMat);
        facade.position.set(casinoPos.x, casinoPos.y + facadeH / 2, casinoPos.z);
        facade.rotation.y = casinoAngle;
        facade.castShadow = true;
        this._add(facade);

        // Casino roof (green copper style)
        const roofGeo = new THREE.BoxGeometry(facadeW + 2, 1, facadeD + 2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x2e6e4e, roughness: 0.4, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(casinoPos.x, casinoPos.y + facadeH + 0.5, casinoPos.z);
        roof.rotation.y = casinoAngle;
        this._add(roof);

        // Casino columns
        const colGeo = new THREE.CylinderGeometry(0.3, 0.3, facadeH - 1, 8);
        const colMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.3 });
        for (let i = 0; i < 5; i++) {
          const col = new THREE.Mesh(colGeo, colMat);
          const cosA = Math.cos(casinoAngle), sinA = Math.sin(casinoAngle);
          const localX = (i - 2) * (facadeW / 5);
          col.position.set(
            casinoPos.x + localX * cosA - facadeD / 2 * sinA,
            casinoPos.y + (facadeH - 1) / 2 + 0.5,
            casinoPos.z - localX * sinA + facadeD / 2 * cosA
          );
          col.rotation.y = casinoAngle;
          this._add(col);
        }

        // "CASINO" sign
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#1a4a2a';
        signCtx.fillRect(0, 0, 256, 64);
        signCtx.fillStyle = '#c0a060';
        signCtx.font = 'bold 40px serif';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('CASINO', 128, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(8, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(casinoPos.x, casinoPos.y + facadeH - 2, casinoPos.z);
        sign.rotation.y = casinoAngle;
        this._add(sign);

        // Casino square decorative fountain
        const { pos: fountainPos } = safeOffset(casinoT, hw + 22, 1);
        if (isSafe(fountainPos.x, fountainPos.z, 2)) {
          const baseGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.6, 16);
          const baseMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.3, metalness: 0.6 });
          const base = new THREE.Mesh(baseGeo, baseMat);
          base.position.set(fountainPos.x, fountainPos.y + 0.3, fountainPos.z);
          this._add(base);

          const waterGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.4, 16);
          const waterMat = new THREE.MeshStandardMaterial({
            color: 0x4488cc, transparent: true, opacity: 0.6, roughness: 0.1
          });
          const waterMesh = new THREE.Mesh(waterGeo, waterMat);
          waterMesh.position.set(fountainPos.x, fountainPos.y + 0.5, fountainPos.z);
          this._add(waterMesh);

          const pillarGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 8);
          const pillarMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.7 });
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(fountainPos.x, fountainPos.y + 1.8, fountainPos.z);
          this._add(pillar);
        }
      }
    }

    // ============================================================
    // 4. GRANDSTANDS AT KEY CORNERS - Between buildings
    // ============================================================
    {
      const standPositions = [
        { t: 0.04, side: -1, w: 14, h: 6, d: 5 },  // Sainte Devote
        { t: 0.18, side: 1, w: 16, h: 5, d: 5 },   // After Casino
        { t: 0.35, side: -1, w: 14, h: 5, d: 5 },  // Near harbor
        { t: 0.55, side: -1, w: 12, h: 4, d: 4 },  // Swimming pool
        { t: 0.65, side: 1, w: 14, h: 5, d: 5 },   // Swimming pool chicane
        { t: 0.78, side: -1, w: 12, h: 4, d: 4 },  // Rascasse area
        { t: 0.88, side: 1, w: 14, h: 5, d: 5 },   // Pit straight start
      ];

      for (const s of standPositions) {
        const { pos: sPos, angle: sAngle } = safeOffset(s.t, hw + 10, s.side);
        if (!isSafe(sPos.x, sPos.z, s.w / 2)) continue;

        const standGeo = new THREE.BoxGeometry(s.w, s.h, s.d);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.6 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(sPos.x, sPos.y + s.h / 2, sPos.z);
        stand.rotation.y = sAngle;
        stand.castShadow = true;
        this._add(stand);

        const roofGeo = new THREE.BoxGeometry(s.w + 1.5, 0.3, s.d + 1.5);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(sPos.x, sPos.y + s.h + 0.15, sPos.z);
        roof.rotation.y = sAngle;
        this._add(roof);

        const seatColors = [0xcc0000, 0xffffff, 0x0044aa];
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < Math.floor(s.w / 2); c++) {
            const seatGeo = new THREE.BoxGeometry(0.45, 0.55, 0.45);
            const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const cosA = Math.cos(sAngle), sinA = Math.sin(sAngle);
            const localX = (c - Math.floor(s.w / 4) + 0.5) * 1.7;
            const localZ = (r - 0.5) * (s.d / 3);
            seat.position.set(
              sPos.x + localX * cosA + localZ * sinA,
              sPos.y + 0.4 + r * 1.0,
              sPos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = sAngle;
            this._add(seat);
          }
        }
      }
    }

    // ============================================================
    // 5. SWIMMING POOL SECTION - Iconic swimming pool turns
    //    Place at ~58% along track
    // ============================================================
    {
      const poolT = 0.58;
      const { pos: poolPos } = safeOffset(poolT, hw + 18, 1);
      if (isSafe(poolPos.x, poolPos.z, 4)) {
        // Swimming pool basin
        const poolGeo = new THREE.BoxGeometry(12, 0.8, 6);
        const poolMat = new THREE.MeshStandardMaterial({ color: 0x2288cc, transparent: true, opacity: 0.7, roughness: 0.1 });
        const pool = new THREE.Mesh(poolGeo, poolMat);
        pool.position.set(poolPos.x, poolPos.y + 0.2, poolPos.z);
        this._add(pool);

        // Pool border
        const borderGeo = new THREE.BoxGeometry(13, 0.6, 7);
        const borderMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.set(poolPos.x, poolPos.y + 0.1, poolPos.z);
        this._add(border);

        // "PISCINE" sign
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#0044aa';
        signCtx.fillRect(0, 0, 256, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('PISCINE', 128, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(5, 1.2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(poolPos.x, poolPos.y + 2, poolPos.z);
        this._add(sign);
      }
    }

    // ============================================================
    // 6. SPONSOR BOARDS - Dense Monaco sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'MONACO GP', bg: '#1a1a2e', fg: '#c0a060' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'CITY OF MONACO', bg: '#cc0000', fg: '#ffffff' },
        { name: 'TAG HEUER', bg: '#1a1a1a', fg: '#ffffff' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
      ];

      const boardCount = 12;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 7 + Math.random() * 3;
        const { pos, angle } = safeOffset(t, dist, side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const sponsor = sponsors[i % sponsors.length];

        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 3, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 });
        for (const pSide of [-1, 1]) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(pos.x, pos.y + 1.5, pos.z);
          this._add(post);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = sponsor.bg;
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = sponsor.fg;
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sponsor.name, 128, 64);
        const tex = new THREE.CanvasTexture(canvas);

        const boardGeo = new THREE.BoxGeometry(5, 2.5, 0.15);
        const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.set(pos.x, pos.y + 4.2, pos.z);
        board.rotation.y = angle;
        board.castShadow = true;
        this._add(board);
      }
    }

    // ============================================================
    // 7. STREET BARRIERS / ARMCO - Close to track surface
    // ============================================================
    {
      const barrierCount = 40;
      const barrierGeo = new THREE.BoxGeometry(0.3, 1.0, 2.5);
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.5 });
      const accentRed = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.5 });
      const accentWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

      for (let i = 0; i < barrierCount; i++) {
        const t = i / barrierCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 2.5;
        const { pos, angle } = safeOffset(t, dist, side);
        if (!isSafe(pos.x, pos.z, 0.5)) continue;

        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(pos.x, pos.y + 0.5, pos.z);
        barrier.rotation.y = angle;
        this._add(barrier);

        const stripeGeo = new THREE.BoxGeometry(0.35, 0.2, 2.6);
        const stripeMat = i % 4 < 2 ? accentRed : accentWhite;
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(pos.x, pos.y + 1.05, pos.z);
        stripe.rotation.y = angle;
        this._add(stripe);
      }
    }

    // ============================================================
    // 8. PIT BUILDING - Start/finish straight
    // ============================================================
    {
      const { pos: pitPos, angle: pitAngle } = safeOffset(0.02, hw + 14, -1);
      if (isSafe(pitPos.x, pitPos.z, 8)) {
        const pitW = 30, pitH = 5, pitD = 6;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.3 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pitPos.x, pitPos.y + pitH / 2, pitPos.z);
        pit.rotation.y = pitAngle;
        pit.castShadow = true;
        this._add(pit);

        const garageColors = [0xcc0000, 0xffffff, 0x0044aa, 0xffffff, 0xcc0000];
        for (let i = 0; i < 8; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(pitAngle), sinA = Math.sin(pitAngle);
          const localX = (i - 3.5) * 3.5;
          g.position.set(
            pitPos.x + localX * cosA - (pitD / 2) * sinA,
            pitPos.y + 0.5,
            pitPos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = pitAngle;
          this._add(g);
        }

        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc0000';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('MONACO GRAND PRIX', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(14, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pitPos.x, pitPos.y + pitH + 1.5, pitPos.z);
        sign.rotation.y = pitAngle;
        this._add(sign);
      }
    }

    // ============================================================
    // 9. LAMP POSTS - Street lighting along the track
    // ============================================================
    {
      const lampCount = 20;
      for (let i = 0; i < lampCount; i++) {
        const t = (i + 0.5) / lampCount;
        const side = i % 2 === 0 ? 1 : -1;
        const { pos } = safeOffset(t, hw + 5, side);
        if (!isSafe(pos.x, pos.z, 1)) continue;

        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 2.5, pos.z);
        this._add(pole);

        const lampGeo = new THREE.SphereGeometry(0.3, 8, 6);
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.6, roughness: 0.1
        });
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(pos.x, pos.y + 5.2, pos.z);
        this._add(lamp);
      }
    }

    // ============================================================
    // 10. CHECKERED FLAG BANNERS - Along the pit straight
    // ============================================================
    {
      const bannerPositions = [
        { t: 0.01, side: 1 }, { t: 0.03, side: -1 },
        { t: 0.93, side: 1 }, { t: 0.95, side: -1 },
        { t: 0.97, side: 1 }, { t: 0.99, side: -1 },
      ];

      for (const bp of bannerPositions) {
        const { pos: bPos, angle: bAngle } = safeOffset(bp.t, hw + 7, bp.side);
        if (!isSafe(bPos.x, bPos.z, 2)) continue;

        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 4, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(bPos.x, bPos.y + 2, bPos.z);
        this._add(pole);

        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128; flagCanvas.height = 96;
        const fCtx = flagCanvas.getContext('2d');
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(0, 0, 128, 96);
        fCtx.fillStyle = '#000000';
        for (let fi = 0; fi < 8; fi++) {
          for (let fj = 0; fj < 6; fj++) {
            if ((fi + fj) % 2 === 0) fCtx.fillRect(fi * 16, fj * 16, 16, 16);
          }
        }
        const flagTex = new THREE.CanvasTexture(flagCanvas);
        const flagGeo = new THREE.PlaneGeometry(1.5, 1.2);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(bPos.x, bPos.y + 3.8, bPos.z);
        flag.rotation.y = bAngle;
        this._add(flag);
      }
    }

    // ============================================================
    // 11. TIRE BARRIERS at key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.3, 0.15, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.10, side: -1 }, { t: 0.22, side: 1 },
        { t: 0.38, side: -1 }, { t: 0.50, side: 1 },
        { t: 0.62, side: -1 }, { t: 0.75, side: 1 },
        { t: 0.85, side: -1 }, { t: 0.92, side: 1 },
      ];

      for (const tp of tirePositions) {
        const { pos } = safeOffset(tp.t, hw + 3.5, tp.side);
        if (!isSafe(pos.x, pos.z, 0.5)) continue;
        for (let j = 0; j < 4; j++) {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          tire.position.set(
            pos.x + (j % 2) * 0.8 - 0.4,
            pos.y + 0.3 + Math.floor(j / 2) * 0.6,
            pos.z + (Math.floor(j / 2)) * 0.4
          );
          tire.rotation.x = Math.PI / 2;
          this._add(tire);
        }
      }
    }
  }

  /**
   * Suzuka Circuit (Japan) - Figure-8 layout
   * Features: S-curves (sector 1), Dunlop curve (uphill right),
   *          Degner curves (two right turns), 130R (high-speed left),
   *          Spoon curve (double-apex left), Casio Triangle chicane,
   *          highway overpass, control tower
   */
  _buildSuzukaScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor, seatColorA, seatColorB) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Suzuka colors: red-white-blue)
      const seatColors = [seatColorA || 0xcc0000, seatColorB || 0xffffff, seatColorA || 0xcc0000];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

    // ============================================================
    // 1. MAIN GRANDSTAND - Start/Finish straight (t=0.02)
    //    Large grandstand on the outside of the pit straight
    // ============================================================
    placeStand(0.02, hw + 20, 1, 40, 10, 10, 0x2a2a2a, 0xcc0000, 0xcc0000, 0xffffff);

    // Pit building - opposite side (t=0.04)
    {
      const { pos, angle } = safeOffset(0.04, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 35, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        this._add(pit);

        // Pit garages with Suzuka colors
        const garageColors = [0xcc0000, 0xffffff, 0x003399, 0xffffff, 0xcc0000];
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
          this._add(g);
        }

        // SUZUKA CIRCUIT sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc0000';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('SUZUKA CIRCUIT', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(16, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        this._add(sign);
      }
    }

    // ============================================================
    // 2. CONTROL TOWER / TIMING TOWER - Near start/finish (t=0.98)
    //    The iconic Suzuka control tower visible from the main straight
    // ============================================================
    {
      const { pos: towerPos, angle: towerAngle } = safeOffset(0.98, hw + 25, 1);
      if (isSafe(towerPos.x, towerPos.z, 8)) {
        const towerH = 18;

        // Main tower pillar
        const pillarGeo = new THREE.BoxGeometry(4, towerH, 4);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.4, metalness: 0.3 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(towerPos.x, towerPos.y + towerH / 2, towerPos.z);
        pillar.castShadow = true;
        this._add(pillar);

        // Top observation deck
        const deckGeo = new THREE.BoxGeometry(10, 3, 8);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.4, metalness: 0.3 });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(towerPos.x, towerPos.y + towerH + 1.5, towerPos.z);
        deck.castShadow = true;
        this._add(deck);

        // Glass front panels on the observation deck
        const glassGeo = new THREE.PlaneGeometry(9.5, 2.5);
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0x88bbdd, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.8
        });
        for (let face = 0; face < 4; face++) {
          const glass = new THREE.Mesh(glassGeo, glassMat);
          const fAngle = towerAngle + (face * Math.PI / 2);
          glass.position.set(
            towerPos.x + Math.sin(fAngle) * 2.1,
            towerPos.y + towerH + 1.5,
            towerPos.z + Math.cos(fAngle) * 2.1
          );
          glass.rotation.y = fAngle;
          this._add(glass);
        }

        // SUZUKA text sign on tower (visible from track)
        const towerSignCanvas = document.createElement('canvas');
        towerSignCanvas.width = 256; towerSignCanvas.height = 128;
        const towerSignCtx = towerSignCanvas.getContext('2d');
        towerSignCtx.fillStyle = '#cc0000';
        towerSignCtx.fillRect(0, 0, 256, 128);
        towerSignCtx.fillStyle = '#ffffff';
        towerSignCtx.font = 'bold 48px Arial';
        towerSignCtx.textAlign = 'center';
        towerSignCtx.textBaseline = 'middle';
        towerSignCtx.fillText('SUZUKA', 128, 64);
        const towerSignTex = new THREE.CanvasTexture(towerSignCanvas);

        for (let face = 0; face < 4; face++) {
          const faceSignGeo = new THREE.PlaneGeometry(3.8, 2.0);
          const faceSignMat = new THREE.MeshStandardMaterial({ map: towerSignTex, roughness: 0.3 });
          const faceSign = new THREE.Mesh(faceSignGeo, faceSignMat);
          const fAngle = towerAngle + (face * Math.PI / 2);
          faceSign.position.set(
            towerPos.x + Math.sin(fAngle) * 2.05,
            towerPos.y + towerH - 2,
            towerPos.z + Math.cos(fAngle) * 2.05
          );
          faceSign.rotation.y = fAngle;
          this._add(faceSign);
        }

        // Clock/timing display at top
        const clockGeo = new THREE.BoxGeometry(3, 1.5, 0.2);
        const clockCanvas = document.createElement('canvas');
        clockCanvas.width = 128; clockCanvas.height = 64;
        const clockCtx = clockCanvas.getContext('2d');
        clockCtx.fillStyle = '#000000';
        clockCtx.fillRect(0, 0, 128, 64);
        clockCtx.fillStyle = '#00ff00';
        clockCtx.font = 'bold 36px monospace';
        clockCtx.textAlign = 'center';
        clockCtx.textBaseline = 'middle';
        clockCtx.fillText('0:00.000', 64, 32);
        const clockTex = new THREE.CanvasTexture(clockCanvas);
        const clockMat = new THREE.MeshStandardMaterial({ map: clockTex, emissive: 0x00ff00, emissiveIntensity: 0.3 });
        const clock = new THREE.Mesh(clockGeo, clockMat);
        clock.position.set(towerPos.x, towerPos.y + towerH + 3.5, towerPos.z);
        clock.rotation.y = towerAngle;
        this._add(clock);
      }
    }

    // ============================================================
    // 3. 130R GRANDSTAND - Outside of the legendary high-speed corner
    //    130R is at approximately t=0.93
    // ============================================================
    placeStand(0.93, hw + 20, -1, 30, 8, 8, 0x333344, 0x003399, 0x003399, 0xffffff);

    // ============================================================
    // 4. SPOON CURVE GRANDSTAND - Outside of the double-apex left
    //    Spoon curve is at approximately t=0.65
    // ============================================================
    placeStand(0.65, hw + 20, 1, 28, 7, 7, 0x3a3a4a, 0xcc0000, 0xcc0000, 0xffffff);

    // ============================================================
    // 5. S-CURVES (ESSES) GRANDSTAND - Sector 1 viewing area
    //    S-curves at approximately t=0.20
    // ============================================================
    placeStand(0.20, hw + 18, -1, 25, 6, 6, 0x2a3a4a, 0x666677, 0xcc0000, 0xffffff);

    // ============================================================
    // 6. HIGHWAY OVERPASS - The famous Meishin Expressway bridge
    //    Crosses over the track between S-curves and Dunlop (t=0.28)
    //    This is a signature Suzuka landmark
    // ============================================================
    {
      const t = 0.28;
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const angle = Math.atan2(tangent.x, tangent.z);

      const bridgeWidth = (this._trackWidth || CONFIG.trackWidth) + 12;
      const pillarH = 10;
      const beamH = 1.5;

      // Concrete pillars on each side (wider than track)
      const pillarGeo = new THREE.CylinderGeometry(0.5, 0.6, pillarH, 8);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.7 });
      for (let side of [-1, 1]) {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        const offset = right.clone().multiplyScalar(bridgeWidth / 2 * side);
        pillar.position.set(p.x + offset.x, p.y + pillarH / 2, p.z + offset.z);
        pillar.castShadow = true;
        this._add(pillar);
      }

      // Road deck / beam across the track
      const deckGeo = new THREE.BoxGeometry(bridgeWidth, beamH, 8);
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.2 });
      const deckMesh = new THREE.Mesh(deckGeo, deckMat);
      deckMesh.position.set(p.x, p.y + pillarH + beamH / 2, p.z);
      deckMesh.rotation.y = angle;
      deckMesh.castShadow = true;
      this._add(deckMesh);

      // Guardrails on the bridge
      const railGeo = new THREE.BoxGeometry(bridgeWidth, 0.6, 0.2);
      const railMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4, metalness: 0.5 });
      for (let side of [-1, 1]) {
        const rail = new THREE.Mesh(railGeo, railMat);
        const offset = right.clone().multiplyScalar(4 * side);
        rail.position.set(p.x + offset.x, p.y + pillarH + beamH + 0.3, p.z + offset.z);
        rail.rotation.y = angle;
        this._add(rail);
      }

      // Highway signage
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 256; signCanvas.height = 64;
      const signCtx = signCanvas.getContext('2d');
      signCtx.fillStyle = '#006633';
      signCtx.fillRect(0, 0, 256, 64);
      signCtx.fillStyle = '#ffffff';
      signCtx.font = 'bold 32px Arial';
      signCtx.textAlign = 'center';
      signCtx.textBaseline = 'middle';
      signCtx.fillText('MEISHIN EXPY', 128, 32);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signGeo = new THREE.PlaneGeometry(6, 1.5);
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(p.x, p.y + pillarH + beamH + 1.5, p.z);
      sign.rotation.y = angle;
      this._add(sign);
    }

    // ============================================================
    // 7. DUNLOP CURVE ADVERTISING BOARDS
    //    Dunlop curve at approximately t=0.30
    // ============================================================
    {
      const dunlopSponsors = [
        { name: 'DUNLOP', bg: '#006633', fg: '#ffcc00' },
        { name: 'DUNLOP', bg: '#006633', fg: '#ffcc00' },
      ];

      for (let i = 0; i < 2; i++) {
        const t = 0.29 + i * 0.02;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10;
        placeBoard(t, dist, side, dunlopSponsors[i]);
      }
    }

    // ============================================================
    // 8. SPONSOR BOARDS - F1 Japanese GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'SUZUKA GP', bg: '#cc0000', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'DUNLOP', bg: '#006633', fg: '#ffcc00' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
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
        { t: 0.10, side: -1 },   // Turn 1/2 exit
        { t: 0.25, side: 1 },    // S-curves exit
        { t: 0.35, side: -1 },   // Degner 1
        { t: 0.38, side: 1 },    // Degner 2
        { t: 0.50, side: -1 },   // Hairpin exit
        { t: 0.68, side: -1 },   // Spoon exit
        { t: 0.78, side: 1 },    // 130R approach
        { t: 0.85, side: -1 },   // Casio Triangle
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
          this._add(tire);
        }
      }
    }

    // ============================================================
    // 10. TRACK-BORDER GUARDRAILS - Additional safety barriers
    //     Placed at high-risk zones: 130R exit, Degner, Spoon
    // ============================================================
    {
      const barrierGeo = new THREE.BoxGeometry(8, 1.0, 0.4);
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5, metalness: 0.4 });

      const barrierPositions = [
        { t: 0.35, side: 1 },    // Degner outer
        { t: 0.37, side: 1 },    // Degner 2 outer
        { t: 0.50, side: 1 },    // Hairpin outer
        { t: 0.67, side: -1 },   // Spoon outer
        { t: 0.92, side: 1 },    // 130R exit outer
        { t: 0.83, side: 1 },    // Casio Triangle outer
      ];

      for (const bp of barrierPositions) {
        const { pos, angle } = safeOffset(bp.t, hw + 3, bp.side);
        if (!isSafe(pos.x, pos.z, 2)) continue;

        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(pos.x, pos.y + 0.5, pos.z);
        barrier.rotation.y = angle;
        barrier.castShadow = true;
        this._add(barrier);
      }
    }

    // ============================================================
    // 11. JAPANESE CHERRY BLOSSOM TREES - Decorative sakura trees
    //     Placed near grandstands and key areas
    // ============================================================
    {
      const sakuraCount = 40;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 3.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3020, roughness: 0.9 });
      const blossomGeo1 = new THREE.SphereGeometry(2.0, 8, 6);
      const blossomMat1 = new THREE.MeshStandardMaterial({ color: 0xffb7c5, roughness: 0.7 });
      const blossomGeo2 = new THREE.SphereGeometry(1.5, 8, 6);
      const blossomMat2 = new THREE.MeshStandardMaterial({ color: 0xff99aa, roughness: 0.7 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, sakuraCount);
      const blossom1 = new THREE.InstancedMesh(blossomGeo1, blossomMat1, Math.floor(sakuraCount * 0.6));
      const blossom2 = new THREE.InstancedMesh(blossomGeo2, blossomMat2, Math.ceil(sakuraCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < sakuraCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 20 && attempts < 50);
        if (attempts >= 50) continue;

        const y = this.getTerrainHeight(x, z);
        const scale = 0.7 + Math.random() * 0.6;

        // Trunk
        dummy.position.set(x, y + 1.8 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx1 + idx2, dummy.matrix);

        // Canopy
        dummy.position.set(x, y + 4.5 * scale, z);
        dummy.scale.set(scale * 1.3, scale * 0.9, scale * 1.3);
        dummy.updateMatrix();
        if (idx1 < Math.floor(sakuraCount * 0.6)) {
          blossom1.setMatrixAt(idx1, dummy.matrix);
          idx1++;
        } else {
          blossom2.setMatrixAt(idx2, dummy.matrix);
          idx2++;
        }
      }

      trunkMesh.count = idx1 + idx2;
      blossom1.count = idx1;
      blossom2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      blossom1.instanceMatrix.needsUpdate = true;
      blossom2.instanceMatrix.needsUpdate = true;
      this._add(trunkMesh);
      this._add(blossom1);
      this._add(blossom2);
    }

    // ============================================================
    // 12. CASIO TRIANGLE CHICANE SIGNAGE
    //     The final chicane area at approximately t=0.83
    // ============================================================
    {
      const { pos: chicanePos, angle: chicaneAngle } = safeOffset(0.83, hw + 14, 1);
      if (isSafe(chicanePos.x, chicanePos.z, 5)) {
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc0000';
        signCtx.fillRect(0, 0, 256, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 28px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('CASIO TRIANGLE', 128, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(8, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);

        const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
        for (let side of [-1, 1]) {
          const post = new THREE.Mesh(postGeo, postMat);
          const offset = side * 4;
          const cosA = Math.cos(chicaneAngle), sinA = Math.sin(chicaneAngle);
          post.position.set(
            chicanePos.x + offset * cosA,
            chicanePos.y + 2,
            chicanePos.z - offset * sinA
          );
          this._add(post);
        }
        sign.position.set(chicanePos.x, chicanePos.y + 4.5, chicanePos.z);
        sign.rotation.y = chicaneAngle;
        this._add(sign);
      }
    }
  }

  _buildCatalunyaScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Spanish flag colors: red and yellow)
      const seatColors = [0xcc0000, 0xffcc00, 0xcc0000];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

    // ============================================================
    // 1. MAIN GRANDSTAND - Iconic Circuit de Barcelona main straight stand
    //    White/cream concrete structure with cantilevered roof
    // ============================================================
    placeStand(0.05, hw + 22, -1, 50, 12, 10, 0xf0ebe3, 0xddddcc);

    // ============================================================
    // 2. TURN 1 GRANDSTAND - Spectator seating at first corner
    // ============================================================
    placeStand(0.12, hw + 18, 1, 30, 8, 8, 0xf0ebe3, 0xddddcc);

    // ============================================================
    // 3. Paddock / Pit building - Along the main straight
    // ============================================================
    {
      const { pos, angle } = safeOffset(0.05, hw + 14, -1);
      if (isSafe(pos.x, pos.z, 8)) {
        const pitW = 40, pitH = 4, pitD = 6;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0xd0ccc0, roughness: 0.5, metalness: 0.2 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        this._add(pit);

        // Pit garage doors (striped red-yellow)
        const garageCount = 8;
        const garageW = pitW / garageCount;
        const doorColors = [0xcc0000, 0xffcc00];
        for (let g = 0; g < garageCount; g++) {
          const doorGeo = new THREE.PlaneGeometry(garageW * 0.7, pitH * 0.7);
          const doorMat = new THREE.MeshStandardMaterial({ color: doorColors[g % 2], roughness: 0.4 });
          const door = new THREE.Mesh(doorGeo, doorMat);
          const localX = (g - garageCount / 2 + 0.5) * garageW;
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          door.position.set(
            pos.x + localX * cosA + (pitD / 2 + 0.05) * sinA,
            pos.y + pitH * 0.4,
            pos.z - localX * sinA + (pitD / 2 + 0.05) * cosA
          );
          door.rotation.y = angle;
          this._add(door);
        }
      }
    }

    // ============================================================
    // 4. PALM TREES - Mediterranean vegetation (scattered around circuit)
    //    Iconic feature of the Barcelona circuit surroundings
    // ============================================================
    {
      const palmCount = 50;
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.28, 6.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });

      const canopyGeo1 = new THREE.ConeGeometry(2.8, 2.0, 6);
      const canopyGeo2 = new THREE.ConeGeometry(2.2, 2.8, 8);
      const canopyMat1 = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
      const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.8 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
      const canopy1 = new THREE.InstancedMesh(canopyGeo1, canopyMat1, Math.floor(palmCount * 0.6));
      const canopy2 = new THREE.InstancedMesh(canopyGeo2, canopyMat2, Math.ceil(palmCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < palmCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 16 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
        const scale = 0.8 + Math.random() * 0.6;

        // Trunk
        dummy.position.set(x, y + 3.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        // Palm canopy
        dummy.position.set(x, y + 6.5 * scale, z);
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
      this._add(trunkMesh);
      this._add(canopy1);
      this._add(canopy2);
    }

    // ============================================================
    // 5. PALM TREE GROVES - Clustered along straights
    // ============================================================
    {
      const grovePositions = [
        { t: 0.15, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.55, side: 1 },
        { t: 0.75, side: -1 },
        { t: 0.92, side: 1 },
      ];

      for (const gp of grovePositions) {
        const { pos } = safeOffset(gp.t, hw + 30, gp.side);
        if (!isSafe(pos.x, pos.z, 15)) continue;

        const groveCount = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < groveCount; j++) {
          const ox = (Math.random() - 0.5) * 12;
          const oz = (Math.random() - 0.5) * 12;
          const gx = pos.x + ox;
          const gz = pos.z + oz;
          if (this.distToTrack(gx, gz) < hw + 12) continue;

          const gy = this.getTerrainHeight(gx, gz);
          const s = 0.7 + Math.random() * 0.5;

          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 5.5 * s, 6),
            new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 })
          );
          trunk.position.set(gx, gy + 2.8 * s, gz);
          trunk.castShadow = true;
          this._add(trunk);

          const canopy = new THREE.Mesh(
            new THREE.ConeGeometry(2.5 * s, 2.0 * s, 6),
            new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 })
          );
          canopy.position.set(gx, gy + 6.2 * s, gz);
          canopy.castShadow = true;
          this._add(canopy);
        }
      }
    }

    // ============================================================
    // 6. SPONSOR BOARDS - Spanish GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'CIRCUIT BARCELONA', bg: '#cc0000', fg: '#ffcc00' },
        { name: 'REPSOL', bg: '#ff6600', fg: '#ffffff' },
        { name: 'SPANISH GP', bg: '#cc0000', fg: '#ffffff' },
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
    // 7. TIRE WALLS - Key corner exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.10, side: 1 },
        { t: 0.25, side: -1 },
        { t: 0.45, side: 1 },
        { t: 0.65, side: -1 },
        { t: 0.85, side: 1 },
      ];

      for (const tp of tirePositions) {
        const { pos, angle } = safeOffset(tp.t, hw + 2, tp.side);
        if (!isSafe(pos.x, pos.z, 1)) continue;

        for (let j = 0; j < 5; j++) {
          const tire = new THREE.Mesh(tireGeo, tireMat);
          const localX = (j - 2) * 0.8;
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          tire.position.set(
            pos.x + localX * cosA,
            pos.y + 0.35,
            pos.z - localX * sinA
          );
          tire.rotation.x = Math.PI / 2;
          tire.rotation.y = angle;
          tire.castShadow = true;
          this._add(tire);
        }
      }
    }

    // ============================================================
    // 8. MEDITERRANEAN SHRUBS / OLIVE TREES - Low vegetation clusters
    // ============================================================
    {
      const shrubGeo = new THREE.SphereGeometry(1.5, 6, 5);
      const shrubMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9 });
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 2.0, 5);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });

      const shrubCount = 30;
      for (let i = 0; i < shrubCount; i++) {
        const t = Math.random();
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 15 + Math.random() * 40;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;
        if (this.distToTrack(x, z) < hw + 12) continue;

        const y = this.getTerrainHeight(x, z);
        const s = 0.6 + Math.random() * 0.8;

        // Olive tree trunk
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, y + 1.0 * s, z);
        trunk.scale.set(s, s, s);
        trunk.castShadow = true;
        this._add(trunk);

        // Olive canopy
        const canopy = new THREE.Mesh(shrubGeo, shrubMat);
        canopy.position.set(x, y + 2.8 * s, z);
        canopy.scale.set(s * 1.2, s * 0.9, s * 1.2);
        canopy.castShadow = true;
        this._add(canopy);
      }
    }
  }

  /**
   * _buildHungaroringScenery()
   * Hungarian Grand Prix circuit - hilly terrain, European countryside, valley setting
   * Features:
   *   1. Rolling green hills surrounding the track (valley landscape)
   *   2. Hillside grandstands with colored seating
   *   3. European rural buildings (farmhouses, barns, fences)
   *   4. Sponsor billboards along the circuit
   *   5. Corn / wheat field patches (Hungarian Great Plain agriculture)
   *   6. Mature deciduous trees and tree lines
   */
  _buildHungaroringScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

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
        this._add(hill);
      }

      // Smaller rolling bumps closer to the track
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2 + 0.5;
        const r = 120 + Math.random() * 100;
        const hx = Math.cos(angle) * r;
        const hz = Math.sin(angle) * r;
        if (this.distToTrack(hx, hz) < 35) continue;

        const geo = new THREE.SphereGeometry(18 + Math.random() * 15, 8, 6);
        const mat = [hillMat1, hillMat2, hillMat3][i % 3];
        const bump = new THREE.Mesh(geo, mat);
        bump.position.set(hx, -6, hz);
        bump.scale.set(1.5, 0.35, 1.2);
        this._add(bump);
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
        this._add(stand);

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
            this._add(seat);
          }
        }

        // Canopy roof
        const roofGeo = new THREE.BoxGeometry(s.w + 2, 0.35, s.d + 1.5);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + s.h + 0.2, pos.z);
        roof.rotation.y = angle;
        roof.castShadow = true;
        this._add(roof);
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
        this._add(post);

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
        this._add(board);
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
        this._add(body);

        // Tiled roof
        const roofGeo = new THREE.ConeGeometry(Math.max(bw, bd) * 0.7, 3.5, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: roofColors[ci], roughness: 0.9 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(pos.x, pos.y + bh + 0.5, pos.z);
        roof.rotation.y = angle + Math.PI / 4;
        roof.castShadow = true;
        this._add(roof);
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
        if (this.distToTrack(f.x, f.z) < 50) continue;

        const fieldGeo = new THREE.BoxGeometry(f.w, 0.3, f.d);
        const fieldMat = Math.random() > 0.5 ? wheatMat : cornMat;
        const field = new THREE.Mesh(fieldGeo, fieldMat);
        field.position.set(f.x, -1.5, f.z);
        this._add(field);

        // Crop rows (thin raised lines)
        for (let r = -f.d / 2 + 3; r < f.d / 2; r += 5) {
          const rowGeo = new THREE.BoxGeometry(f.w - 4, 0.6, 0.5);
          const rowMat = new THREE.MeshStandardMaterial({
            color: fieldMat.color.getHex(),
            roughness: 0.9
          });
          const row = new THREE.Mesh(rowGeo, rowMat);
          row.position.set(f.x, -1.2, f.z + r);
          this._add(row);
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
        if (this.distToTrack(tx, tz) < 25) continue;

        const treeH = 6 + Math.random() * 5;
        const crownR = 2.5 + Math.random() * 2;

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, treeH, 6);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(tx, treeH / 2 - 2, tz);
        trunk.castShadow = true;
        this._add(trunk);

        // Crown (sphere for deciduous look)
        const leafColor = leafColors[i % leafColors.length];
        const crownGeo = new THREE.SphereGeometry(crownR, 8, 6);
        const crownMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.85 });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(tx, treeH - 1, tz);
        crown.scale.set(1, 0.8, 1);
        crown.castShadow = true;
        this._add(crown);
      }

      // Tree lines along imaginary roads bordering the track
      const treeLineAngles = [0.12, 0.35, 0.58, 0.82];
      for (const tl of treeLineAngles) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const baseDist = 50 + Math.random() * 20;
        for (let j = 0; j < 8; j++) {
          const tt = tl + (j - 4) * 0.008;
          if (tt < 0 || tt > 1) continue;
          const tp = this.spline.getPointAt(tt);
          const tangent = this.spline.getTangentAt(tt);
          const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
          const lx = tp.x + right.x * baseDist * side;
          const lz = tp.z + right.z * baseDist * side;
          if (this.distToTrack(lx, lz) < 20) continue;

          const treeH = 7 + Math.random() * 4;
          const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, treeH, 6);
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.set(lx, treeH / 2 - 2, lz);
          trunk.castShadow = true;
          this._add(trunk);

          const crownGeo = new THREE.SphereGeometry(2 + Math.random() * 1.5, 7, 5);
          const crownMat = new THREE.MeshStandardMaterial({
            color: leafColors[j % leafColors.length],
            roughness: 0.85
          });
          const crown = new THREE.Mesh(crownGeo, crownMat);
          crown.position.set(lx, treeH - 0.5, lz);
          crown.scale.set(1, 0.85, 1);
          crown.castShadow = true;
          this._add(crown);
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
          this._add(post);
        }

        // Rails (2 horizontal bars)
        for (let r = 0; r < 2; r++) {
          const railGeo = new THREE.BoxGeometry(fenceLen, 0.08, 0.06);
          const rail = new THREE.Mesh(railGeo, fenceMat);
          rail.position.set(pos.x, pos.y + 0.6 + r * 0.7, pos.z);
          rail.rotation.y = angle;
          this._add(rail);
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
        this._add(bar);
      }
    }
  }



  /**
   * Interlagos (Brazil) - Autodromo Jose Carlos Pace
   * Features: urban Sao Paulo skyline, Brazilian green/yellow/blue theme,
   *          tropical vegetation, grandstands, sponsor boards
   */
  _buildInterlagosScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Brazilian national colors: green, yellow, blue)
      const seatColors = [0x009c3b, 0xffdf00, 0x002776];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

    // ============================================================
    // 1. CITY SKYLINE - Sao Paulo urban backdrop
    //    Dense cluster of buildings to simulate the city environment
    // ============================================================
    {
      const buildingMat1 = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.7 });
      const buildingMat2 = new THREE.MeshStandardMaterial({ color: 0x778899, roughness: 0.7 });
      const buildingMat3 = new THREE.MeshStandardMaterial({ color: 0x99aabb, roughness: 0.6, metalness: 0.2 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.1, metalness: 0.6 });

      const buildings = [
        // North side skyline
        { x: 280, z: -350, w: 18, h: 55, d: 18, mat: buildingMat1 },
        { x: 320, z: -300, w: 14, h: 70, d: 14, mat: glassMat },
        { x: 350, z: -380, w: 20, h: 45, d: 20, mat: buildingMat2 },
        { x: 260, z: -280, w: 16, h: 38, d: 16, mat: buildingMat3 },
        { x: 380, z: -320, w: 12, h: 62, d: 12, mat: glassMat },
        { x: 300, z: -420, w: 22, h: 50, d: 18, mat: buildingMat1 },
        { x: 340, z: -260, w: 15, h: 42, d: 15, mat: buildingMat2 },
        { x: 250, z: -400, w: 18, h: 48, d: 18, mat: buildingMat3 },
        { x: 370, z: -430, w: 16, h: 58, d: 16, mat: glassMat },
        { x: 400, z: -360, w: 20, h: 40, d: 20, mat: buildingMat1 },
        // South side skyline
        { x: -280, z: 350, w: 16, h: 52, d: 16, mat: buildingMat1 },
        { x: -320, z: 380, w: 20, h: 65, d: 18, mat: glassMat },
        { x: -250, z: 300, w: 14, h: 44, d: 14, mat: buildingMat2 },
        { x: -350, z: 320, w: 18, h: 56, d: 18, mat: buildingMat3 },
        { x: -300, z: 420, w: 22, h: 48, d: 20, mat: buildingMat1 },
        { x: -260, z: 380, w: 15, h: 60, d: 15, mat: glassMat },
        { x: -340, z: 440, w: 17, h: 42, d: 17, mat: buildingMat2 },
        // East side
        { x: 400, z: 200, w: 16, h: 50, d: 16, mat: buildingMat1 },
        { x: 420, z: 150, w: 14, h: 58, d: 14, mat: glassMat },
        { x: 380, z: 250, w: 18, h: 42, d: 18, mat: buildingMat3 },
      ];

      for (const b of buildings) {
        if (this.distToTrack(b.x, b.z) < 60) continue;

        const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
        const building = new THREE.Mesh(geo, b.mat);
        building.position.set(b.x, b.h / 2 - 5, b.z);
        building.castShadow = true;
        building.receiveShadow = true;
        this._add(building);

        // Window rows (subtle horizontal bands)
        if (b.h > 30) {
          const bandMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.4, metalness: 0.3 });
          for (let row = 0; row < Math.floor(b.h / 8); row++) {
            const bandGeo = new THREE.BoxGeometry(b.w + 0.2, 0.3, b.d + 0.2);
            const band = new THREE.Mesh(bandGeo, bandMat);
            band.position.set(b.x, row * 8 + 4 - 5, b.z);
            this._add(band);
          }
        }
      }

      // Additional small buildings for density
      for (let i = 0; i < 30; i++) {
        const ang = (i / 30) * Math.PI * 2;
        const r = 300 + Math.random() * 150;
        const bx = Math.cos(ang) * r;
        const bz = Math.sin(ang) * r;
        if (this.distToTrack(bx, bz) < 80) continue;

        const bw = 8 + Math.random() * 14;
        const bh = 20 + Math.random() * 40;
        const bd = 8 + Math.random() * 14;
        const mat = [buildingMat1, buildingMat2, buildingMat3, glassMat][Math.floor(Math.random() * 4)];

        const geo = new THREE.BoxGeometry(bw, bh, bd);
        const building = new THREE.Mesh(geo, mat);
        building.position.set(bx, bh / 2 - 5, bz);
        building.castShadow = true;
        this._add(building);
      }
    }

    // ============================================================
    // 2. MAIN GRANDSTAND - Start/Finish straight
    //    Large grandstand with Brazilian flag colors
    // ============================================================
    placeStand(0.05, hw + 22, 1, 45, 10, 10, 0x222233, 0x009c3b);

    // ============================================================
    // 3. PIT BUILDING - Opposite side of main straight
    // ============================================================
    {
      const { pos, angle } = safeOffset(0.08, hw + 18, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 40, pitH = 5, pitD = 8;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.3 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        this._add(pit);

        // Pit garages with Brazilian colors (green/yellow/blue)
        const garageColors = [0x009c3b, 0xffdf00, 0x002776, 0xffdf00, 0x009c3b];
        for (let i = 0; i < 12; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 5.5) * 3.2;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          this._add(g);
        }

        // INTERLAGOS sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#009c3b';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffdf00';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('AUTODROMO INTERLAGOS', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(16, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        this._add(sign);
      }
    }

    // ============================================================
    // 4. SECONDARY GRANDSTANDS - Key corner positions
    // ============================================================
    placeStand(0.20, hw + 20, -1, 30, 7, 8, 0x333344, 0xffdf00);   // Senna S area
    placeStand(0.35, hw + 18, 1, 24, 6, 7, 0x2a3a4a, 0x009c3b);    // Mid-section
    placeStand(0.50, hw + 22, -1, 28, 7, 8, 0x3a3a4a, 0x002776);   // Back straight
    placeStand(0.65, hw + 18, 1, 22, 5, 7, 0x2a2a3a, 0xffdf00);    // Infield section
    placeStand(0.80, hw + 20, -1, 26, 6, 7, 0x334455, 0x009c3b);   // Near final corners
    placeStand(0.92, hw + 18, 1, 20, 5, 6, 0x2a3a4a, 0x002776);    // Approach to finish

    // ============================================================
    // 5. TROPICAL VEGETATION - Brazilian palm trees and lush greenery
    // ============================================================
    {
      // Tall royal palms (iconic of Brazilian circuits)
      const palmCount = 45;
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 6.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
      const leafGeo = new THREE.ConeGeometry(3.0, 2.5, 6);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a8a2a, roughness: 0.8 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, palmCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx = 0;
      for (let i = 0; i < palmCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 18 && attempts < 50);

        const y = this.getTerrainHeight(x, z);
        const scale = 0.8 + Math.random() * 0.7;

        // Trunk
        dummy.position.set(x, y + 3.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);

        // Palm canopy
        dummy.position.set(x, y + 6.8 * scale, z);
        dummy.scale.set(scale * 1.3, scale * 0.9, scale * 1.3);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(idx, dummy.matrix);
        idx++;
      }

      trunkMesh.count = idx;
      leafMesh.count = idx;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leafMesh.instanceMatrix.needsUpdate = true;
      this._add(trunkMesh);
      this._add(leafMesh);

      // Dense tropical bushes (brighter green)
      const bushGeo = new THREE.SphereGeometry(1.5, 6, 5);
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.9 });

      for (let i = 0; i < 60; i++) {
        const t = Math.random();
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = hw + 12 + Math.random() * 25;
        const bx = p.x + right.x * dist * side;
        const bz = p.z + right.z * dist * side;
        if (this.distToTrack(bx, bz) < hw + 8) continue;

        const scale = 0.6 + Math.random() * 1.2;
        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.position.set(bx, this.getTerrainHeight(bx, bz) + scale * 0.5, bz);
        bush.scale.set(scale, scale * 0.7, scale);
        this._add(bush);
      }
    }

    // ============================================================
    // 6. SPONSOR BOARDS - F1 sponsors with Brazilian GP branding
    // ============================================================
    {
      const sponsors = [
        { name: 'BRAZIL GP', bg: '#009c3b', fg: '#ffdf00' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'PETROBRAS', bg: '#002776', fg: '#ffdf00' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'INTERLAGOS', bg: '#002776', fg: '#ffdf00' },
      ];

      const boardCount = 12;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;

        placeBoard(t, dist, side, sponsors[i % sponsors.length]);
      }
    }

    // ============================================================
    // 7. SENNA S SIGNAGE - Iconic corner name sign
    // ============================================================
    {
      const { pos: sennaPos, angle: sennaAngle } = safeOffset(0.18, hw + 14, 1);
      if (isSafe(sennaPos.x, sennaPos.z, 5)) {
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#002776';
        signCtx.fillRect(0, 0, 256, 64);
        signCtx.fillStyle = '#ffdf00';
        signCtx.font = 'bold 28px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('SENNA S', 128, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(8, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);

        const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(postGeo, postMat);
          const offset = s * 4;
          const cosA = Math.cos(sennaAngle), sinA = Math.sin(sennaAngle);
          post.position.set(
            sennaPos.x + offset * cosA,
            sennaPos.y + 2,
            sennaPos.z - offset * sinA
          );
          this._add(post);
        }
        sign.position.set(sennaPos.x, sennaPos.y + 4.5, sennaPos.z);
        sign.rotation.y = sennaAngle;
        this._add(sign);
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
        { t: 0.25, side: 1 },
        { t: 0.38, side: -1 },
        { t: 0.52, side: 1 },
        { t: 0.68, side: -1 },
        { t: 0.82, side: 1 },
        { t: 0.93, side: -1 },
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
          this._add(tire);
        }
      }
    }
  }


  /**
   * Albert Park Circuit (Melbourne, Australia) - Urban park street circuit
   * Features: Albert Park Lake in center, eucalyptus/gum trees,
   *           Melbourne city skyline, grandstands on main straight and key corners,
   *           Australian GP sponsor boards, concrete street-circuit barriers
   */
  _buildAlbertParkScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand with Australian GP theme
    const placeStand = (t, dist, side, width, height, depth, color, roofColor, seatColorA, seatColorB) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      // Seats (Australian colors: green-gold-white)
      const seatColors = [seatColorA || 0x00843D, seatColorB || 0xFFCD00, seatColorA || 0x00843D];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

    // ============================================================
    // 1. ALBERT PARK LAKE - Central water body inside the circuit
    //    The circuit wraps around this iconic lake
    // ============================================================
    {
      // Estimate track center for lake placement
      let cx = 0, cz = 0;
      let ptCount = 0;
      for (let t = 0; t < 1; t += 0.01) {
        const p = this.spline.getPointAt(t);
        cx += p.x; cz += p.z;
        ptCount++;
      }
      cx /= ptCount; cz /= ptCount;

      const lakeGeo = new THREE.CircleGeometry(60, 32);
      const lakeMat = new THREE.MeshStandardMaterial({
        color: 0x3388aa, roughness: 0.1, metalness: 0.3,
        transparent: true, opacity: 0.85
      });
      const lake = new THREE.Mesh(lakeGeo, lakeMat);
      lake.position.set(cx, -0.15, cz);
      lake.rotation.x = -Math.PI / 2;
      this._add(lake);

      // Lake edge ring (sandy/stone shore)
      const shoreGeo = new THREE.RingGeometry(58, 64, 32);
      const shoreMat = new THREE.MeshStandardMaterial({ color: 0x9a8a6a, roughness: 0.95 });
      const shore = new THREE.Mesh(shoreGeo, shoreMat);
      shore.position.set(cx, -0.1, cz);
      shore.rotation.x = -Math.PI / 2;
      this._add(shore);
    }

    // ============================================================
    // 2. MAIN GRANDSTAND - Start/Finish straight
    //    Large main grandstand with Australian green/gold theme
    // ============================================================
    placeStand(0.03, hw + 22, 1, 45, 10, 10, 0x222233, 0x00843D, 0x00843D, 0xFFCD00);

    // Pit building opposite side (t=0.06)
    {
      const { pos, angle } = safeOffset(0.06, hw + 20, -1);
      if (isSafe(pos.x, pos.z, 5)) {
        const pitW = 38, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        this._add(pit);

        // Pit garages with green doors (Australian GP colors)
        const garageColors = [0x00843D, 0xffffff, 0x00843D, 0xffffff, 0x00843D];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.5, 3);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.5;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y + 0.5,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          this._add(g);
        }

        // ALBERT PARK CIRCUIT sign on pit building
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#00843D';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 36px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('ALBERT PARK CIRCUIT', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(16, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        this._add(sign);
      }
    }

    // ============================================================
    // 3. SECONDARY GRANDSTAND - Turn 1 area (t~0.15)
    //    High-speed first corner viewing stand
    // ============================================================
    placeStand(0.15, hw + 20, -1, 32, 8, 8, 0x333344, 0x00843D, 0xFFCD00, 0xffffff);

    // ============================================================
    // 4. MELBOURNE SKYLINE - City buildings in background
    //    Distant modern buildings representing Melbourne CBD
    // ============================================================
    {
      const skylineColors = [0x667788, 0x556677, 0x778899, 0x607080, 0x505a6a];
      const buildings = [
        { x: -320, z: -350, w: 12, h: 45, d: 12 },
        { x: -280, z: -380, w: 10, h: 55, d: 10 },
        { x: -250, z: -340, w: 14, h: 35, d: 14 },
        { x: -200, z: -370, w: 11, h: 50, d: 11 },
        { x: -360, z: -320, w: 9, h: 38, d: 9 },
        { x: -220, z: -390, w: 13, h: 42, d: 13 },
        { x: -310, z: -360, w: 8, h: 60, d: 8 },
        { x: -270, z: -330, w: 15, h: 30, d: 15 },
        { x: -340, z: -370, w: 10, h: 48, d: 10 },
        { x: -190, z: -350, w: 12, h: 36, d: 12 },
      ];

      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (this.distToTrack(b.x, b.z) < 40) continue;

        const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
        const color = skylineColors[i % skylineColors.length];
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 });
        const building = new THREE.Mesh(geo, mat);
        building.position.set(b.x, b.h / 2 - 2, b.z);
        building.castShadow = true;
        this._add(building);

        // Glass windows (emissive dots)
        const windowMat = new THREE.MeshStandardMaterial({ color: 0xffeeaa, emissive: 0xffeeaa, emissiveIntensity: 0.2 });
        const winGeo = new THREE.PlaneGeometry(0.7, 0.5);
        const floors = Math.floor(b.h / 3);
        const winCols = Math.floor(b.w / 2);
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < winCols; c++) {
            if (Math.random() > 0.5) continue;
            const win = new THREE.Mesh(winGeo, windowMat);
            win.position.set(
              b.x - b.w / 2 + 1 + c * 2,
              1 + f * 3,
              b.z + b.d / 2 + 0.05
            );
            this._add(win);
          }
        }
      }
    }

    // ============================================================
    // 5. EUCALYPTUS TREES - Australian gum trees scattered around
    //    Tall trunks with sparse olive-green canopy
    // ============================================================
    {
      const eucCount = 60;
      // Eucalyptus: tall pale trunk, sparse olive/sage canopy
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 6.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0xb0a890, roughness: 0.85 });
      const canopyGeo1 = new THREE.SphereGeometry(2.2, 8, 6);
      const canopyMat1 = new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.8 });
      const canopyGeo2 = new THREE.SphereGeometry(1.8, 8, 6);
      const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x6a8a50, roughness: 0.8 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, eucCount);
      const canopy1 = new THREE.InstancedMesh(canopyGeo1, canopyMat1, Math.floor(eucCount * 0.6));
      const canopy2 = new THREE.InstancedMesh(canopyGeo2, canopyMat2, Math.ceil(eucCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < eucCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 16 && attempts < 50);
        if (attempts >= 50) continue;

        const y = this.getTerrainHeight(x, z);
        const scale = 0.8 + Math.random() * 0.5;

        // Trunk (tall and slender, typical of gum trees)
        dummy.position.set(x, y + 3.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx1 + idx2, dummy.matrix);

        // Canopy - sparse, slightly higher than typical trees
        dummy.position.set(x, y + 6.5 * scale, z);
        dummy.scale.set(scale * 1.1, scale * 0.8, scale * 1.1);
        dummy.updateMatrix();
        if (idx1 < Math.floor(eucCount * 0.6)) {
          canopy1.setMatrixAt(idx1, dummy.matrix);
          idx1++;
        } else {
          canopy2.setMatrixAt(idx2, dummy.matrix);
          idx2++;
        }
      }

      trunkMesh.count = idx1 + idx2;
      canopy1.count = idx1;
      canopy2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      canopy1.instanceMatrix.needsUpdate = true;
      canopy2.instanceMatrix.needsUpdate = true;
      this._add(trunkMesh);
      this._add(canopy1);
      this._add(canopy2);
    }

    // ============================================================
    // 6. SPONSOR BOARDS - Australian GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'AUSTRALIAN GP', bg: '#00843D', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'MSC CRUISES', bg: '#003366', fg: '#ffffff' },
        { name: 'CRYPTO.COM', bg: '#1a1a2e', fg: '#00d4ff' },
        { name: 'MELBOURNE', bg: '#1a3a6a', fg: '#ffffff' },
        { name: 'F1', bg: '#e10600', fg: '#ffffff' },
      ];

      const boardCount = 10;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;
        if (this.distToTrack(x, z) < hw + 8) continue;
        placeBoard(t, dist, side, sponsors[i % sponsors.length]);
      }
    }

    // ============================================================
    // 7. CONCRETE BARRIERS - Street circuit guardrails
    //    Typical Albert Park temporary concrete/steel barriers
    // ============================================================
    {
      const barrierGeo = new THREE.BoxGeometry(6, 1.2, 0.6);
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5, metalness: 0.3 });
      const barrierMatYellow = new THREE.MeshStandardMaterial({ color: 0xddcc00, roughness: 0.5, metalness: 0.3 });

      const barrierPositions = [
        { t: 0.12, side: 1 },    // Turn 1 outer
        { t: 0.18, side: -1 },   // Turn 2 outer
        { t: 0.30, side: 1 },    // Turn 3/4 outer
        { t: 0.45, side: -1 },   // Mid-section outer
        { t: 0.55, side: 1 },    // Sector 2 outer
        { t: 0.70, side: -1 },   // Back straight outer
        { t: 0.80, side: 1 },    // Fast chicane outer
        { t: 0.92, side: -1 },   // Final corner outer
      ];

      for (let i = 0; i < barrierPositions.length; i++) {
        const bp = barrierPositions[i];
        const { pos, angle } = safeOffset(bp.t, hw + 3, bp.side);
        if (!isSafe(pos.x, pos.z, 2)) continue;

        const mat = (i % 3 === 0) ? barrierMatYellow : barrierMat;
        const barrier = new THREE.Mesh(barrierGeo, mat);
        barrier.position.set(pos.x, pos.y + 0.6, pos.z);
        barrier.rotation.y = angle;
        barrier.castShadow = true;
        this._add(barrier);
      }
    }

    // ============================================================
    // 8. TIRE WALLS - Key corner apexes and exits
    // ============================================================
    {
      const tireGeo = new THREE.TorusGeometry(0.35, 0.18, 8, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const tirePositions = [
        { t: 0.12, side: -1 },
        { t: 0.22, side: 1 },
        { t: 0.35, side: -1 },
        { t: 0.48, side: 1 },
        { t: 0.62, side: -1 },
        { t: 0.75, side: 1 },
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
          this._add(tire);
        }
      }
    }
  }

  _buildAmericasScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    const placeStand = (t, dist, side, width, height, depth, color, roofColor, seatColors) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;

      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);

      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);

      const colors = seatColors || [0xcc0000, 0xffffff, 0x003399];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: colors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;

      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);

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
      this._add(board);
    };

    // 1. ICONIC OBSERVATION TOWER - COTA's signature red observation tower
    {
      const { pos: towerPos, angle: towerAngle } = safeOffset(0.72, hw + 35, 1);
      if (isSafe(towerPos.x, towerPos.z, 15)) {
        const towerH = 28;

        const pillarGeo = new THREE.CylinderGeometry(0.6, 1.2, towerH, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.4, metalness: 0.5 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(towerPos.x, towerPos.y + towerH / 2, towerPos.z);
        pillar.castShadow = true;
        this._add(pillar);

        const deckGeo = new THREE.CylinderGeometry(4, 4, 2, 12);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.3, metalness: 0.5 });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(towerPos.x, towerPos.y + towerH, towerPos.z);
        deck.castShadow = true;
        this._add(deck);

        const glassGeo = new THREE.CylinderGeometry(3.8, 3.8, 3, 12, 1, true);
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0x88ccff, roughness: 0.1, metalness: 0.8,
          transparent: true, opacity: 0.4, side: THREE.DoubleSide
        });
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(towerPos.x, towerPos.y + towerH + 2.5, towerPos.z);
        this._add(glass);

        const capGeo = new THREE.ConeGeometry(4.5, 3, 12);
        const capMat = new THREE.MeshStandardMaterial({ color: 0xaa1a00, roughness: 0.3, metalness: 0.5 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(towerPos.x, towerPos.y + towerH + 5.5, towerPos.z);
        cap.castShadow = true;
        this._add(cap);

        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256; signCanvas.height = 128;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#cc2200';
        signCtx.fillRect(0, 0, 256, 128);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 60px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('COTA', 128, 64);
        const signTex = new THREE.CanvasTexture(signCanvas);

        for (let face = 0; face < 4; face++) {
          const faceSignGeo = new THREE.PlaneGeometry(4, 2);
          const faceSignMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
          const faceSign = new THREE.Mesh(faceSignGeo, faceSignMat);
          const fAngle = towerAngle + (face * Math.PI / 2);
          faceSign.position.set(
            towerPos.x + Math.sin(fAngle) * 2.2,
            towerPos.y + towerH + 2.5,
            towerPos.z + Math.cos(fAngle) * 2.2
          );
          faceSign.rotation.y = fAngle;
          this._add(faceSign);
        }

        for (let i = 0; i < 4; i++) {
          const strutAngle = towerAngle + (i * Math.PI / 2) + Math.PI / 4;
          const strutGeo = new THREE.CylinderGeometry(0.15, 0.15, towerH * 0.7, 4);
          const strutMat = new THREE.MeshStandardMaterial({ color: 0x991800, roughness: 0.4, metalness: 0.4 });
          const strut = new THREE.Mesh(strutGeo, strutMat);
          strut.position.set(
            towerPos.x + Math.sin(strutAngle) * 3,
            towerPos.y + towerH * 0.35,
            towerPos.z + Math.cos(strutAngle) * 3
          );
          strut.rotation.z = Math.PI * 0.08 * (i % 2 === 0 ? 1 : -1);
          strut.rotation.x = Math.PI * 0.08 * (i < 2 ? 1 : -1);
          this._add(strut);
        }
      }
    }

    // 2. MAIN GRANDSTAND - Start/Finish straight
    placeStand(0.02, hw + 18, 1, 45, 10, 10, 0x333344, 0x003399, [0xcc0000, 0xffffff, 0x003399]);

    // 3. PIT BUILDING - Opposite side of main straight
    {
      const { pos, angle } = safeOffset(0.06, hw + 16, -1);
      if (isSafe(pos.x, pos.z, 8)) {
        const pitW = 40, pitH = 5, pitD = 7;
        const pitGeo = new THREE.BoxGeometry(pitW, pitH, pitD);
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.4 });
        const pit = new THREE.Mesh(pitGeo, pitMat);
        pit.position.set(pos.x, pos.y + pitH / 2, pos.z);
        pit.rotation.y = angle;
        pit.castShadow = true;
        this._add(pit);

        const garageColors = [0xcc0000, 0xffffff, 0x003399, 0xcc0000, 0xffffff];
        for (let i = 0; i < 10; i++) {
          const gGeo = new THREE.PlaneGeometry(2.8, 3.2);
          const gMat = new THREE.MeshStandardMaterial({ color: garageColors[i % garageColors.length], roughness: 0.5 });
          const g = new THREE.Mesh(gGeo, gMat);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const localX = (i - 4.5) * 3.8;
          g.position.set(
            pos.x + localX * cosA - (pitD / 2) * sinA,
            pos.y,
            pos.z - localX * sinA + (pitD / 2) * cosA
          );
          g.rotation.y = angle;
          this._add(g);
        }

        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512; signCanvas.height = 64;
        const signCtx = signCanvas.getContext('2d');
        signCtx.fillStyle = '#003399';
        signCtx.fillRect(0, 0, 512, 64);
        signCtx.fillStyle = '#ffffff';
        signCtx.font = 'bold 28px Arial';
        signCtx.textAlign = 'center';
        signCtx.textBaseline = 'middle';
        signCtx.fillText('CIRCUIT OF THE AMERICAS', 256, 32);
        const signTex = new THREE.CanvasTexture(signCanvas);
        const signGeo = new THREE.PlaneGeometry(18, 2);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(pos.x, pos.y + pitH + 1.5, pos.z);
        sign.rotation.y = angle;
        this._add(sign);
      }
    }

    // 4. SECONDARY GRANDSTANDS - Key corners
    {
      const secondaryStands = [
        { t: 0.12, side: 1, w: 28, h: 7, d: 7 },
        { t: 0.22, side: -1, w: 22, h: 5, d: 6 },
        { t: 0.40, side: 1, w: 24, h: 6, d: 6 },
        { t: 0.58, side: -1, w: 22, h: 5, d: 6 },
        { t: 0.88, side: 1, w: 25, h: 6, d: 6 },
      ];

      for (const s of secondaryStands) {
        const { pos: sPos, angle: sAngle } = safeOffset(s.t, hw + 16, s.side);
        if (!isSafe(sPos.x, sPos.z, s.w / 2)) continue;

        const sGeo = new THREE.BoxGeometry(s.w, s.h, s.d);
        const sMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.6 });
        const standMesh = new THREE.Mesh(sGeo, sMat);
        standMesh.position.set(sPos.x, sPos.y + s.h / 2, sPos.z);
        standMesh.rotation.y = sAngle;
        standMesh.castShadow = true;
        standMesh.receiveShadow = true;
        this._add(standMesh);

        const roofGeo = new THREE.BoxGeometry(s.w + 2, 0.35, s.d + 2);
        const roofColor = s.side > 0 ? 0xcc2200 : 0x003399;
        const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(sPos.x, sPos.y + s.h + 0.2, sPos.z);
        roof.rotation.y = sAngle;
        roof.castShadow = true;
        this._add(roof);

        const sSeatColors = [0xcc0000, 0xffffff, 0x003399];
        const sRows = 2;
        const sCols = Math.floor(s.w / 2);
        for (let r = 0; r < sRows; r++) {
          for (let c = 0; c < sCols; c++) {
            const seatGeo = new THREE.BoxGeometry(0.45, 0.6, 0.45);
            const seatMat = new THREE.MeshStandardMaterial({ color: sSeatColors[r % 3] });
            const seat = new THREE.Mesh(seatGeo, seatMat);
            const localX = (c - sCols / 2 + 0.5) * 1.7;
            const localZ = (r - 0.5) * (s.d / 3);
            const cosA = Math.cos(sAngle), sinA = Math.sin(sAngle);
            seat.position.set(
              sPos.x + localX * cosA + localZ * sinA,
              sPos.y + 0.4 + r * 1.0,
              sPos.z - localX * sinA + localZ * cosA
            );
            seat.rotation.y = sAngle;
            this._add(seat);
          }
        }
      }
    }

    // 5. TEXAS LIVE OAK TREES
    {
      const oakCount = 80;
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 4.0, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
      const leafGeo1 = new THREE.SphereGeometry(3.5, 8, 6);
      const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.85 });
      const leafGeo2 = new THREE.SphereGeometry(2.8, 7, 5);
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.85 });

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, oakCount);
      const leaves1 = new THREE.InstancedMesh(leafGeo1, leafMat1, Math.floor(oakCount * 0.6));
      const leaves2 = new THREE.InstancedMesh(leafGeo2, leafMat2, Math.ceil(oakCount * 0.4));
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      let idx1 = 0, idx2 = 0;
      for (let i = 0; i < oakCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 18 && attempts < 50);
        if (attempts >= 50) continue;

        const y = this.getTerrainHeight(x, z);
        const scale = 0.6 + Math.random() * 0.6;

        dummy.position.set(x, y + 2.0 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        if (i < Math.floor(oakCount * 0.6)) {
          trunkMesh.setMatrixAt(idx1, dummy.matrix);
          dummy.position.set(x, y + 4.5 * scale, z);
          dummy.scale.set(scale * 1.5, scale * 0.8, scale * 1.5);
          dummy.updateMatrix();
          leaves1.setMatrixAt(idx1, dummy.matrix);
          idx1++;
        } else {
          trunkMesh.setMatrixAt(idx1 + idx2, dummy.matrix);
          dummy.position.set(x, y + 4.0 * scale, z);
          dummy.scale.set(scale * 1.2, scale * 0.7, scale * 1.2);
          dummy.updateMatrix();
          leaves2.setMatrixAt(idx2, dummy.matrix);
          idx2++;
        }
      }

      trunkMesh.count = idx1 + idx2;
      leaves1.count = idx1;
      leaves2.count = idx2;
      trunkMesh.instanceMatrix.needsUpdate = true;
      leaves1.instanceMatrix.needsUpdate = true;
      leaves2.instanceMatrix.needsUpdate = true;
      this._add(trunkMesh);
      this._add(leaves1);
      this._add(leaves2);
    }

    // 6. TEXAS CACTUS AND BRUSH
    {
      const cactusCount = 40;
      const cactusGeo = new THREE.ConeGeometry(0.4, 2.5, 6);
      const cactusMat = new THREE.MeshStandardMaterial({ color: 0x4a7a2a, roughness: 0.85 });
      const brushGeo = new THREE.SphereGeometry(0.8, 6, 5);
      const brushMat = new THREE.MeshStandardMaterial({ color: 0x7a8a3a, roughness: 0.9 });

      const cactusMesh = new THREE.InstancedMesh(cactusGeo, cactusMat, cactusCount);
      const brushMesh = new THREE.InstancedMesh(brushGeo, brushMat, cactusCount);
      const dummy = new THREE.Object3D();

      const treeRangeX = this.trackBounds ? Math.max(400, this.trackBounds.width + 200) / 2 : 200;
      const treeRangeZ = this.trackBounds ? Math.max(400, this.trackBounds.depth + 200) / 2 : 200;

      for (let i = 0; i < cactusCount; i++) {
        let x, z;
        let attempts = 0;
        do {
          x = (Math.random() - 0.5) * treeRangeX * 2;
          z = (Math.random() - 0.5) * treeRangeZ * 2;
          attempts++;
        } while (this.distToTrack(x, z) < 14 && attempts < 50);
        if (attempts >= 50) continue;

        const y = this.getTerrainHeight(x, z);
        const scale = 0.5 + Math.random() * 0.8;

        dummy.position.set(x, y + 1.2 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        cactusMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x + (Math.random() - 0.5) * 3, y + 0.4 * scale, z + (Math.random() - 0.5) * 3);
        dummy.scale.set(scale * 1.2, scale * 0.6, scale * 1.2);
        dummy.updateMatrix();
        brushMesh.setMatrixAt(i, dummy.matrix);
      }

      cactusMesh.count = cactusCount;
      brushMesh.count = cactusCount;
      cactusMesh.instanceMatrix.needsUpdate = true;
      brushMesh.instanceMatrix.needsUpdate = true;
      this._add(cactusMesh);
      this._add(brushMesh);
    }

    // 7. SPONSOR BOARDS
    {
      const sponsors = [
        { name: 'COTA', bg: '#cc2200', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'EMIRATES', bg: '#d71921', fg: '#ffffff' },
        { name: 'MOBIL 1', bg: '#003399', fg: '#ffffff' },
        { name: 'TEXAS', bg: '#002868', fg: '#ffffff' },
        { name: 'COTA', bg: '#cc2200', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
      ];

      const boardCount = 12;
      for (let i = 0; i < boardCount; i++) {
        const t = (i + 0.5) / boardCount;
        const p = this.spline.getPointAt(t);
        const tangent = this.spline.getTangentAt(t);
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + Math.random() * 5;
        const x = p.x + right.x * dist * side;
        const z = p.z + right.z * dist * side;

        if (!isSafe(x, z, 3)) continue;

        const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, p.y + 1.5, z);
        this._add(post);

        const sponsor = sponsors[i % sponsors.length];
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
        board.position.set(x, p.y + 4.5, z);
        board.rotation.y = Math.atan2(tangent.x, tangent.z);
        board.castShadow = true;
        this._add(board);
      }
    }

    // 8. AMERICAN FLAGS - along the main straight
    {
      const flagPositions = [
        { t: 0.01, side: 1 },
        { t: 0.03, side: -1 },
        { t: 0.05, side: 1 },
        { t: 0.07, side: -1 },
      ];

      for (const fp of flagPositions) {
        const { pos, angle } = safeOffset(fp.t, hw + 12, fp.side);
        if (!isSafe(pos.x, pos.z, 3)) continue;

        const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 8, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 4, pos.z);
        this._add(pole);

        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128; flagCanvas.height = 80;
        const fCtx = flagCanvas.getContext('2d');
        for (let s = 0; s < 13; s++) {
          fCtx.fillStyle = s % 2 === 0 ? '#cc0000' : '#ffffff';
          fCtx.fillRect(0, s * (80 / 13), 128, 80 / 13 + 1);
        }
        fCtx.fillStyle = '#003399';
        fCtx.fillRect(0, 0, 50, 42);
        fCtx.fillStyle = '#ffffff';
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 4; c++) {
            fCtx.beginPath();
            fCtx.arc(8 + c * 10, 8 + r * 12, 2, 0, Math.PI * 2);
            fCtx.fill();
          }
        }
        const flagTex = new THREE.CanvasTexture(flagCanvas);
        const flagGeo = new THREE.PlaneGeometry(2.5, 1.5);
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.5 });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        flag.position.set(
          pos.x + 1.25 * cosA,
          pos.y + 7.2,
          pos.z - 1.25 * sinA
        );
        flag.rotation.y = angle;
        this._add(flag);
      }
    }
  }


  /**
   * Baku City Circuit (Azerbaijan) - Street circuit through the old city
   * Features: Ancient fortress walls of Icherisheher, modern glass skyscrapers,
   *          Flame Towers, grandstands, sponsor boards, Flame Tower LED facades
   */
  _buildBakuScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // Helper: find a safe position offset from a track point
    const safeOffset = (t, dist, side = 1) => {
      const p = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const pos = p.clone().add(right.clone().multiplyScalar(dist * side));
      const angle = Math.atan2(tangent.x, tangent.z);
      return { pos, angle, tangent, right };
    };

    // Helper: check if a position is safe from the track
    const isSafe = (x, z, extraDist = 0) => {
      return this.distToTrack(x, z) >= hw + 5 + extraDist;
    };

    // Helper: place a grandstand with roof
    const placeStand = (t, dist, side, width, height, depth, color, roofColor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, width / 2)) return null;
      const standGeo = new THREE.BoxGeometry(width, height, depth);
      const standMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(pos.x, pos.y + height / 2, pos.z);
      stand.rotation.y = angle;
      stand.castShadow = true;
      stand.receiveShadow = true;
      this._add(stand);
      const roofGeo = new THREE.BoxGeometry(width + 2, 0.4, depth + 2);
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, pos.y + height + 0.2, pos.z);
      roof.rotation.y = angle;
      roof.castShadow = true;
      this._add(roof);
      // Colored seat rows (Azerbaijan flag: blue, red, green)
      const seatColors = [0x00b5e2, 0xed2939, 0x3f9c35];
      const rows = 3;
      const cols = Math.floor(width / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seatGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
          const seatMat = new THREE.MeshStandardMaterial({ color: seatColors[r % 3] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const localX = (c - cols / 2 + 0.5) * 1.8;
          const localZ = (r - 1) * (depth / 2.5);
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          seat.position.set(
            pos.x + localX * cosA + localZ * sinA,
            pos.y + 0.5 + r * 1.0,
            pos.z - localX * sinA + localZ * cosA
          );
          seat.rotation.y = angle;
          this._add(seat);
        }
      }
      return pos;
    };

    // Helper: place a sponsor board
    const placeBoard = (t, dist, side, sponsor) => {
      const { pos, angle } = safeOffset(t, dist, side);
      if (!isSafe(pos.x, pos.z, 3)) return;
      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pos.x, pos.y + 1.5, pos.z);
      this._add(post);
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
      this._add(board);
    };

    // ============================================================
    // 1. ANCIENT FORTRESS WALLS (Icherisheher Old City)
    //    Medieval stone walls with battlements and watchtowers
    //    Placed along the narrow "castle section" of the circuit
    // ============================================================
    {
      const wallColor = 0xc4a86a;
      const wallDarkColor = 0xa89058;
      const stoneMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9, metalness: 0.0 });
      const stoneDarkMat = new THREE.MeshStandardMaterial({ color: wallDarkColor, roughness: 0.9, metalness: 0.0 });
      const merlonMat = new THREE.MeshStandardMaterial({ color: 0xb89860, roughness: 0.85, metalness: 0.0 });

      // Fortress wall segments along the castle section (~30-50% of track)
      const wallSegments = [
        { t: 0.30, dist: 20, side: 1, len: 30, h: 10 },
        { t: 0.33, dist: 18, side: -1, len: 25, h: 10 },
        { t: 0.36, dist: 22, side: 1, len: 28, h: 10 },
        { t: 0.39, dist: 17, side: -1, len: 22, h: 10 },
        { t: 0.42, dist: 20, side: 1, len: 30, h: 10 },
        { t: 0.45, dist: 19, side: -1, len: 26, h: 10 },
        { t: 0.48, dist: 21, side: 1, len: 24, h: 10 },
        { t: 0.50, dist: 18, side: -1, len: 28, h: 10 },
      ];

      for (const ws of wallSegments) {
        const { pos, angle } = safeOffset(ws.t, ws.dist, ws.side);
        if (!isSafe(pos.x, pos.z, ws.len / 2)) continue;

        // Main wall body
        const wallGeo = new THREE.BoxGeometry(ws.len, ws.h, 2.5);
        const wall = new THREE.Mesh(wallGeo, stoneMat);
        wall.position.set(pos.x, pos.y + ws.h / 2, pos.z);
        wall.rotation.y = angle;
        wall.castShadow = true;
        wall.receiveShadow = true;
        this._add(wall);

        // Battlements (merlons) on top
        const merlonCount = Math.floor(ws.len / 3);
        const merlonGeo = new THREE.BoxGeometry(1.2, 1.5, 2.8);
        for (let m = 0; m < merlonCount; m++) {
          if (m % 2 === 0) {
            const merlon = new THREE.Mesh(merlonGeo, merlonMat);
            const localX = (m - merlonCount / 2 + 0.5) * 3;
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            merlon.position.set(
              pos.x + localX * cosA,
              pos.y + ws.h + 0.75,
              pos.z - localX * sinA
            );
            merlon.rotation.y = angle;
            merlon.castShadow = true;
            this._add(merlon);
          }
        }

        // Stone texture stripes
        const stripeGeo = new THREE.BoxGeometry(ws.len + 0.1, 0.3, 2.6);
        for (let s = 0; s < 3; s++) {
          const stripe = new THREE.Mesh(stripeGeo, stoneDarkMat);
          stripe.position.set(pos.x, pos.y + 2 + s * 3, pos.z);
          stripe.rotation.y = angle;
          this._add(stripe);
        }
      }

      // Watchtowers at wall corners
      const towerPositions = [
        { t: 0.30, dist: 22, side: 1 },
        { t: 0.42, dist: 24, side: 1 },
        { t: 0.36, dist: 20, side: -1 },
        { t: 0.50, dist: 20, side: -1 },
      ];

      for (const tp of towerPositions) {
        const { pos } = safeOffset(tp.t, tp.dist, tp.side);
        if (!isSafe(pos.x, pos.z, 4)) continue;

        const towerH = 14;
        const towerGeo = new THREE.CylinderGeometry(2.5, 3, towerH, 8);
        const tower = new THREE.Mesh(towerGeo, stoneMat);
        tower.position.set(pos.x, pos.y + towerH / 2, pos.z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        this._add(tower);

        // Tower top cap
        const capGeo = new THREE.CylinderGeometry(3.2, 2.5, 1.5, 8);
        const cap = new THREE.Mesh(capGeo, stoneDarkMat);
        cap.position.set(pos.x, pos.y + towerH + 0.75, pos.z);
        cap.castShadow = true;
        this._add(cap);

        // Tower merlons
        const tMerlonGeo = new THREE.BoxGeometry(1.0, 1.2, 1.0);
        for (let a = 0; a < 8; a++) {
          if (a % 2 === 0) {
            const mAngle = (a / 8) * Math.PI * 2;
            const m = new THREE.Mesh(tMerlonGeo, merlonMat);
            m.position.set(
              pos.x + Math.cos(mAngle) * 3,
              pos.y + towerH + 2.0,
              pos.z + Math.sin(mAngle) * 3
            );
            m.castShadow = true;
            this._add(m);
          }
        }
      }

      // Ancient arched gate in the wall (Azerbaijani pointed arch style)
      {
        const { pos, angle } = safeOffset(0.38, 19, 1);
        if (isSafe(pos.x, pos.z, 5)) {
          const archW = 6;
          const archH = 9;
          const archD = 3;
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          const perpX = -sinA, perpZ = cosA;

          // Left pillar
          const pillarGeo = new THREE.BoxGeometry(1.5, archH, archD);
          const leftPillar = new THREE.Mesh(pillarGeo, stoneMat);
          leftPillar.position.set(
            pos.x - perpX * archW / 2,
            pos.y + archH / 2,
            pos.z - perpZ * archW / 2
          );
          leftPillar.rotation.y = angle;
          leftPillar.castShadow = true;
          this._add(leftPillar);

          const rightPillar = new THREE.Mesh(pillarGeo, stoneMat);
          rightPillar.position.set(
            pos.x + perpX * archW / 2,
            pos.y + archH / 2,
            pos.z + perpZ * archW / 2
          );
          rightPillar.rotation.y = angle;
          rightPillar.castShadow = true;
          this._add(rightPillar);

          // Arch top beam
          const beamGeo = new THREE.BoxGeometry(archW + 1, 2, archD);
          const beam = new THREE.Mesh(beamGeo, stoneDarkMat);
          beam.position.set(pos.x, pos.y + archH + 1, pos.z);
          beam.rotation.y = angle;
          beam.castShadow = true;
          this._add(beam);

          // Decorative pointed arch (Azerbaijani style)
          const pointGeo = new THREE.ConeGeometry(3, 4, 4);
          const pointArch = new THREE.Mesh(pointGeo, stoneMat);
          pointArch.position.set(pos.x, pos.y + archH + 3, pos.z);
          pointArch.rotation.y = angle + Math.PI / 4;
          pointArch.castShadow = true;
          this._add(pointArch);
        }
      }
    }

    // ============================================================
    // 2. FLAME TOWERS - Three iconic triangular towers
    //    Placed on one side of the circuit as landmark
    // ============================================================
    {
      const flamePositions = [
        { t: 0.15, dist: 35, side: 1 },
        { t: 0.18, dist: 38, side: 1 },
        { t: 0.21, dist: 33, side: 1 },
      ];

      const flameHeights = [28, 32, 26];
      const flameColors = [0xff3300, 0xff6600, 0xff4400];

      for (let i = 0; i < flamePositions.length; i++) {
        const fp = flamePositions[i];
        const { pos, angle } = safeOffset(fp.t, fp.dist, fp.side);
        if (!isSafe(pos.x, pos.z, 6)) continue;

        const h = flameHeights[i];
        // Triangular tower body (flame shape)
        const towerGeo = new THREE.ConeGeometry(5, h, 3);
        const towerMat = new THREE.MeshStandardMaterial({
          color: 0x334455,
          roughness: 0.2,
          metalness: 0.7
        });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.set(pos.x, pos.y + h / 2, pos.z);
        tower.rotation.y = angle + Math.PI / 6;
        tower.castShadow = true;
        tower.receiveShadow = true;
        this._add(tower);

        // LED facade glow (flame-colored emissive panels)
        const glowGeo = new THREE.PlaneGeometry(6, h * 0.7);
        const glowMat = new THREE.MeshStandardMaterial({
          color: flameColors[i],
          emissive: flameColors[i],
          emissiveIntensity: 0.8,
          roughness: 0.1,
          metalness: 0.5,
          side: THREE.DoubleSide
        });
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const faceDir = new THREE.Vector3(sinA, 0, cosA);
        const glow1 = new THREE.Mesh(glowGeo, glowMat);
        glow1.position.set(
          pos.x + faceDir.x * 3,
          pos.y + h * 0.5,
          pos.z + faceDir.z * 3
        );
        glow1.rotation.y = angle;
        this._add(glow1);

        const glow2 = new THREE.Mesh(glowGeo, glowMat);
        glow2.position.set(
          pos.x - faceDir.x * 3,
          pos.y + h * 0.5,
          pos.z - faceDir.z * 3
        );
        glow2.rotation.y = angle + Math.PI;
        this._add(glow2);
      }
    }

    // ============================================================
    // 3. MODERN GLASS SKYSCRAPERS - Baku's contemporary skyline
    // ============================================================
    {
      const buildingDefs = [
        { name: 'SOCAR Tower', w: 12, h: 24, d: 10, glassColor: 0x00aacc },
        { name: 'Azure Tower', w: 10, h: 20, d: 8, glassColor: 0x0088dd },
        { name: 'Park Boulevard', w: 14, h: 16, d: 12, glassColor: 0x22aadd },
        { name: 'Baku Crystal Hall', w: 16, h: 14, d: 14, glassColor: 0x44ccff },
        { name: 'Port Baku', w: 11, h: 22, d: 9, glassColor: 0x00bbff },
        { name: 'Hilton Baku', w: 13, h: 18, d: 10, glassColor: 0x1199dd },
        { name: 'Four Seasons', w: 12, h: 20, d: 11, glassColor: 0x33aadd },
        { name: 'JW Marriott', w: 10, h: 17, d: 9, glassColor: 0x0099cc },
      ];

      for (let i = 0; i < buildingDefs.length; i++) {
        const bld = buildingDefs[i];
        const t = 0.05 + (i / buildingDefs.length) * 0.9;
        const side = i % 2 === 0 ? -1 : 1;
        const dist = hw + 25 + Math.random() * 15;
        const { pos, angle } = safeOffset(t, dist, side);
        if (!isSafe(pos.x, pos.z, Math.max(bld.w, bld.d) / 2 + 2)) continue;

        // Building body
        const bodyGeo = new THREE.BoxGeometry(bld.w, bld.h, bld.d);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x334455,
          roughness: 0.2,
          metalness: 0.7
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(pos.x, pos.y + bld.h / 2, pos.z);
        body.rotation.y = angle;
        body.castShadow = true;
        body.receiveShadow = true;
        this._add(body);

        // Glass facade panels
        const glassMat = new THREE.MeshStandardMaterial({
          color: bld.glassColor,
          emissive: bld.glassColor,
          emissiveIntensity: 0.3,
          roughness: 0.1,
          metalness: 0.8
        });
        const panelGeo = new THREE.PlaneGeometry(bld.w * 0.85, bld.h * 0.85);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const faceX = sinA, faceZ = cosA;
        const frontPanel = new THREE.Mesh(panelGeo, glassMat);
        frontPanel.position.set(
          pos.x + faceX * (bld.d / 2 + 0.05),
          pos.y + bld.h / 2,
          pos.z + faceZ * (bld.d / 2 + 0.05)
        );
        frontPanel.rotation.y = angle;
        this._add(frontPanel);

        const backPanel = new THREE.Mesh(panelGeo, glassMat);
        backPanel.position.set(
          pos.x - faceX * (bld.d / 2 + 0.05),
          pos.y + bld.h / 2,
          pos.z - faceZ * (bld.d / 2 + 0.05)
        );
        backPanel.rotation.y = angle + Math.PI;
        this._add(backPanel);

        // Crown accent on top
        const crownGeo = new THREE.BoxGeometry(bld.w + 0.5, 1.0, bld.d + 0.5);
        const crownMat = new THREE.MeshStandardMaterial({
          color: 0x00ccdd,
          emissive: 0x00aacc,
          emissiveIntensity: 0.3,
          roughness: 0.2,
          metalness: 0.6
        });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(pos.x, pos.y + bld.h + 0.5, pos.z);
        crown.rotation.y = angle;
        this._add(crown);

        // Lit windows
        const windowMat = new THREE.MeshStandardMaterial({
          color: 0xffeeaa,
          emissive: 0xffeeaa,
          emissiveIntensity: 0.5,
          roughness: 0.2
        });
        const winGeo = new THREE.PlaneGeometry(0.8, 0.6);
        const floors = Math.floor(bld.h / 3);
        const winCols = Math.floor(bld.w / 2.2);
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < winCols; c++) {
            if (Math.random() > 0.7) continue;
            const win = new THREE.Mesh(winGeo, windowMat);
            const localX = (c - winCols / 2 + 0.5) * 2.2;
            win.position.set(
              pos.x + localX * cosA + faceX * (bld.d / 2 + 0.05),
              pos.y + 2 + f * 3,
              pos.z - localX * sinA + faceZ * (bld.d / 2 + 0.05)
            );
            win.rotation.y = angle;
            this._add(win);
          }
        }
      }
    }

    // ============================================================
    // 4. GRANDSTANDS - Along the main straight and key corners
    // ============================================================
    {
      // Main straight grandstand
      placeStand(0.05, hw + 8, 1, 20, 6, 8, 0x222222, 0xcccccc);
      placeStand(0.10, hw + 8, -1, 18, 5, 7, 0x222222, 0xcccccc);
      // Near castle section
      placeStand(0.32, hw + 8, 1, 16, 5, 7, 0x1a3a6a, 0xdddddd);
      placeStand(0.44, hw + 8, -1, 14, 4, 6, 0x1a3a6a, 0xdddddd);
      // End of long straight
      placeStand(0.70, hw + 8, 1, 22, 7, 9, 0x222222, 0xcccccc);
      placeStand(0.75, hw + 8, -1, 20, 6, 8, 0x222222, 0xcccccc);
      // Final sector
      placeStand(0.88, hw + 8, 1, 16, 5, 7, 0x1a3a6a, 0xdddddd);
      placeStand(0.93, hw + 8, -1, 14, 4, 6, 0x1a3a6a, 0xdddddd);
    }

    // ============================================================
    // 5. SPONSOR BOARDS - Azerbaijan GP sponsors
    // ============================================================
    {
      const sponsors = [
        { name: 'BAKU GP', bg: '#0055aa', fg: '#ffffff' },
        { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
        { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
        { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
        { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
        { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
        { name: 'ARAZ', bg: '#cc0000', fg: '#ffffff' },
        { name: 'SOCAR', bg: '#003388', fg: '#ffffff' },
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
    // 6. STREET LAMPS - Along the circuit edges (street circuit feel)
    // ============================================================
    {
      const lampCount = 16;
      for (let i = 0; i < lampCount; i++) {
        const t = (i + 0.5) / lampCount;
        const side = i % 2 === 0 ? 1 : -1;
        const { pos, angle } = safeOffset(t, hw + 5, side);
        if (!isSafe(pos.x, pos.z, 2)) continue;

        // Lamp pole
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 7, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.6 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 3.5, pos.z);
        this._add(pole);

        // Lamp head
        const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xffffee,
          emissive: 0xffffcc,
          emissiveIntensity: 0.8,
          roughness: 0.1
        });
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(pos.x, pos.y + 7.2, pos.z);
        this._add(lamp);

        // Arm extending toward track
        const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 4);
        const arm = new THREE.Mesh(armGeo, poleMat);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        arm.position.set(
          pos.x - cosA * 1.0 * side,
          pos.y + 7,
          pos.z + sinA * 1.0 * side
        );
        arm.rotation.z = Math.PI / 2 * side;
        arm.rotation.y = angle;
        this._add(arm);
      }
    }

    // ============================================================
    // 7. AZERBAIJANI FLAG POLES - National pride decorations
    // ============================================================
    {
      const flagPoles = [
        { t: 0.02, dist: 15, side: 1 },
        { t: 0.12, dist: 16, side: -1 },
        { t: 0.55, dist: 15, side: 1 },
        { t: 0.85, dist: 16, side: -1 },
        { t: 0.95, dist: 14, side: 1 },
      ];

      // Azerbaijan flag colors: blue, red, green
      const flagColors = [0x00b5e2, 0xed2939, 0x3f9c35];

      for (const fp of flagPoles) {
        const { pos, angle } = safeOffset(fp.t, fp.dist, fp.side);
        if (!isSafe(pos.x, pos.z, 2)) continue;

        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 10, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.7 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, pos.y + 5, pos.z);
        this._add(pole);

        // Flag (three horizontal stripes)
        const stripeH = 0.5;
        const flagW = 3;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        for (let s = 0; s < 3; s++) {
          const flagGeo = new THREE.PlaneGeometry(flagW, stripeH);
          const flagMat = new THREE.MeshStandardMaterial({
            color: flagColors[s],
            roughness: 0.6,
            side: THREE.DoubleSide
          });
          const flag = new THREE.Mesh(flagGeo, flagMat);
          flag.position.set(
            pos.x + cosA * flagW / 2,
            pos.y + 9.5 - s * stripeH,
            pos.z - sinA * flagW / 2
          );
          flag.rotation.y = angle;
          this._add(flag);
        }

        // Ball on top of pole
        const ballGeo = new THREE.SphereGeometry(0.2, 6, 6);
        const ballMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
        const ball = new THREE.Mesh(ballGeo, ballMat);
        ball.position.set(pos.x, pos.y + 10.2, pos.z);
        this._add(ball);
      }
    }

    // ============================================================
    // 8. WATERFRONT BARRIERS - Caspian Sea promenade barriers
    // ============================================================
    {
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0x778899, roughness: 0.5, metalness: 0.4 });
      for (let i = 0; i < 12; i++) {
        const t = (i + 0.5) / 12;
        const side = i % 2 === 0 ? 1 : -1;
        const { pos, angle } = safeOffset(t, hw + 3, side);
        if (!isSafe(pos.x, pos.z, 1)) continue;

        const barrierGeo = new THREE.BoxGeometry(6, 1.2, 0.5);
        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(pos.x, pos.y + 0.6, pos.z);
        barrier.rotation.y = angle;
        barrier.castShadow = true;
        this._add(barrier);
      }
    }
  }

  _buildShanghaiScenery() {
    const hw = (this._trackWidth || CONFIG.trackWidth) / 2;

    // ========== 主看台（起点直道旁 t≈0.1）==========
    const t1 = 0.1;
    const p1 = this.spline.getPointAt(t1);
    const tan1 = this.spline.getTangentAt(t1);
    const right1 = new THREE.Vector3(tan1.z, 0, -tan1.x).normalize();
    const ang1 = Math.atan2(tan1.x, tan1.z);
    const standW = 30, standH = 8, standD = 8;
    let standPos = null;
    for (let d = hw + 20; d <= hw + 55; d += 5) {
      const tp = p1.clone().add(right1.clone().multiplyScalar(-d));
      if (this.distToTrack(tp.x, tp.z) >= hw + standW / 2 + 8) { standPos = tp; break; }
    }
    if (standPos) {
      const geo = new THREE.BoxGeometry(standW, standH, standD);
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.2 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(standPos.x, standH / 2 - 2, standPos.z);
      mesh.rotation.y = ang1;
      mesh.castShadow = true; mesh.receiveShadow = true;
      this._add(mesh);
      // UFO顶棚
      const rGeo = new THREE.CylinderGeometry(10, 8, 1, 12);
      const rMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.6 });
      const roof = new THREE.Mesh(rGeo, rMat);
      roof.position.set(standPos.x, standH + 1, standPos.z);
      roof.rotation.y = ang1; roof.scale.set(1.5, 1, 0.8);
      roof.castShadow = true;
      this._add(roof);
      // 红白座位
      const seatC = [0xcc0000, 0xcc0000, 0xffffff];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 10; c++) {
          const sg = new THREE.BoxGeometry(2.2, 0.4, 1);
          const sm = new THREE.MeshStandardMaterial({ color: seatC[(r + c) % 3] });
          const s = new THREE.Mesh(sg, sm);
          const off = new THREE.Vector3(-standW / 2 + 2 + c * 2.8, 0.5 + r * 2, -standD / 2 + 1);
          const ro = off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang1);
          s.position.set(standPos.x + ro.x, standH / 2 - 1.5 + ro.y, standPos.z + ro.z);
          s.rotation.y = ang1;
          this._add(s);
        }
      }
    }

    // ========== 副看台（t≈0.5）==========
    const t2 = 0.5;
    const p2 = this.spline.getPointAt(t2);
    const tan2 = this.spline.getTangentAt(t2);
    const right2 = new THREE.Vector3(tan2.z, 0, -tan2.x).normalize();
    const ang2 = Math.atan2(tan2.x, tan2.z);
    const s2W = 25, s2H = 6, s2D = 6;
    let s2Pos = null;
    for (let d = hw + 18; d <= hw + 50; d += 5) {
      const tp = p2.clone().add(right2.clone().multiplyScalar(d));
      if (this.distToTrack(tp.x, tp.z) >= hw + s2W / 2 + 8) { s2Pos = tp; break; }
    }
    if (s2Pos) {
      const g = new THREE.BoxGeometry(s2W, s2H, s2D);
      const m = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(s2Pos.x, s2H / 2 - 2, s2Pos.z);
      mesh.rotation.y = ang2; mesh.castShadow = true;
      this._add(mesh);
    }

    // ========== 维修区大楼（t≈0.05）==========
    const tP = 0.05;
    const pP = this.spline.getPointAt(tP);
    const tanP = this.spline.getTangentAt(tP);
    const rightP = new THREE.Vector3(tanP.z, 0, -tanP.x).normalize();
    const angP = Math.atan2(tanP.x, tanP.z);
    const pitW = 28, pitH = 5, pitD = 6;
    let pitPos = null;
    for (let d = hw + 18; d <= hw + 50; d += 5) {
      const tp = pP.clone().add(rightP.clone().multiplyScalar(-d));
      if (this.distToTrack(tp.x, tp.z) >= hw + pitW / 2 + 8) { pitPos = tp; break; }
    }
    if (pitPos) {
      const g = new THREE.BoxGeometry(pitW, pitH, pitD);
      const m = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.3 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(pitPos.x, pitH / 2 - 2, pitPos.z);
      mesh.rotation.y = angP; mesh.castShadow = true;
      this._add(mesh);
    }

    // ========== 媒体中心（t≈0.3）==========
    const tM = 0.3;
    const pM = this.spline.getPointAt(tM);
    const tanM = this.spline.getTangentAt(tM);
    const rightM = new THREE.Vector3(tanM.z, 0, -tanM.x).normalize();
    const angM = Math.atan2(tanM.x, tanM.z);
    const mcW = 15, mcH = 8, mcD = 6;
    let mcPos = null;
    for (let d = hw + 18; d <= hw + 50; d += 5) {
      const tp = pM.clone().add(rightM.clone().multiplyScalar(d));
      if (this.distToTrack(tp.x, tp.z) >= hw + mcW / 2 + 8) { mcPos = tp; break; }
    }
    if (mcPos) {
      const g = new THREE.BoxGeometry(mcW, mcH, mcD);
      const m = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.3, metalness: 0.4 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(mcPos.x, mcH / 2 - 2, mcPos.z);
      mesh.rotation.y = angM; mesh.castShadow = true;
      this._add(mesh);
    }

    // ========== F1赞助商广告牌（沿赛道均匀分布）==========
    const sponsors = [
      { name: 'ROLEX', bg: '#006039', fg: '#c0a060' },
      { name: 'HEINEKEN', bg: '#006100', fg: '#ffffff' },
      { name: 'DHL', bg: '#ffcc00', fg: '#cc0000' },
      { name: 'PIRELLI', bg: '#cc0000', fg: '#ffffff' },
      { name: 'AWS', bg: '#232f3e', fg: '#ff9900' },
      { name: 'QATAR', bg: '#7c0053', fg: '#ffffff' },
    ];
    for (let i = 0; i < sponsors.length; i++) {
      const t = (i + 0.5) / sponsors.length;
      const pt = this.spline.getPointAt(t);
      const tg = this.spline.getTangentAt(t);
      const rt = new THREE.Vector3(tg.z, 0, -tg.x).normalize();
      const side = i % 2 === 0 ? 1 : -1;
      const dist = hw + 10 + Math.random() * 4;
      const x = pt.x + rt.x * dist * side;
      const z = pt.z + rt.z * dist * side;
      if (this.distToTrack(x, z) < hw + 6) continue;
      const sp = sponsors[i];
      const pg = new THREE.CylinderGeometry(0.1, 0.1, 3, 6);
      const pm = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7 });
      const post = new THREE.Mesh(pg, pm);
      post.position.set(x, 0, z);
      this._add(post);
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = sp.bg; ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = sp.fg; ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sp.name, 128, 64);
      const tex = new THREE.CanvasTexture(canvas);
      const bg = new THREE.BoxGeometry(6, 3, 0.15);
      const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
      const board = new THREE.Mesh(bg, bm);
      board.position.set(x, 3, z);
      board.rotation.y = Math.atan2(tg.x, tg.z);
      board.castShadow = true;
      this._add(board);
    }
  }

  getStartPositions() {
    const positions = [];
    const startT = this.spline.getPointAt(0);
    // Use spline tangent at t=0 for consistent starting direction
    const tangent = this.spline.getTangentAt(0).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const angle = Math.atan2(tangent.x, tangent.z);

    for (let i = 0; i < 6; i++) {
      const col = (i % 2) === 0 ? -1 : 1;
      const offset = right.clone().multiplyScalar(col * 1.8);
      const back = tangent.clone().multiplyScalar(-i * 5);
      const pos = startT.clone().add(offset).add(back);
      positions.push({ pos, angle });
    }
    return positions;
  }
}
