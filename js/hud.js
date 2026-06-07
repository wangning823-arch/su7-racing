import { CONFIG } from './config.js?v=2';

export class HUD {
  constructor() {
    this.elPosition = document.getElementById('hud-position');
    this.elLap = document.getElementById('hud-lap');
    this.elTime = document.getElementById('hud-time');
    this.elSpeed = document.getElementById('hud-speed');
    this.elCountdown = document.getElementById('hud-countdown');
    this.elHud = document.getElementById('hud');
  }

  show() { this.elHud.style.display = 'block'; }
  hide() { this.elHud.style.display = 'none'; }

  update(playerKart, raceManager) {
    this.elPosition.textContent = raceManager.getRankText(playerKart);
    this.elLap.textContent = `圈 ${Math.min(playerKart.lap + 1, CONFIG.totalLaps)} / ${CONFIG.totalLaps}`;
    this.elTime.textContent = raceManager.getTimeText(raceManager.raceTime);
    const speed = Math.round(playerKart.physics.speed * 3.6);
    this.elSpeed.textContent = `${speed} km/h`;
  }

  showCountdown(time) {
    if (time > 0.5) {
      this.elCountdown.style.display = 'block';
      this.elCountdown.textContent = Math.ceil(time - 0.5);
      this.elCountdown.style.color = '#e94560';
    } else if (time > 0) {
      this.elCountdown.textContent = 'GO!';
      this.elCountdown.style.color = '#2ecc71';
    } else {
      this.elCountdown.style.display = 'none';
      this.elCountdown.style.color = '#e94560';
    }
  }

  hideCountdown() {
    this.elCountdown.style.display = 'none';
    this.elCountdown.style.color = '#e94560';
  }

  /**
   * 显示完赛提示
   * @param {number} position - 名次
   * @param {string} time - 完赛用时
   */
  showFinished(position, time) {
    const el = document.getElementById('hud-finished');
    el.innerHTML = `🏁 已完赛<br><span style="font-size:0.6em">第 ${position} 名 · ${time}</span>`;
    el.style.display = 'flex';
    setTimeout(() => { el.style.opacity = '1'; }, 10);
  }

  /** 隐藏完赛提示（带淡出动画） */
  hideFinished() {
    const el = document.getElementById('hud-finished');
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }
}
