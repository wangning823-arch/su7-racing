export class InputManager {
  constructor() {
    this.keys = {};
    this.touch = { throttle: 0, brake: 0, steer: 0, drift: false };
    this.isMobile = 'ontouchstart' in window;
    this.tiltSupported = false;
    this.tiltSteer = 0; // 重力感应转向值 -1~1
    this.tiltBrake = 0; // 重力感应刹车值 0~1
    this.tiltBeta = 0;  // 当前前后倾斜角度（用于油门判断）
    this._betaBaseline = null;
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    if (this.isMobile) this.initTouch();
  }

  initTouch() {
    document.getElementById('touch-controls').style.display = 'block';
    const driftBtn = document.getElementById('drift-btn');

    // 漂移按钮
    driftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touch.drift = true; driftBtn.classList.add('active'); });
    driftBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.touch.drift = false; driftBtn.classList.remove('active'); });
    driftBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); this.touch.drift = false; driftBtn.classList.remove('active'); });

    // 初始化重力感应
    this.initTilt();

    // 3秒后隐藏操控提示
    const hint = document.getElementById('tilt-hint');
    if (hint) {
      setTimeout(() => { hint.style.opacity = '0'; }, 3000);
    }
  }

  // 获取当前屏幕方向角度
  _getScreenAngle() {
    if (screen.orientation && screen.orientation.angle !== undefined) {
      return screen.orientation.angle;
    }
    return window.orientation || 0;
  }

  initTilt() {
    const handleOrientation = (e) => {
      const gamma = e.gamma; // 设备左右倾斜 -90~90
      const beta = e.beta;  // 设备前后倾斜 -180~180
      if (gamma === null || beta === null) return;
      this.tiltSupported = true;

      // 根据屏幕方向旋转轴映射
      // 横屏时需要把重力轴旋转90°，让操控直觉正确
      const angle = this._getScreenAngle();
      let rawSteer, rawBrake;

      switch (angle) {
        case 90: // 横屏，顶部朝右（常见Android）
          rawSteer = beta;   // 前后倾 → 左右转
          rawBrake = -gamma; // 左右倾 → 刹车
          break;
        case -90: // 横屏，顶部朝左（常见iOS）
        case 270:
          rawSteer = -beta;
          rawBrake = gamma;
          break;
        default: // 竖屏 0°
          rawSteer = gamma;
          rawBrake = beta;
          break;
      }

      // ---- 转向 ----
      const deadzone = 2;
      const maxTilt = 15; // 15度=满转向，更灵敏
      if (Math.abs(rawSteer) < deadzone) {
        this.tiltSteer = 0;
      } else {
        const signed = rawSteer > 0 ? rawSteer - deadzone : rawSteer + deadzone;
        this.tiltSteer = Math.max(-1, Math.min(1, signed / (maxTilt - deadzone)));
      }

      // ---- 刹车（抬手机 = 刹车）----
      // 横屏时 rawBrake 代表"抬手"方向的倾斜量
      this.tiltBeta = rawBrake;
      const brakeThreshold = 45;  // 抬起超过45度开始刹车
      const maxBrakeTilt = 65;    // 65度=全力刹车
      if (rawBrake > brakeThreshold) {
        this.tiltBrake = Math.min(1, (rawBrake - brakeThreshold) / (maxBrakeTilt - brakeThreshold));
      } else {
        this.tiltBrake = 0;
      }
      if (this._betaBaseline === null) this._betaBaseline = rawBrake;
    };

    // iOS 13+ 需要请求权限
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const requestPerm = () => {
        DeviceOrientationEvent.requestPermission().then(state => {
          if (state === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        }).catch(() => {});
        document.removeEventListener('touchstart', requestPerm);
      };
      document.addEventListener('touchstart', requestPerm, { once: true });
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
  }

  getInput(speed = 0) {
    const k = this.keys;
    const t = this.touch;

    // 键盘转向
    let kbSteer = 0;
    if (k['KeyA'] || k['ArrowLeft']) kbSteer -= 1;
    if (k['KeyD'] || k['ArrowRight']) kbSteer += 1;

    // 最终转向值：优先重力感应，其次键盘
    const steer = this.tiltSupported ? this.tiltSteer : kbSteer;
    const absSteer = Math.abs(steer);

    // ---- 智能自动操控（仅手机重力感应生效）----
    let autoThrottle = 1;
    let autoBrake = 0;

    if (this.tiltSupported) {
      // 油门：急转弯才松油（转向>70%才减）
      if (absSteer > 0.7) {
        autoThrottle = 0;
      }

      // 抬手机减速：45°开始减油，65°松油
      if (this.tiltBeta > 45) {
        const tiltThrottle = Math.max(0, 1 - (this.tiltBeta - 45) / 20);
        autoThrottle = Math.min(autoThrottle, tiltThrottle);
      }

      // 刹车：只有抬手机才刹车
      if (this.tiltBrake > 0.05) {
        autoBrake = this.tiltBrake;
        autoThrottle = 0;
      }
    }

    // 键盘优先级高于自动操控
    const kbThrottle = (k['KeyW'] || k['ArrowUp']) ? 1 : 0;
    const kbBrake = (k['KeyS'] || k['ArrowDown']) ? 1 : 0;

    return {
      throttle: kbThrottle || (this.tiltSupported ? autoThrottle : 0),
      brake: kbBrake || (this.tiltSupported ? autoBrake : 0),
      steer: Math.max(-1, Math.min(1, steer)),
      drift: k['Space'] || t.drift
    };
  }
}
