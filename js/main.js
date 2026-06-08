import { Game } from './game.js?v=2';

const game = new Game();
window.game = game;  // 暴露给Puppeteer测试脚本
game.init();
