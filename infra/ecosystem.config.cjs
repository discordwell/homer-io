module.exports = {
  apps: [
    {
      name: 'homer-api',
      cwd: '/opt/homer-io/packages/api',
      script: 'dist/server.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'homer-worker',
      cwd: '/opt/homer-io/packages/worker',
      script: 'dist/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
