import { PuppeteerEnvironment } from 'jest-environment-puppeteer';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

class CustomPuppeteerEnvironment extends PuppeteerEnvironment {
  async setup() {
    await super.setup();

    // 配置浏览器选项
    this.global.browser = await require('puppeteer').launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,720'
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      }
    });

    this.global.page = await this.global.browser.newPage();

    // 设置页面超时
    this.global.page.setDefaultTimeout(60000);
    this.global.page.setDefaultNavigationTimeout(60000);

    // 监听控制台错误
    this.global.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser Console Error:', msg.text());
      }
    });

    // 监听页面错误
    this.global.page.on('pageerror', error => {
      console.error('Page Error:', error.message);
    });
  }

  async teardown() {
    if (this.global.browser) {
      await this.global.browser.close();
    }
    await super.teardown();
  }
}

export default CustomPuppeteerEnvironment;
