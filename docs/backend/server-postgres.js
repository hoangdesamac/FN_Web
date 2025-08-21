require('dotenv').config({ path: '/etc/secrets/.env' });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
// Nếu Node <18, bật dòng dưới và cài node-fetch@2
// const fetch = require('node-fetch');

const app = express();

// ===== Trust Proxy =====
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

// ===== CORS =====
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'https://3tdshop.id.vn';
const corsOptions = {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ===== PostgreSQL (Render) =====
const pool = new Pool({
    host: process.env.PGHOST,
    port: +(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false }
});

// ===== Utils =====
const COOKIE_NAME = 'authToken';
const COOKIE_OPTS = {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
};
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// ===== SendGrid =====
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
async function sendMail(to, subject, htmlContent) {
    try {
        const msg = {
            to,
            from: process.env.SMTP_FROM,
            subject,
            html: htmlContent
        };
        await sgMail.send(msg);
        console.log("✅ Email đã gửi:", subject, "->", to);
    } catch (err) {
        console.error("❌ Lỗi gửi email:", err.response?.body || err.message);
        throw err;
    }
}

// ===== Google OAuth =====
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'https://fn-web.onrender.com';

const googleClient = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${BACKEND_BASE_URL}/api/auth/google/callback`,
});

function setAuthCookie(res, userRow) {
    const token = jwt.sign(
        {
            id: userRow.id,
            email: userRow.email,
            firstName: userRow.first_name || userRow.firstName || null,
            lastName: userRow.last_name || userRow.lastName || null
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
}

// ===== Debug / Health =====
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

// ===== Auth APIs =====

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

        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user: { id: user.id, email: user.email, lastName: user.last_name, avatar_url: user.avatar_url || null }
        });
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);
        res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
    }
});

// Lấy thông tin user theo cookie
app.get('/api/me', async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.json({ loggedIn: false });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Lấy profile đầy đủ từ DB để đảm bảo dữ liệu mới nhất
        const { rows } = await pool.query(
            `SELECT id, email, first_name, last_name, avatar_url, phone, gender, birthday
             FROM users WHERE id = $1`,
            [decoded.id]
        );
        const row = rows[0] || {};

        // birthday có thể là Date hoặc string (PG tùy cấu hình)
        const birthday = row.birthday
            ? (row.birthday instanceof Date ? row.birthday.toISOString().slice(0,10) : row.birthday)
            : null;

        res.json({
            loggedIn: true,
            user: {
                id: row.id || decoded.id,
                email: row.email || decoded.email || null,
                firstName: row.first_name || null,
                lastName: row.last_name || decoded.lastName || null,
                avatar_url: row.avatar_url || null,
                phone: row.phone || null,
                gender: row.gender || null,
                birthday: birthday
            }
        });
    } catch (err) {
        console.error('GET /api/me error:', err);
        // token invalid → clear cookie
        try { res.clearCookie(COOKIE_NAME, COOKIE_OPTS); } catch(e) {}
        return res.json({ loggedIn: false });
    }
});

// ---- ADD this PATCH /api/me endpoint ----
app.patch('/api/me', async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, error: 'Chưa xác thực' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const { firstName, lastName, phone, gender, birthday } = req.body;

        // Optional: bạn có thể validate phone / gender / birthday ở đây
        const q = `
            UPDATE users
            SET first_name = $1,
                last_name  = $2,
                phone      = $3,
                gender     = $4,
                birthday   = $5
            WHERE id = $6
            RETURNING id, email, first_name, last_name, avatar_url, phone, gender, birthday
        `;

        const values = [
            firstName || null,
            lastName || null,
            phone || null,
            gender || null,
            birthday || null, // expected format 'YYYY-MM-DD' or null
            decoded.id
        ];

        const { rows } = await pool.query(q, values);
        if (!rows.length) return res.status(404).json({ success: false, error: 'User không tồn tại' });

        const row = rows[0];
        const b = row.birthday ? (row.birthday instanceof Date ? row.birthday.toISOString().slice(0,10) : row.birthday) : null;

        // Trả profile cập nhật
        res.json({
            success: true,
            user: {
                id: row.id,
                email: row.email,
                firstName: row.first_name,
                lastName: row.last_name,
                avatar_url: row.avatar_url,
                phone: row.phone,
                gender: row.gender,
                birthday: b
            }
        });

    } catch (err) {
        console.error('PATCH /api/me error:', err);
        // Nếu token invalid: clear cookie + 401
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            try { res.clearCookie(COOKIE_NAME, COOKIE_OPTS); } catch(e) {}
            return res.status(401).json({ success: false, error: 'Chưa xác thực' });
        }
        res.status(500).json({ success: false, error: 'Lỗi server' });
    }
});

// Đăng xuất
app.post('/api/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
    res.json({ success: true });
});

// ===== Google OAuth routes =====
app.get('/api/auth/google', async (req, res) => {
    try {
        const url = googleClient.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['openid', 'email', 'profile'],
        });
        return res.redirect(url);
    } catch (err) {
        console.error('Google auth start error:', err);
        return res.status(500).send('Google auth init error');
    }
});

app.get('/api/auth/google/callback', async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) return res.status(400).send('Missing code');

        const { tokens } = await googleClient.getToken(code);

        let payload;
        if (tokens.id_token) {
            const ticket = await googleClient.verifyIdToken({
                idToken: tokens.id_token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        } else if (tokens.access_token) {
            const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            payload = await userinfoRes.json();
        } else {
            throw new Error('No id_token or access_token received from Google');
        }

        const profile = {
            id: payload.sub || payload.id,
            email: payload.email,
            verified_email: payload.email_verified,
            name: payload.name,
            given_name: payload.given_name,
            family_name: payload.family_name,
            picture: payload.picture
        };

        if (!profile || !profile.email) {
            return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=failed`);
        }

        let userRow;
        const byGoogle = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
        if (byGoogle.rows.length) {
            userRow = byGoogle.rows[0];
        } else {
            const byEmail = await pool.query('SELECT * FROM users WHERE email = $1', [profile.email]);
            if (byEmail.rows.length) {
                userRow = byEmail.rows[0];
                await pool.query(
                    'UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3',
                    [profile.id, profile.picture || null, userRow.id]
                );
            } else {
                const insert = await pool.query(
                    `INSERT INTO users (email, first_name, last_name, password_hash, google_id, avatar_url)
                     VALUES ($1, $2, $3, $4, $5, $6)
                         RETURNING *`,
                    [
                        profile.email,
                        profile.given_name || '',
                        profile.family_name || '',
                        null,
                        profile.id,
                        profile.picture || null
                    ]
                );
                userRow = insert.rows[0];
            }
        }

        setAuthCookie(res, userRow);

        return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=google`);
    } catch (err) {
        console.error('Google callback error:', err);
        return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=failed`);
    }
});

