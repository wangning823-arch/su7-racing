/**
 * 测试服务器
 *
 * 这个脚本用于在本地启动一个简单的HTTP服务器，以便运行自动化测试。
 *
 * 使用方法：
 *   node test/test-server.js
 *
 * 服务器将启动在 http://localhost:3000
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ROOT_DIR = path.join(__dirname, '..');

// MIME类型映射
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// 创建服务器
const server = http.createServer((req, res) => {
  // 解析URL
  let filePath = path.join(ROOT_DIR, req.url === '/' ? 'index.html' : req.url);

  // 安全检查：防止目录遍历
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // 获取文件扩展名
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // 读取文件
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // 文件不存在
        res.writeHead(404);
        res.end('Not Found');
      } else {
        // 服务器错误
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    // 设置响应头
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    // 发送文件内容
    res.end(data);
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${ROOT_DIR}`);
  console.log('');
  console.log('Press Ctrl+C to stop');
});

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
