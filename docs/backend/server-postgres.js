const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// CORS cho frontend
app.use(cors({
    origin: ['https://3tdshop.id.vn'], // Thay bằng domain frontend của bạn
    credentials: true // Quan trọng để gửi cookie
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

// Test kết nối DB
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS current_time');
        res.json({ message: 'Kết nối PostgreSQL OK!', time: result.rows[0].current_time });
    } catch (error) {
        console.error('Lỗi kết nối PostgreSQL:', error);
        res.status(500).json({ message: 'Kết nối PostgreSQL thất bại', error: error.message });
    }
});

/* ====== API ĐĂNG KÝ ====== */
app.post('/api/register', async (req, res) => {
    try {
        const { email, firstName, lastName, password } = req.body;

        const checkUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Email đã tồn tại' });
        }

        const hash = await bcrypt.hash(password, 10);

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

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Email không tồn tại' });
        }

        const user = result.rows[0];

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, error: 'Mật khẩu sai' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, lastName: user.last_name },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        // Gửi token qua cookie HTTPOnly
        res.cookie("authToken", token, {
            httpOnly: true,
            secure: true, // bắt buộc nếu dùng HTTPS
            sameSite: "None", // để chạy được cross-site (Render + domain khác)
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
        });

        res.json({ success: true, message: "Đăng nhập thành công" });
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ====== API LẤY THÔNG TIN USER ====== */
app.get('/api/me', async (req, res) => {
    const token = req.cookies.authToken;
    if (!token) {
        return res.json({ loggedIn: false });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        res.json({ loggedIn: true, user: { id: decoded.id, lastName: decoded.lastName, email: decoded.email } });
    } catch (err) {
        res.clearCookie("authToken");
        res.json({ loggedIn: false });
    }
});

/* ====== API ĐĂNG XUẤT ====== */
app.post('/api/logout', (req, res) => {
    res.clearCookie("authToken", {
        httpOnly: true,
        secure: true,
        sameSite: "None"
    });
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server đang chạy trên cổng ${PORT}`));
