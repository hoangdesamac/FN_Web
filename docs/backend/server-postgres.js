// server-postgres.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// CORS cho frontend GitHub Page
app.use(cors({
    origin: ['https://3tdshop.id.vn'], // Thay link GitHub Pages của bạn
    credentials: true
}));

// Kết nối PostgreSQL Render
const pool = new Pool({
    host: "dpg-d2fei03e5dus73aku96g-a.oregon-postgres.render.com",
    port: 5432,
    database: "bwdchampion",
    user: "bwduser",
    password: "2Z7DtU7YpoTLUs0mONQeogFHAUelVDNj",
    ssl: { rejectUnauthorized: false }
});

// Route test kết nối DB
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS current_time');
        res.json({
            message: 'Kết nối PostgreSQL OK!',
            time: result.rows[0].current_time
        });
    } catch (error) {
        console.error('Lỗi kết nối PostgreSQL:', error);
        res.status(500).json({
            message: 'Kết nối PostgreSQL thất bại',
            error: error.message
        });
    }
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server đang chạy trên cổng ${PORT}`));
