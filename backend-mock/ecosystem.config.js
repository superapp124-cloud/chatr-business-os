// ─── PM2 Ecosystem File — CHATR Real-Time Cluster ───────────────────────────
//
// Runs multiple Node.js instances on different ports.
// NGINX (nginx.conf) load-balances across them.
//
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   (auto-start on reboot)
//   pm2 monit                 (live dashboard)
//   pm2 logs chatr-realtime   (tail logs)
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  apps: [
    {
      name: 'chatr-realtime-1',
      script: './server-enhanced.js',
      instances: 1,
      exec_mode: 'fork',          // use 'cluster' only if no socket.io-redis adapter
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err-1.log',
      out_file: './logs/out-1.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
    },
    // Uncomment below to add a second instance (requires REDIS_URL to be set)
    // {
    //   name: 'chatr-realtime-2',
    //   script: './server-enhanced.js',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   watch: false,
    //   max_memory_restart: '512M',
    //   env_production: { NODE_ENV: 'production', PORT: 3001 },
    //   error_file: './logs/err-2.log',
    //   out_file: './logs/out-2.log',
    // },
  ],
};
