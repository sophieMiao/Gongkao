module.exports = {
  apps: [
    {
      name: 'gongkao-desktop',
      script: 'dist/main.js',
      watch: false,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
    },
  ],
};
