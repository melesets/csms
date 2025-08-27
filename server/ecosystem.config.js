module.exports = {
  apps: [
    {
      name: "isbar-server",
      script: "src/index.js",
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
        DATABASE_URL: "postgresql://postgres:1954@localhost:1212/ISBAR"
      }
    }
  ]
};
