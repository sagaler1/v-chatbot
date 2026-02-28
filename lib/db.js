import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',      
  user: 'root',           
  password: '',           
  database: 'ai_chat',    
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4' 
});

export default pool;