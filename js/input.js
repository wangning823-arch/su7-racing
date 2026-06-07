export class InputManager {
  constructor() {
    this.keys = {};
    this.touch = { throttle: 0, brake: 0, steer: 0, drift: false };
    this.joystick = null;
    this.isMobile = 'ontouchstart' in window;
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    if (this.isMobile) this.initTouch();
  }

  initTouch() {
    document.getElementById('touch-controls').style.display = 'block';
    const zone = document.getElementById('joystick-zone');
    const driftBtn = document.getElementById('drift-btn');

    if (typeof nipplejs !== 'undefined') {
      this.joystick = nipplejs.create({
        zone: zone,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 120
      });
      // 摇杆控制：左右=转向，上推=油门，下推=刹车
      this.joystick.on('move', (evt, data) => {
        const angle = data.angle ? data.angle.radian : 0;
        const force = Math.min(data.force || 0, 2) / 2;
        const dx = Math.cos(angle) * force;
        const dy = Math.sin(angle) * force;
        this.touch.steer = Math.max(-1, Math.min(1, dx));
        // 向上推=加速，向下推=刹车（死区0.1避免误触）
        if (dy > 0.1) {
          this.touch.throttle = Math.min(1, dy);
          this.touch.brake = 0;
        } else if (dy < -0.1) {
          this.touch.brake = Math.min(1, Math.abs(dy));
          this.touch.throttle = 0;
        } else {
          this.touch.throttle = 0;
          this.touch.brake = 0;
        }
      });
      this.joystick.on('end', () => {
        this.touch.steer = 0;
        this.touch.throttle = 0;
        this.touch.brake = 0;
      });
    }

    driftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touch.drift = true; driftBtn.classList.add('active'); });
    driftBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.touch.drift = false; driftBtn.classList.remove('active'); });
    driftBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); this.touch.drift = false; driftBtn.classList.remove('active'); });
  }

  getInput() {
    const k = this.keys;
    const t = this.touch;
    return {
      throttle: (k['KeyW'] || k['ArrowUp'] || t.throttle > 0.1) ? Math.max(t.throttle, (k['KeyW'] || k['ArrowUp']) ? 1 : 0) : 0,
      brake: (k['KeyS'] || k['ArrowDown'] || t.brake > 0.1) ? Math.max(t.brake, (k['KeyS'] || k['ArrowDown']) ? 1 : 0) : 0,
      steer: (() => {
        let s = 0;
        if (k['KeyA'] || k['ArrowLeft']) s -= 1;
        if (k['KeyD'] || k['ArrowRight']) s += 1;
        if (Math.abs(t.steer) > 0.1) s += t.steer;
        return Math.max(-1, Math.min(1, s));
      })(),
      drift: k['Space'] || t.drift
    };
  }
}
