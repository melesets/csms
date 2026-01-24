module.exports = {
  apps: [{
    name: 'isbar',
    cwd: 'C:\\App file\\ISBAR_4',
    script: 'server/src/index.mjs',
    interpreter: 'node',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      STATIC_DIR: '../dist'
    },
    node_args: '--experimental-modules --es-module-specifier-resolution=node',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    time: true
  }]
};
