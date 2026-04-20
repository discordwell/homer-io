module.exports = {
  apps: [
    {
      name: 'homer-api',
      cwd: '/opt/homer-io/packages/api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--env-file=/opt/homer-io/.env',
      env: {
        NODE_ENV: 'production',
        // Canonical API port — must match infra/Caddyfile reverse_proxy and .env.example PORT.
        // See scripts/verify-port-consistency.mjs which guards drift.
        PORT: 3000,
        HOST: '127.0.0.1',
      },
    },
    {
      name: 'homer-worker',
      cwd: '/opt/homer-io/packages/worker',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--env-file=/opt/homer-io/.env',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
