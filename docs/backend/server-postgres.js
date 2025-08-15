// server-postgres.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS cho frontend GitHub Pages
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

/* ====== API ĐĂNG KÝ ====== */
app.post('/api/register', async (req, res) => {
    try {
        const { email, firstName, lastName, password } = req.body;

        // Kiểm tra email đã tồn tại chưa
        const checkUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Email đã tồn tại' });
        }

        // Hash mật khẩu
        const hash = await bcrypt.hash(password, 10);

        // Lưu vào DB
        const result = await pool.query(
            `INSERT INTO users (email, first_name, last_name, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, first_name, last_name, created_at`,
            [email, firstName, lastName, hash]
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('Lỗi đăng ký:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ====== API ĐĂNG NHẬP ====== */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Tìm user theo email
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Email không tồn tại' });
        }

        const user = result.rows[0];

        // So sánh mật khẩu
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, error: 'Mật khẩu sai' });
        }

        // Tạo token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        res.json({ success: true, token });
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server đang chạy trên cổng ${PORT}`));
