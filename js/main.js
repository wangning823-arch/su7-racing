import { Game } from './game.js?v=6';

const game = new Game();
window.game = game;  // 暴露给Puppeteer测试脚本
game.init();
