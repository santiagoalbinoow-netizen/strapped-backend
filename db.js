import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "caboose.proxy.rlwy.net",
  user: "root",
  password: "sLqMmfVDZzUxuKIosTYTqUozWTMnylCN",
  database: "railway",
  port: 16379,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
