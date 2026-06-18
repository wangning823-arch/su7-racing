import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js?v=4';
import { InputManager } from './input.js?v=4';
import { TrackBuilder } from './track.js?v=4';
import { TRACKS, DEFAULT_THEME } from './tracks.js?v=4';
import { Kart } from './kart.js?v=4';
import { KartRenderer } from './kart-renderer.js?v=4';
import { AIController } from './ai.js?v=4';
import { CameraController } from './camera.js?v=4';
import { RaceManager } from './race.js?v=4';
import { MiniMap } from './minimap.js?v=4';
import { HUD } from './hud.js?v=4';
import { ParticleSystem } from './particles.js?v=4';

export class Game {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.physicsWorld = null;
    this.track = null;
    this.karts = [];
    this.player = null;
    this.aiControllers = [];
    this.cameraController = null;
    this.raceManager = null;
    this.hud = null;
    this.minimap = null;
    this.particles = null;
    this.input = null;
    this.clock = null;
    this.accumulator = 0;
    this.fixedDt = 1 / 60;
    this.running = false;

    // Performance monitoring
    this._fps = 0;
    this._fpsFrames = 0;
    this._fpsLastTime = 0;
  }

  init() {
    // Renderer - maximum quality
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    document.body.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 100, 300);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // Hemisphere light for natural sky/ground color bleed
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d7a28, 0.3);
    this.scene.add(this.hemiLight);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    // High resolution shadow map for crisp shadows
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    // Improve shadow quality - bias to reduce shadow acne
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.sun = sun;
    this.scene.add(sun);
    this.scene.add(sun.target);

    // Physics
    this.physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    this.physicsWorld.defaultContactMaterial.friction = 0.3;

    // Track (built later when user selects a map)
    this.track = new TrackBuilder(this.scene, this.physicsWorld);
    this.selectedTrackId = null;

    // Map selection UI
    this.setupMapSelect();

    // Ground plane removed — postUpdate() handles ground following via spline height

    // Input
    this.input = new InputManager();

    // Camera, HUD, Particles (don't depend on track)
    this.cameraController = new CameraController(this.camera);
    this.hud = new HUD();
    this.particles = new ParticleSystem(this.scene);

    // Karts, AI, Race, MiniMap — created when track is selected
    this.karts = [];
    this.aiControllers = [];
    this.raceManager = null;
    this.minimap = null;

    // Clock
    this.clock = new THREE.Clock();

    // Events
    window.addEventListener('resize', () => this.onResize());
    document.getElementById('startBtn').addEventListener('click', () => {
      // 请求全屏 + 锁定横屏
      this.requestFullscreenAndLandscape();
      this.showMapSelect();
    });
    document.getElementById('restartBtn').addEventListener('click', () => this.showMapSelect());

    // Preload car model
    KartRenderer.preload();
  }

  requestFullscreenAndLandscape() {
    const el = document.documentElement;
    // 请求全屏
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    // 锁定横屏
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }

  startRace() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('map-select').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    this.hud.show();

    // Reset positions
    const startPositions = this.track.getStartPositions();
    for (let i = 0; i < this.karts.length; i++) {
      this.karts[i].reset(startPositions[i].pos, startPositions[i].angle);
    }

    // Reset AI waypoint tracking
    for (let i = 0; i < this.aiControllers.length; i++) {
      this.aiControllers[i].initPosition(startPositions[i + 1].pos);
    }

    this._finishedNotified = false;
    // 立即隐藏完赛提示（不使用淡出动画）
    const finishedEl = document.getElementById('hud-finished');
    finishedEl.style.display = 'none';
    finishedEl.style.opacity = '0';
    this.raceManager.startCountdown();
    this.running = true;
    this.clock.start();
    this.animate();
  }

  /**
   * 启动动画循环
   */
  animate() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame((t) => this._tick(t));
  }

  /** 动画帧回调 - 执行游戏逻辑和渲染 */
  _tick(rafTime) {
    if (!this.running) return;
    this._rafId = requestAnimationFrame((t) => this._tick(t));

    let dt = this.clock.getDelta();
    if (dt > 0.1) dt = 0.1;

    // FPS counting - simple frame counter per second
    this._fpsFrames++;
    const now = performance.now();
    if (this._fpsLastTime === 0) {
      this._fpsLastTime = now;
    } else if (now - this._fpsLastTime >= 1000) {
      this._fps = this._fpsFrames;
      this._fpsFrames = 0;
      this._fpsLastTime = now;
    }
    const displayFps = this._fps;

    // Update race state
    this.raceManager.update(dt);

    // Handle input based on race state
    if (this.raceManager.state === 'RACING') {
      this.hud.hideCountdown();
      // 玩家已完赛后停止接收输入，并显示完赛提示
      let playerInput;
      if (this.player.finished) {
        playerInput = { throttle: 0, brake: 0, steer: 0 };
        if (!this._finishedNotified) {
          this.hud.showFinished(this.player.position, this.raceManager.getTimeText(this.player.finishTime));
          this._finishedNotified = true;
        }
      } else {
        const rawInput = this.input.getInput(this.player.physics.speed);
        playerInput = { ...rawInput, steer: -rawInput.steer };
      }
      const aiInputs = this.aiControllers.map((ai, i) => ai.getInput(this.karts[i + 1], this.karts));

      // Physics loop: apply forces then step each substep
      this.accumulator += dt;
      while (this.accumulator >= this.fixedDt) {
        // Apply forces before each physics step
        this.player.update(playerInput, this.fixedDt);
        for (let i = 0; i < this.aiControllers.length; i++) {
          this.karts[i + 1].update(aiInputs[i], this.fixedDt);
        }
        this.physicsWorld.step(this.fixedDt);
        this.accumulator -= this.fixedDt;
      }

      // Post-physics ground/boundary correction
      for (const kart of this.karts) {
        kart.physics.postUpdate();
      }

      // Drift particles
      if (this.player.physics.isDrifting) {
        const pos = this.player.physics.chassisBody.position;
        this.particles.emitDriftSmoke(new THREE.Vector3(pos.x, pos.y, pos.z));
      }

      // Update checkpoints
      for (const kart of this.karts) {
        this.raceManager.updateCheckpoints(kart);
      }

      // Respawn karts that fell off track
      for (let ki = 0; ki < this.karts.length; ki++) {
        const kart = this.karts[ki];
        if (kart.physics.chassisBody.position.y < -5) {
          const t = kart.physics.currentSplineT || 0;
          const p = this.track.spline.getPointAt(t);
          const tang = this.track.spline.getTangentAt(t);
          const angle = Math.atan2(tang.x, tang.z);
          kart.physics.reset(p, angle);
          // Update AI nearest waypoint after respawn
          if (!kart.isPlayer && this.aiControllers[ki - 1]) {
            this.aiControllers[ki - 1].initPosition(p);
          }
        }
      }

      // Camera
      this.cameraController.update(this.player, dt);

      // Sun follows player
      const pp = this.player.physics.chassisBody.position;
      this.sun.position.set(pp.x + 50, 100, pp.z + 50);
      this.sun.target.position.set(pp.x, 0, pp.z);
      this.sun.target.updateMatrixWorld();
      this.sun.shadow.camera.updateProjectionMatrix();

      // HUD
      this.hud.update(this.player, this.raceManager);
      this.hud.updateFps(displayFps);
      this.minimap.draw(this.karts);

      // Particles
      this.particles.update(dt);

    } else if (this.raceManager.state === 'COUNTDOWN') {
      this.hud.showCountdown(this.raceManager.countdownTime);

      // Physics step (for stability)
      this.accumulator += dt;
      while (this.accumulator >= this.fixedDt) {
        this.physicsWorld.step(this.fixedDt);
        this.accumulator -= this.fixedDt;
      }

      // Keep karts on ground during countdown
      for (const kart of this.karts) {
        kart.physics.postUpdate();
        kart.renderer.update(kart.physics);
      }

      // Camera still works during countdown
      this.cameraController.update(this.player, dt);
      this.hud.updateFps(displayFps);
      this.minimap.draw(this.karts);

    } else if (this.raceManager.state === 'FINISHED') {
      this.showResults();
      this.running = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  showResults() {
    // Stop animation loop
    if (this._rafId) cancelAnimationFrame(this._rafId);

    this.hud.hide();
    const table = document.getElementById('results-table');
    table.innerHTML = '<tr><th>名次</th><th>选手</th><th>时间</th></tr>';

    const sorted = [...this.karts].sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      return (a.finishTime || 999) - (b.finishTime || 999);
    });

    for (const kart of sorted) {
      const time = kart.finished ? this.raceManager.getTimeText(kart.finishTime) : '未完赛';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>#${kart.position}</td><td style="color:#${kart.color.toString(16).padStart(6, '0')}">${kart.name}</td><td>${time}</td>`;
      table.appendChild(tr);
    }

    document.getElementById('results').style.display = 'flex';
  }

  setupMapSelect() {
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';
    for (const track of TRACKS) {
      const card = document.createElement('div');
      card.className = 'map-card';
      card.dataset.trackId = track.id;

      const diffClass = { easy: 'diff-easy', medium: 'diff-medium', hard: 'diff-hard' }[track.difficulty];
      const diffLabel = { easy: '简单', medium: '中等', hard: '困难' }[track.difficulty];

      card.innerHTML = `<h3>${track.name}</h3><span class="difficulty ${diffClass}">${diffLabel}</span><canvas width="180" height="120"></canvas>`;

      // Draw track preview on the canvas
      const canvas = card.querySelector('canvas');
      this.drawTrackPreview(canvas, track.points);

      // 点击赛道卡片直接开始比赛（无需确认按钮）
      card.addEventListener('click', () => {
        this.selectedTrackId = track.id;
        this.buildSelectedTrack();
      });

      grid.appendChild(card);
    }

  }

  drawTrackPreview(canvas, points) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    // Find bounds (XZ only)
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, , z] of points) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const scale = Math.min((w - 20) / rangeX, (h - 20) / rangeZ);
    const ox = (w - rangeX * scale) / 2;
    const oz = (h - rangeZ * scale) / 2;

    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= points.length; i++) {
      const [x, , z] = points[i % points.length];
      const sx = ox + (x - minX) * scale;
      const sz = oz + (z - minZ) * scale;
      if (i === 0) ctx.moveTo(sx, sz); else ctx.lineTo(sx, sz);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw start marker
    const [sx, , sz] = points[0];
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(ox + (sx - minX) * scale, oz + (sz - minZ) * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  showMapSelect() {
    this.running = false;
    // Stop animation loop
    if (this._rafId) cancelAnimationFrame(this._rafId);

    document.getElementById('menu').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('map-select').style.display = 'flex';

    // Reset selection
    this.selectedTrackId = null;
    document.querySelectorAll('.map-card').forEach(c => c.classList.remove('selected'));
  }

  applyTheme(theme) {
    this.scene.background = new THREE.Color(theme.sky.color);
    this.scene.fog = new THREE.Fog(theme.sky.color, theme.sky.fogNear, theme.sky.fogFar);

    // Dynamic camera far plane for large tracks (extra for city buildings)
    if (this.camera) {
      const isCity = theme.buildings?.cityStyle;
      this.camera.far = Math.max(500, theme.sky.fogFar + (isCity ? 200 : 100));
      this.camera.updateProjectionMatrix();
    }

    if (this.ambientLight) {
      this.ambientLight.color.set(theme.lighting.ambientColor);
      this.ambientLight.intensity = theme.lighting.ambientIntensity;
    }

    // Update hemisphere light to match theme
    if (this.hemiLight) {
      this.hemiLight.color.set(theme.sky.color);
      // Use ground color from theme if available, otherwise default
      const groundColor = theme.ground?.edgeColor || 0x3d7a28;
      this.hemiLight.groundColor.set(groundColor);
      this.hemiLight.intensity = 0.3;
    }
    if (this.sun) {
      this.sun.color.set(theme.lighting.sunColor);
      this.sun.intensity = theme.lighting.sunIntensity;

      // Dynamic shadow extent for large tracks
      if (theme.shadow?.extent) {
        const ext = theme.shadow.extent;
        this.sun.shadow.camera.left = -ext;
        this.sun.shadow.camera.right = ext;
        this.sun.shadow.camera.top = ext;
        this.sun.shadow.camera.bottom = -ext;
        this.sun.shadow.camera.far = ext * 3;
        this.sun.shadow.camera.updateProjectionMatrix();
      }
    }
  }

  buildSelectedTrack() {
    const trackDef = TRACKS.find(t => t.id === this.selectedTrackId);
    if (!trackDef) return;

    const theme = trackDef.theme || DEFAULT_THEME;
    this.applyTheme(theme);

    // Clear previous track
    this.track.clear();

    // Build the track
    this.track.build(trackDef, theme);

    // Create karts at start positions
    const startPositions = this.track.getStartPositions();
    // Remove old karts from scene
    for (const kart of this.karts) {
      this.scene.remove(kart.renderer.group);
      this.physicsWorld.removeBody(kart.physics.chassisBody);
    }
    this.karts = [];
    this.player = new Kart(this.scene, this.physicsWorld, startPositions[0].pos, startPositions[0].angle, CONFIG.colors[0], 0, true, this.track);
    this.karts.push(this.player);
    this.aiControllers = [];
    for (let i = 0; i < CONFIG.numAI; i++) {
      const kart = new Kart(this.scene, this.physicsWorld, startPositions[i + 1].pos, startPositions[i + 1].angle, CONFIG.colors[i + 1], i + 1, false, this.track);
      this.karts.push(kart);
      const ai = new AIController(i, this.track);
      ai.initPosition(startPositions[i + 1].pos);
      this.aiControllers.push(ai);
    }

    // Setup race manager and minimap
    this.raceManager = new RaceManager();
    this.raceManager.karts = this.karts;
    this.raceManager.track = this.track;
    this.minimap = new MiniMap(document.getElementById('minimap'), this.track);

    this.startRace();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

}