// ===== Facebook OAuth routes =====
app.get('/api/auth/facebook', (req, res) => {
    const redirectUri = process.env.FACEBOOK_CALLBACK_URL;
    const clientId = process.env.FACEBOOK_CLIENT_ID;

    const fbAuthUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email,public_profile`;
    res.redirect(fbAuthUrl);
});

app.get('/api/auth/facebook/callback', async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) {
            return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=failed`);
        }

        // Đổi code -> access_token
        const tokenRes = await fetch(
            `https://graph.facebook.com/v12.0/oauth/access_token?client_id=${process.env.FACEBOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.FACEBOOK_CALLBACK_URL)}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&code=${code}`
        );
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.error("FB token error:", tokenData);
            return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=failed`);
        }

        // Lấy thông tin user từ Facebook (yêu cầu first_name, last_name, picture)
        const userRes = await fetch(`https://graph.facebook.com/me?fields=id,first_name,last_name,name,email,picture.width(300).height(300)&access_token=${tokenData.access_token}`);
        const fbUser = await userRes.json();

        if (!fbUser || !fbUser.email) {
            console.error("FB user fetch error:", fbUser);
            return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=failed`);
        }

        let userRow;
        // 1) Nếu có facebook_id thì dùng user đó
        const byFb = await pool.query('SELECT * FROM users WHERE facebook_id = $1', [fbUser.id]);
        if (byFb.rows.length) {
            userRow = byFb.rows[0];
        } else {
            // 2) Nếu không có facebook_id, thử tìm theo email
            const byEmail = await pool.query('SELECT * FROM users WHERE email = $1', [fbUser.email]);
            if (byEmail.rows.length) {
                userRow = byEmail.rows[0];
                // chỉ cập nhật facebook_id (không cập nhật avatar để giữ nguyên theo ý bạn)
                await pool.query('UPDATE users SET facebook_id = $1 WHERE id = $2', [fbUser.id, userRow.id]);
            } else {
                // 3) Nếu chưa có user → tạo mới, lưu avatar vào avatar_url
                const insert = await pool.query(
                    `INSERT INTO users (email, first_name, last_name, password_hash, facebook_id, avatar_url)
                     VALUES ($1, $2, $3, $4, $5, $6)
                         RETURNING *`,
                    [
                        fbUser.email,
                        fbUser.first_name || fbUser.name.split(' ')[0] || '',
                        fbUser.last_name || fbUser.name.split(' ').slice(1).join(' ') || '',
                        null,
                        fbUser.id,
                        fbUser.picture?.data?.url || null   // <-- lưu avatar vào avatar_url
                    ]
                );
                userRow = insert.rows[0];
            }
        }

        // Set cookie và redirect
        setAuthCookie(res, userRow);
        return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=facebook`);
    } catch (err) {
        console.error("Facebook callback error:", err);
        return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=failed`);
    }
});



// ===== Quên mật khẩu =====
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, error: "Thiếu email" });

        const { rows } = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        if (!rows.length) {
            return res.json({ success: true, message: "Nếu email tồn tại, bạn sẽ nhận được link reset." });
        }

        const user = rows[0];
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        await pool.query(
            `INSERT INTO reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`,
            [user.id, token, expiresAt]
        );

        const resetLink = `${process.env.FRONTEND_URL}/resetpassword.html?token=${token}`;
        await sendMail(
            user.email,
            "Đặt lại mật khẩu - 3TDShop",
            `<p>Xin chào,</p>
             <p>Bạn đã yêu cầu đặt lại mật khẩu. Nhấn vào link dưới đây để đặt lại:</p>
             <a href="${resetLink}">${resetLink}</a>
             <p>Link có hiệu lực trong 30 phút.</p>`
        );

        res.json({ success: true, message: "Nếu email tồn tại, link reset đã được gửi." });

    } catch (err) {
        console.error("Lỗi forgot-password:", err);
        res.status(500).json({ success: false, error: "Lỗi server" });
    }
});

// ===== Đặt lại mật khẩu =====
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ success: false, error: "Thiếu dữ liệu" });
        }

        const { rows } = await pool.query(
            `SELECT * FROM reset_tokens WHERE token = $1 AND expires_at > NOW()`,
            [token]
        );
        if (!rows.length) {
            return res.status(400).json({ success: false, error: "Token không hợp lệ hoặc đã hết hạn" });
        }

        const reset = rows[0];
        const hash = await bcrypt.hash(newPassword, 10);

        await pool.query(
            `UPDATE users SET password_hash = $1 WHERE id = $2`,
            [hash, reset.user_id]
        );

        await pool.query(`DELETE FROM reset_tokens WHERE token = $1`, [token]);

        res.json({ success: true, message: "Mật khẩu đã được cập nhật!" });

    } catch (err) {
        console.error("Lỗi reset-password:", err);
        res.status(500).json({ success: false, error: "Lỗi server" });
    }
});

// ===== Test gửi email =====
app.get('/api/test-email', async (req, res) => {
    try {
        await sendMail(
            "dqdbs06@gmail.com",
            "Test SendGrid từ 3TDShop",
            "<h1>Xin chào!</h1><p>Đây là email test gửi từ server 3TDShop.</p>"
        );
        res.json({ success: true, message: "Đã gửi email test!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===== Start =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server chạy port ${PORT}`);
    console.log(`✅ Cho phép origin: ${FRONTEND_ORIGIN}`);
});
