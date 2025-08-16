// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

// Nếu deploy sau proxy (Render/NGINX), nên bật để cookie secure hoạt động mượt
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

// ===== CORS (rất quan trọng cho cookie cross-site) =====
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://3tdshop.id.vn';

const corsOptions = {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));
// Preflight
app.options('*', cors(corsOptions));

// ===== PostgreSQL (Render) =====
const pool = new Pool({
    host: process.env.PGHOST || "dpg-d2fei03e5dus73aku96g-a.oregon-postgres.render.com",
    port: +(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "bwdchampion",
    user: process.env.PGUSER || "bwduser",
    password: process.env.PGPASSWORD || "2Z7DtU7YpoTLUs0mONQeogFHAUelVDNj",
    ssl: { rejectUnauthorized: false }
});

// ===== Utils =====
const COOKIE_NAME = 'authToken';
const COOKIE_OPTS = {
    httpOnly: true,
    secure: true,       // bắt buộc khi dùng HTTPS + cross-site
    sameSite: 'None',   // cho phép gửi cookie cross-site
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
};
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// ====== Health / Debug ======
app.get('/api/test-db', async (_req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS current_time');
        res.json({ ok: true, time: result.rows[0].current_time });
    } catch (err) {
        console.error('DB error:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/api/debug-cookie', (req, res) => {
    res.json({ cookies: req.cookies || {} });
});

// ====== Auth APIs ======

// Đăng ký
app.post('/api/register', async (req, res) => {
    try {
        const { email, firstName, lastName, password } = req.body;

        if (!email || !firstName || !lastName || !password) {
            return res.status(400).json({ success: false, error: 'Thiếu dữ liệu bắt buộc' });
        }

        const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (exists.rows.length) {
            return res.status(400).json({ success: false, error: 'Email đã tồn tại' });
        }

        const hash = await bcrypt.hash(password, 10);
        const q = `INSERT INTO users (email, first_name, last_name, password_hash)
               VALUES ($1,$2,$3,$4)
               RETURNING id, email, first_name, last_name, created_at`;
        const { rows } = await pool.query(q, [email, firstName, lastName, hash]);

        res.json({
            success: true,
            user: {
                id: rows[0].id,
                email: rows[0].email,
                lastName: rows[0].last_name
            }
        });
    } catch (err) {
        console.error('Lỗi đăng ký:', err);
        res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
    }
});

// Đăng nhập
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Thiếu email hoặc mật khẩu' });
        }

        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (!rows.length) {
            return res.status(401).json({ success: false, error: 'Email không tồn tại' });
        }

        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ success: false, error: 'Mật khẩu sai' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, lastName: user.last_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

        // 🔴 Quan trọng: trả về user để frontend dùng ngay (tránh lỗi data.user undefined)
        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user: { id: user.id, email: user.email, lastName: user.last_name }
        });
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);
        res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
    }
});

// Lấy thông tin user theo cookie
app.get('/api/me', (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.json({ loggedIn: false });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({
            loggedIn: true,
            user: { id: decoded.id, email: decoded.email, lastName: decoded.lastName }
        });
    } catch (_e) {
        res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
        res.json({ loggedIn: false });
    }
});

// Đăng xuất
app.post('/api/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
    res.json({ success: true });
});

// ===== Start =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server chạy port ${PORT}`);
    console.log(`✅ Cho phép origin: ${FRONTEND_ORIGIN}`);
});
