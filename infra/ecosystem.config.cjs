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
        PORT: 3030,
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
