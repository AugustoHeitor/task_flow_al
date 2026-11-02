import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10
});


export default pool;