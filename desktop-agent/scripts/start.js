// 桌面应用启动脚本
const { spawn } = require('child_process');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

function start() {
  // 编译主进程
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.main.json'], {
    stdio: 'inherit',
    shell: true,
  });

  tsc.on('close', (code) => {
    if (code !== 0) {
      console.error('TypeScript compilation failed');
      process.exit(code);
    }

    // 启动 Vite 开发服务器 (渲染进程)
    const vite = spawn('npx', ['vite'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' },
    });

    vite.on('close', (code) => {
      if (code !== 0) {
        console.error('Vite dev server failed');
        process.exit(code);
      }

      // 启动 Electron
      const electron = spawn('npx', ['electron', '.'], {
        stdio: 'inherit',
        shell: true,
      });

      electron.on('close', (code) => {
        process.exit(code);
      });
    });
  });
}

function build() {
  // 构建生产版本
  const commands = [
    ['npm', ['run', 'build:main']],
    ['npm', ['run', 'build:renderer']],
  ];

  // 顺序执行
  const runNext = (index) => {
    if (index >= commands.length) {
      console.log('Build complete!');
      return;
    }

    const [cmd, args] = commands[index];
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`Build step ${index} failed`);
        process.exit(code);
      }
      runNext(index + 1);
    });
  };

  runNext(0);
}

// 根据命令行参数执行
const command = process.argv[2];

if (command === 'dev') {
  start();
} else if (command === 'build') {
  build();
} else {
  console.log('Usage: npm run dev:desktop [dev|build]');
}
