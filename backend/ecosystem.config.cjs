module.exports = {
  apps: [{
    name: 'isbar',
    script: 'src/index.js',
    interpreter: 'node',
    instances: 2,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
    },
    node_args: '--experimental-modules --es-module-specifier-resolution=node',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    time: true
  }]
};
