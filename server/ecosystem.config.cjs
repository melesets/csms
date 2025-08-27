module.exports = {
  apps: [
    {
      name: "isbar-server",
      script: "src/index.js",
      instances: 1,
      exec_mode: "cluster",
      wait_ready: true,
      listen_timeout: 90000,
      kill_timeout: 5000,
      // Moved to 5001 to avoid conflict with another app on 4000
      env: {
        NODE_ENV: "production",
        PORT: "5001",
        DATABASE_URL: "postgresql://postgres:1954@localhost:1212/ISBAR"
      }
    }
  ]
};
