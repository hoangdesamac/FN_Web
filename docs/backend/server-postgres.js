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


const app = express();

// ===== Trust Proxy =====
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

// ===== CORS =====
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'https://3tdshop.id.vn';
const corsOptions = {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // 👈 thêm PATCH
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
            `SELECT id, email, first_name, last_name, avatar_url, phone, gender, birthday, phone_verified
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
                birthday: birthday,
                phone_verified: row.phone_verified || false
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

        // Lấy thông tin hiện tại
        const checkRes = await pool.query(
            `SELECT phone, phone_verified FROM users WHERE id=$1`,
            [decoded.id]
        );
        if (!checkRes.rows.length) {
            return res.status(404).json({ success: false, error: "User không tồn tại" });
        }

        const { phone: oldPhone, phone_verified } = checkRes.rows[0];

        // ✅ CASE 1: Nếu xoá số (phone null/empty) → update ngay
        if (!phone || phone.trim() === "") {
            const q = `
                UPDATE users
                SET first_name = $1,
                    last_name  = $2,
                    phone      = NULL,
                    gender     = $3,
                    birthday   = $4
                WHERE id = $5
                RETURNING id, email, first_name, last_name, avatar_url, phone, gender, birthday, phone_verified
            `;
            const values = [firstName || null, lastName || null, gender || null, birthday || null, decoded.id];
            const { rows } = await pool.query(q, values);
            const row = rows[0];
            const b = row.birthday ? (row.birthday instanceof Date ? row.birthday.toISOString().slice(0,10) : row.birthday) : null;

            return res.json({
                success: true,
                user: {
                    id: row.id,
                    email: row.email,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    avatar_url: row.avatar_url,
                    phone: row.phone,
                    gender: row.gender,
                    birthday: b,
                    phone_verified: row.phone_verified
                }
            });
        }

        // 🚫 CASE 2: Nếu nhập số mới khác số cũ → yêu cầu xác minh OTP
        if (oldPhone && oldPhone !== phone) {
            return res.status(403).json({
                success: false,
                error: "Vui lòng xác minh số điện thoại mới trước khi cập nhật thông tin."
            });
        }

        // 🚫 CASE 3: Nếu có số nhưng chưa verify → chặn update
        if (oldPhone && phone_verified === false) {
            return res.status(403).json({
                success: false,
                error: "Vui lòng xác minh số điện thoại trước khi cập nhật thông tin."
            });
        }

        // ✅ CASE 4: Update bình thường (không đổi số hoặc đã verify)
        const q = `
            UPDATE users
            SET first_name = $1,
                last_name  = $2,
                phone      = $3,
                gender     = $4,
                birthday   = $5
            WHERE id = $6
                RETURNING id, email, first_name, last_name, avatar_url, phone, gender, birthday, phone_verified
        `;
        const values = [firstName || null, lastName || null, phone, gender || null, birthday || null, decoded.id];
        const { rows } = await pool.query(q, values);
        if (!rows.length) return res.status(404).json({ success: false, error: 'User không tồn tại' });

        const row = rows[0];
        const b = row.birthday ? (row.birthday instanceof Date ? row.birthday.toISOString().slice(0,10) : row.birthday) : null;

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
                birthday: b,
                phone_verified: row.phone_verified
            }
        });

    } catch (err) {
        console.error('PATCH /api/me error:', err);
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
        // Lấy state từ query (ưu tiên) hoặc từ Referer (fallback)
        const state = req.query.state || req.headers.referer || '';
        const url = googleClient.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['openid', 'email', 'profile'],
            state: state ? encodeURIComponent(state) : undefined
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

        // Lấy state (đường url gốc trước khi login)
        let redirectAfterLogin = req.query.state ? decodeURIComponent(req.query.state) : `${FRONTEND_ORIGIN}/index.html`;
        // Thêm ?login=google hoặc &login=google
        if (redirectAfterLogin.includes('?')) {
            redirectAfterLogin += '&login=google';
        } else {
            redirectAfterLogin += '?login=google';
        }
        return res.redirect(redirectAfterLogin);
    } catch (err) {
        console.error('Google callback error:', err);
        return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=failed`);
    }
});

// ===== Facebook OAuth routes =====
app.get('/api/auth/facebook', (req, res) => {
    const redirectUri = process.env.FACEBOOK_CALLBACK_URL;
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const state = req.query.state || req.headers.referer || '';
    const fbAuthUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email,public_profile&state=${encodeURIComponent(state)}`;
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

        // Lấy state (đường url gốc trước khi login)
        let redirectAfterLogin = req.query.state ? decodeURIComponent(req.query.state) : `${FRONTEND_ORIGIN}/index.html`;
        if (redirectAfterLogin.includes('?')) {
            redirectAfterLogin += '&login=facebook';
        } else {
            redirectAfterLogin += '?login=facebook';
        }
        return res.redirect(redirectAfterLogin);
    } catch (err) {
        console.error("Facebook callback error:", err);
        return res.redirect(`${FRONTEND_ORIGIN}/index.html?login=failed`);
    }
});

// ===== OTP Xác minh số điện thoại =====
// Hàm gửi SMS qua Infobip
async function sendSMS(phone, text) {
    try {
        const response = await fetch(`${process.env.INFOBIP_BASE_URL}/sms/2/text/advanced`, {
            method: "POST",
            headers: {
                "Authorization": `App ${process.env.INFOBIP_API_KEY}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                messages: [
                    {
                        destinations: [{ to: phone }],
                        from: "3TDShop",
                        text
                    }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("❌ Infobip error:", data);
            throw new Error("Gửi SMS thất bại");
        }
        console.log("✅ Đã gửi SMS:", data);
        return true;
    } catch (err) {
        console.error("❌ Lỗi gửi SMS:", err.message);
        return false;
    }
}

// Gửi OTP
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ success: false, error: "Thiếu số điện thoại" });

        // Sinh OTP 6 số
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Lưu OTP vào DB (upsert)
        await pool.query(
            `INSERT INTO otp_codes (phone, otp, expires_at)
             VALUES ($1, $2, NOW() + interval '5 minutes')
             ON CONFLICT (phone) DO UPDATE SET otp = $2, expires_at = NOW() + interval '5 minutes'`,
            [phone, otp]
        );

        // Gửi SMS
        const ok = await sendSMS(phone, `Mã xác minh 3TDShop của bạn là: ${otp}. Có hiệu lực 5 phút.`);
        if (!ok) return res.status(500).json({ success: false, error: "Không gửi được SMS" });

        res.json({ success: true, message: "OTP đã gửi qua SMS" });
    } catch (err) {
        console.error("❌ Lỗi gửi OTP:", err);
        res.status(500).json({ success: false, error: "Lỗi server khi gửi OTP" });
    }
});

// Xác minh OTP
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: "Thiếu phone hoặc otp" });
        }

        const { rows } = await pool.query(
            `SELECT * FROM otp_codes WHERE phone=$1 AND otp=$2 AND expires_at > NOW()`,
            [phone, otp]
        );

        if (!rows.length) {
            return res.json({ success: false, error: "OTP không hợp lệ hoặc hết hạn" });
        }

        // ✅ Cập nhật trạng thái user → phone_verified = true
        await pool.query(`UPDATE users SET phone_verified = true WHERE phone=$1`, [phone]);

        // ❌ Xoá OTP đã dùng
        await pool.query(`DELETE FROM otp_codes WHERE phone=$1`, [phone]);

        res.json({ success: true, verified: true });
    } catch (err) {
        console.error("❌ Lỗi verify OTP:", err);
        res.status(500).json({ success: false, error: "Lỗi server khi xác minh OTP" });
    }
});

// Xác minh OTP cho số mới và cập nhật user
app.post('/api/verify-otp-phone-change', async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, error: "Chưa xác thực" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: "Thiếu phone hoặc otp" });
        }

        // Kiểm tra OTP hợp lệ
        const { rows } = await pool.query(
            `SELECT * FROM otp_codes WHERE phone=$1 AND otp=$2 AND expires_at > NOW()`,
            [phone, otp]
        );

        if (!rows.length) {
            return res.json({ success: false, error: "OTP không hợp lệ hoặc hết hạn" });
        }

        // ✅ Nếu OTP đúng → update số mới cho user
        const updateRes = await pool.query(
            `UPDATE users
             SET phone = $1,
                 phone_verified = true
             WHERE id = $2
             RETURNING id, email, first_name, last_name, avatar_url, phone, gender, birthday, phone_verified`,
            [phone, decoded.id]
        );

        // Xoá OTP đã dùng
        await pool.query(`DELETE FROM otp_codes WHERE phone=$1`, [phone]);

        if (!updateRes.rows.length) {
            return res.status(404).json({ success: false, error: "User không tồn tại" });
        }

        const row = updateRes.rows[0];
        const b = row.birthday
            ? (row.birthday instanceof Date ? row.birthday.toISOString().slice(0,10) : row.birthday)
            : null;

        res.json({
            success: true,
            message: "Số điện thoại mới đã được xác minh và cập nhật.",
            user: {
                id: row.id,
                email: row.email,
                firstName: row.first_name,
                lastName: row.last_name,
                avatar_url: row.avatar_url,
                phone: row.phone,
                gender: row.gender,
                birthday: b,
                phone_verified: row.phone_verified
            }
        });
    } catch (err) {
        console.error("❌ Lỗi verify-otp-phone-change:", err);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            try { res.clearCookie(COOKIE_NAME, COOKIE_OPTS); } catch(e) {}
            return res.status(401).json({ success: false, error: 'Chưa xác thực' });
        }
        res.status(500).json({ success: false, error: "Lỗi server khi xác minh OTP số mới" });
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

// ====== Address APIs ======

// Lấy danh sách địa chỉ của user
app.get('/api/addresses', async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, error: "Chưa đăng nhập" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { rows } = await pool.query(
            `SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC`,
            [decoded.id]
        );
        res.json({ success: true, addresses: rows });
    } catch (err) {
        console.error("GET /api/addresses error:", err);
        res.status(500).json({ success: false, error: "Lỗi server" });
    }
});

// Thêm địa chỉ mới
app.post('/api/addresses', async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, error: "Chưa đăng nhập" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { recipient_name, recipient_phone, street_address, ward, city, is_default } = req.body;

        if (!recipient_name || !recipient_phone || !street_address) {
            return res.status(400).json({ success: false, error: "Thiếu dữ liệu bắt buộc" });
        }

        // Nếu is_default = true → reset các địa chỉ khác về false
        if (is_default) {
            await pool.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [decoded.id]);
        }

        const insert = await pool.query(
            `INSERT INTO addresses (user_id, recipient_name, recipient_phone, street_address, ward, city, is_default)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             RETURNING *`,
            [decoded.id, recipient_name, recipient_phone, street_address, ward || null, city || null, is_default || false]
        );

        res.json({ success: true, address: insert.rows[0] });
    } catch (err) {
        console.error("POST /api/addresses error:", err);
        res.status(500).json({ success: false, error: "Lỗi server" });
    }
});

// Cập nhật địa chỉ
app.put('/api/addresses/:id', async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, error: "Chưa đăng nhập" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { id } = req.params;
        const { recipient_name, recipient_phone, street_address, ward, city, is_default } = req.body;

        // Nếu set mặc định thì reset các địa chỉ khác
        if (is_default) {
            await pool.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [decoded.id]);
        }

        const update = await pool.query(
            `UPDATE addresses
             SET recipient_name=$1, recipient_phone=$2, street_address=$3, ward=$4, city=$5, is_default=$6
             WHERE id=$7 AND user_id=$8
             RETURNING *`,
            [recipient_name, recipient_phone, street_address, ward || null, city || null, is_default || false, id, decoded.id]
        );

        if (!update.rows.length) {
            return res.status(404).json({ success: false, error: "Không tìm thấy địa chỉ" });
        }

        res.json({ success: true, address: update.rows[0] });
    } catch (err) {
        console.error("PUT /api/addresses error:", err);
        res.status(500).json({ success: false, error: "Lỗi server" });
    }
});

// Xóa địa chỉ
app.delete('/api/addresses/:id', async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, error: "Chưa đăng nhập" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { id } = req.params;

        const del = await pool.query(
            `DELETE FROM addresses WHERE id=$1 AND user_id=$2 RETURNING *`,
            [id, decoded.id]
        );

        if (!del.rows.length) {
            return res.status(404).json({ success: false, error: "Không tìm thấy địa chỉ" });
        }

        res.json({ success: true, message: "Đã xóa địa chỉ" });
    } catch (err) {
        console.error("DELETE /api/addresses error:", err);
        res.status(500).json({ success: false, error: "Lỗi server" });
    }
});

// ==================== GIFT HELPERS ====================
const fs = require('fs');
const path = require('path');

let GIFT_CACHE = null;

// ENV configs (tinh chỉnh logic quà)
const GIFT_MIN_TOTAL = Number(process.env.GIFT_MIN_TOTAL || 20000000); // 20,000,000
const GIFT_MAX_COUNT = Math.max(1, Number(process.env.GIFT_MAX_COUNT || 5));
const GIFT_MIN_BUDGET = Math.max(0, Number(process.env.GIFT_MIN_BUDGET || 200000)); // sàn ngân sách quà
const GIFT_SORT = (process.env.GIFT_SORT || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'; // 'asc'|'desc'

// Chấp nhận '0.03', '3', hoặc '3%' cho 3%
function parseBudgetPercent(input, def = 0.03) {
    if (input === undefined || input === null) return def;
    let s = String(input).trim();
    if (s.endsWith('%')) s = s.slice(0, -1);
    const n = Number(s);
    if (isNaN(n)) return def;
    return n > 1 ? (n / 100) : n;
}
const GIFT_BUDGET_PERCENT = parseBudgetPercent(process.env.GIFT_BUDGET_PERCENT, 0.03);

async function loadGiftCatalog() {
    if (GIFT_CACHE) return GIFT_CACHE;

    const envPath = process.env.GIFT_CATALOG_PATH ? path.resolve(process.cwd(), process.env.GIFT_CATALOG_PATH) : null;

    const candidates = [
        envPath,
        path.resolve(__dirname, 'pc-part-dataset', 'processed', 'givaAway.json'),
        path.resolve(__dirname, '..', 'pc-part-dataset', 'processed', 'givaAway.json'),
        path.resolve(process.cwd(), 'docs', 'pc-part-dataset', 'processed', 'givaAway.json'),
        path.resolve(process.cwd(), 'pc-part-dataset', 'processed', 'givaAway.json')
    ].filter(Boolean);

    let chosen = null;
    for (const p of candidates) {
        try { if (fs.existsSync(p)) { chosen = p; break; } } catch (_) {}
    }

    try {
        if (!chosen) {
            throw new Error(`Không tìm thấy givaAway.json trong các đường dẫn ứng viên:\n${candidates.join('\n')}`);
        }
        const json = fs.readFileSync(chosen, 'utf-8');
        const raw = JSON.parse(json);

        // Chuẩn hoá dữ liệu và loại bỏ quà không hợp lệ
        GIFT_CACHE = Array.isArray(raw) ? raw
            .map(g => ({
                id: g.id,
                name: g.name,
                image: g.image,
                originalPrice: Number(g.originalPrice) || 0
            }))
            .filter(g => g.id && g.name && g.originalPrice >= 0) : [];

        console.log(`✅ Đã tải gift catalog từ: ${chosen} (items=${GIFT_CACHE.length})`);
    } catch (e) {
        console.error('❌ Không đọc được givaAway.json, fallback rỗng:', e.message);
        GIFT_CACHE = [];
    }
    return GIFT_CACHE;
}

// Tính số lượng quà theo tổng tiền: mốc 20tr → 1 quà, cứ thêm 10tr → +1 quà, tối đa GIFT_MAX_COUNT
function computeGiftCount(total) {
    if (total < GIFT_MIN_TOTAL) return 0;
    const steps = Math.floor((total - GIFT_MIN_TOTAL) / 10000000); // mỗi 10,000,000
    const count = 1 + steps;
    return Math.min(Math.max(count, 1), GIFT_MAX_COUNT);
}

// Ngân sách quà = GIFT_BUDGET_PERCENT * total, nhưng không thấp hơn GIFT_MIN_BUDGET
function computeGiftBudget(total) {
    const pctBudget = Math.floor(total * GIFT_BUDGET_PERCENT);
    return Math.max(pctBudget, GIFT_MIN_BUDGET);
}

// Chọn quà thông minh theo ngân sách + số lượng + hướng sắp xếp giá
function smartPickGifts(catalog, giftCount, total) {
    if (!Array.isArray(catalog) || catalog.length === 0 || giftCount <= 0) return [];

    const budget = computeGiftBudget(total);

    // Sắp xếp theo giá
    const sorted = catalog.slice().sort((a, b) => {
        const pa = Number(a.originalPrice) || 0;
        const pb = Number(b.originalPrice) || 0;
        return GIFT_SORT === 'asc' ? (pa - pb) : (pb - pa);
    });

    const picked = [];
    let spent = 0;

    // Chiến lược: đi theo thứ tự đã sắp xếp, bỏ qua item quá đắt so với ngân sách còn lại
    for (let i = 0; i < sorted.length && picked.length < giftCount; i++) {
        const g = sorted[i];
        const price = g.originalPrice;

        // Ưu tiên chọn trong ngân sách còn lại
        if (spent + price <= budget) {
            picked.push(g);
            spent += price;
        } else {
            // Nếu item này quá đắt, thử tìm item rẻ hơn về sau (khi sort=desc) hoặc đắt hơn về sau (khi sort=asc)
            // để cố gắng nhặt đủ số lượng theo ngân sách
            let foundIdx = -1;
            for (let j = i + 1; j < sorted.length; j++) {
                const cand = sorted[j];
                if (picked.some(p => p.id === cand.id)) continue;
                if (spent + cand.originalPrice <= budget) {
                    foundIdx = j;
                    break;
                }
            }
            if (foundIdx !== -1) {
                const cand = sorted[foundIdx];
                picked.push(cand);
                spent += cand.originalPrice;
                // tiếp tục vòng for với i không đổi để vẫn duyệt được các item còn lại
            }
            // nếu không tìm thấy ứng viên vừa ngân sách, bỏ qua item này và tiếp tục
        }
    }

    // Nếu vẫn chưa đạt giftCount mà đã duyệt hết:
    // - Nếu chưa có quà nào, thử “bất chấp ngân sách”: lấy item rẻ nhất để đảm bảo tối thiểu 1 quà cho đơn >= 20tr
    if (picked.length === 0) {
        const cheapest = sorted.slice().sort((a, b) => (a.originalPrice - b.originalPrice))[0];
        if (cheapest) picked.push(cheapest);
    }

    return picked.slice(0, giftCount).map(g => ({
        id: g.id,
        name: g.name,
        image: g.image,
        originalPrice: Number(g.originalPrice) || 0,
        salePrice: 0,
        discountPercent: 100,
        quantity: 1,
        isGift: true
    }));
}

async function computeGiftsForTotal(total) {
    try {
        const catalog = await loadGiftCatalog();
        const count = computeGiftCount(total);
        if (count <= 0) return [];
        return smartPickGifts(catalog, count, total);
    } catch (err) {
        console.error('computeGiftsForTotal error:', err);
        return [];
    }
}

// [ADD] Single gift: chọn duy nhất 1 quà ổn định và nhân theo số "bộ đầy đủ"
function pickSingleGift(catalog) {
    if (!Array.isArray(catalog) || !catalog.length) return null;
    // Dựa trên cấu hình GIFT_SORT: 'desc' → chọn quà giá cao nhất; 'asc' → rẻ nhất
    const sorted = catalog.slice().sort((a, b) => {
        const pa = Number(a.originalPrice) || 0;
        const pb = Number(b.originalPrice) || 0;
        return GIFT_SORT === 'asc' ? (pa - pb) : (pb - pa);
    });
    return sorted[0] || null;
}

// Tính số "bộ đầy đủ" dựa trên requiredIds: min(quantity của từng id bắt buộc)
function computeFullSetCount(items, requiredIds) {
    if (!Array.isArray(requiredIds) || !requiredIds.length) return 0;
    if (!Array.isArray(items) || !items.length) return 0;

    // map id -> qty
    const qtyMap = new Map();
    items.forEach(it => {
        const id = String(it.id);
        const q = Number(it.quantity) || 0;
        qtyMap.set(id, (qtyMap.get(id) || 0) + q);
    });

    let minSet = Infinity;
    for (const rid of requiredIds.map(String)) {
        const q = qtyMap.get(rid) || 0;
        if (q <= 0) return 0;
        if (q < minSet) minSet = q;
    }
    return Number.isFinite(minSet) ? minSet : 0;
}

// Tính 1 quà duy nhất theo requiredIds (nếu đủ bộ) hoặc theo total -> giftCount (fallback)
async function computeSingleGift({ items, requiredIds, total }) {
    const catalog = await loadGiftCatalog();

    // Case A: Có requiredIds → chỉ cấp quà nếu đủ "bộ đầy đủ"
    if (Array.isArray(requiredIds) && requiredIds.length) {
        const setCount = computeFullSetCount(items || [], requiredIds);
        if (setCount <= 0) return [];
        const g = pickSingleGift(catalog);
        if (!g) return [];
        return [{
            id: g.id, name: g.name, image: g.image,
            originalPrice: Number(g.originalPrice) || 0,
            salePrice: 0, discountPercent: 100,
            quantity: setCount, isGift: true
        }];
    }

    // Case B: Fallback theo tổng tiền → gom tất cả về 1 quà duy nhất và nhân quantity = giftCount
    if (typeof total === 'number') {
        const count = computeGiftCount(total);
        if (count <= 0) return [];
        const g = pickSingleGift(catalog);
        if (!g) return [];
        return [{
            id: g.id, name: g.name, image: g.image,
            originalPrice: Number(g.originalPrice) || 0,
            salePrice: 0, discountPercent: 100,
            quantity: count, isGift: true
        }];
    }

    return [];
}

// [ADD] API: Single-select gift (duy nhất 1 quà)
// body: { items:[{id,quantity}], requiredIds:[...]}  -> ưu tiên requiredIds
//    hoặc { total: number }                          -> fallback theo mốc tiền
app.post('/api/gifts/single-select', async (req, res) => {
    try {
        const body = req.body || {};
        const items = Array.isArray(body.items) ? body.items.map(it => ({
            id: String(it.id),
            quantity: Number(it.quantity) || 0
        })) : [];

        const requiredIds = Array.isArray(body.requiredIds) ? body.requiredIds.map(String) : [];
        const total = (body.total !== undefined) ? Number(body.total) : undefined;

        if ((!requiredIds.length && typeof total !== 'number')) {
            return res.status(400).json({ success: false, error: 'Thiếu requiredIds hoặc total' });
        }

        const gifts = await computeSingleGift({ items, requiredIds, total });
        return res.json({ success: true, gifts });
    } catch (err) {
        console.error('❌ Lỗi POST /api/gifts/single-select:', err);
        return res.status(500).json({ success: false, error: 'Lỗi server single-select' });
    }
});

app.post('/api/gifts/preview', async (req, res) => {
    try {
        const body = req.body || {};
        let total = 0;

        if (Array.isArray(body.items)) {
            const normalized = body.items.map(it => ({
                salePrice: Number(it.salePrice) || 0,
                quantity: Number(it.quantity) || 1
            }));
            total = normalized.reduce((s, it) => s + it.salePrice * it.quantity, 0);
        } else if (body.total !== undefined) {
            total = Number(body.total) || 0;
        } else {
            return res.status(400).json({ success: false, error: 'Thiếu items hoặc total' });
        }

        const gifts = await computeGiftsForTotal(total);
        return res.json({ success: true, total, gifts });
    } catch (err) {
        console.error('❌ Lỗi POST /api/gifts/preview:', err);
        return res.status(500).json({ success: false, error: 'Lỗi server khi preview quà' });
    }
});

// ==================== CART APIS ====================
// GET giỏ hàng
app.get("/api/cart", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT product_id AS id, name, original_price AS "originalPrice",
                    sale_price AS "salePrice", discount_percent AS "discountPercent",
                    image, quantity
             FROM cart_items
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        const cart = result.rows || [];
        const total = cart.reduce((s, it) => s + (Number(it.salePrice) || 0) * (Number(it.quantity) || 0), 0);
        const gifts = await computeGiftsForTotal(total);

        res.json({ success: true, cart, gifts });
    } catch (err) {
        console.error("❌ Lỗi GET /api/cart:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// ADD (hoặc set số lượng) sản phẩm vào giỏ
app.post("/api/cart", authenticateToken, async (req, res) => {
    try {
        const { id, name, originalPrice, salePrice, discountPercent, image, quantity } = req.body;
        if (!id || !name) {
            return res.status(400).json({ success: false, error: "Thiếu dữ liệu sản phẩm" });
        }

        await pool.query(
            `INSERT INTO cart_items (user_id, product_id, name, original_price, sale_price, discount_percent, image, quantity)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 ON CONFLICT (user_id, product_id)
             DO UPDATE SET
                name = EXCLUDED.name,
                                     original_price = EXCLUDED.original_price,
                                     sale_price = EXCLUDED.sale_price,
                                     discount_percent = EXCLUDED.discount_percent,
                                     image = EXCLUDED.image,
                                     quantity = EXCLUDED.quantity,
                                     created_at = NOW()`,
            [req.user.id, id, name, originalPrice, salePrice, discountPercent, image, quantity || 1]
        );

        const cartRes = await pool.query(
            `SELECT product_id AS id, name, original_price AS "originalPrice",
                    sale_price AS "salePrice", discount_percent AS "discountPercent",
                    image, quantity
             FROM cart_items
             WHERE user_id=$1
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        const cart = cartRes.rows || [];
        const total = cart.reduce((s, it) => s + (Number(it.salePrice) || 0) * (Number(it.quantity) || 0), 0);
        const gifts = await computeGiftsForTotal(total);

        res.json({ success: true, cart, gifts });
    } catch (err) {
        console.error("❌ Lỗi POST /api/cart:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});


// UPDATE số lượng tuyệt đối cho 1 sản phẩm
app.put("/api/cart/:productId", authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;
        const userId = req.user.id;
        const productId = req.params.productId;

        if (!quantity || quantity < 1) {
            return res.status(400).json({ success: false, error: "Số lượng không hợp lệ" });
        }

        const update = await pool.query(
            `UPDATE cart_items
             SET quantity=$1
             WHERE user_id=$2 AND product_id=$3
                 RETURNING *`,
            [quantity, userId, productId]
        );

        if (update.rowCount === 0) {
            return res.status(404).json({ success: false, error: "Không tìm thấy sản phẩm trong giỏ" });
        }

        const cartRes = await pool.query(
            `SELECT product_id AS id, name, original_price AS "originalPrice",
                    sale_price AS "salePrice", discount_percent AS "discountPercent",
                    image, quantity
             FROM cart_items
             WHERE user_id=$1
             ORDER BY created_at DESC`,
            [userId]
        );

        const cart = cartRes.rows || [];
        const total = cart.reduce((s, it) => s + (Number(it.salePrice) || 0) * (Number(it.quantity) || 0), 0);
        const gifts = await computeGiftsForTotal(total);

        res.json({ success: true, cart, gifts });
    } catch (err) {
        console.error("❌ Lỗi PUT /api/cart/:id:", err);
        res.status(500).json({ success: false, error: "Lỗi server khi cập nhật số lượng" });
    }
});

// DELETE 1 sản phẩm
app.delete("/api/cart/:productId", authenticateToken, async (req, res) => {
    try {
        await pool.query(
            `DELETE FROM cart_items WHERE user_id=$1 AND product_id=$2`,
            [req.user.id, req.params.productId]
        );

        const cartRes = await pool.query(
            `SELECT product_id AS id, name, original_price AS "originalPrice",
                    sale_price AS "salePrice", discount_percent AS "discountPercent",
                    image, quantity
             FROM cart_items
             WHERE user_id=$1
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        const cart = cartRes.rows || [];
        const total = cart.reduce((s, it) => s + (Number(it.salePrice) || 0) * (Number(it.quantity) || 0), 0);
        const gifts = await computeGiftsForTotal(total);

        res.json({ success: true, cart, gifts });
    } catch (err) {
        console.error("❌ Lỗi DELETE /api/cart/:id:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// CLEAR toàn bộ giỏ
app.delete("/api/cart", authenticateToken, async (req, res) => {
    try {
        await pool.query(`DELETE FROM cart_items WHERE user_id=$1`, [req.user.id]);
        res.json({ success: true, cart: [], gifts: [] });
    } catch (err) {
        console.error("❌ Lỗi DELETE /api/cart:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// BULK DELETE: Xoá nhiều sản phẩm theo danh sách ID
app.post("/api/cart/bulk-delete", authenticateToken, async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: "Danh sách sản phẩm không hợp lệ" });
        }

        await pool.query(
            `DELETE FROM cart_items
             WHERE user_id = $1 AND product_id = ANY($2::text[])`,
            [req.user.id, ids]
        );

        const cartRes = await pool.query(
            `SELECT product_id AS id, name, original_price AS "originalPrice",
                    sale_price AS "salePrice", discount_percent AS "discountPercent",
                    image, quantity
             FROM cart_items
             WHERE user_id=$1
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        const cart = cartRes.rows || [];
        const total = cart.reduce((s, it) => s + (Number(it.salePrice) || 0) * (Number(it.quantity) || 0), 0);
        const gifts = await computeGiftsForTotal(total);

        res.json({ success: true, cart, gifts });
    } catch (err) {
        console.error("❌ Lỗi POST /api/cart/bulk-delete:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// ================== Middleware xác thực JWT ==================
function authenticateToken(req, res, next) {
    const token =
        req.cookies?.[COOKIE_NAME] ||   // 👈 đọc đúng tên cookie "authToken"
        req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token không tồn tại' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Token không hợp lệ' });
        }
        req.user = user;
        next();
    });
}

// ==================== ORDERS APIS ====================

// Sinh mã đơn hàng với định dạng DH-YYYYMMDD-XXXXX
function generateOrderCode() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomPart = "";
    for (let i = 0; i < 5; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `DH-${yyyy}${mm}${dd}-${randomPart}`;
}

// Lấy danh sách đơn hàng của user
app.get("/api/orders", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, order_code AS "orderCode", items, total, status,
                    delivery_info AS "deliveryInfo",
                    payment_method AS "paymentMethod",
                    created_at AS "createdAt", unseen
             FROM orders
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        const orders = result.rows.map(o => ({
            ...o,
            items: typeof o.items === "string" ? JSON.parse(o.items) : o.items,
            deliveryInfo: o.deliveryInfo && typeof o.deliveryInfo === "string"
                ? JSON.parse(o.deliveryInfo)
                : o.deliveryInfo
        }));

        res.json({ success: true, orders });
    } catch (err) {
        console.error("❌ Lỗi GET /api/orders:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// Lấy chi tiết 1 đơn hàng
app.get("/api/orders/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT id, order_code AS "orderCode", items, total, status,
                    delivery_info AS "deliveryInfo",
                    payment_method AS "paymentMethod",
                    created_at AS "createdAt", unseen
             FROM orders
             WHERE id=$1 AND user_id=$2`,
            [id, req.user.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: "Không tìm thấy đơn hàng" });
        }

        // ✅ Đánh dấu đã xem
        await pool.query(
            `UPDATE orders SET unseen=false WHERE id=$1 AND user_id=$2`,
            [id, req.user.id]
        );

        const order = {
            ...result.rows[0],
            items: typeof result.rows[0].items === "string"
                ? JSON.parse(result.rows[0].items)
                : result.rows[0].items,
            deliveryInfo: result.rows[0].deliveryInfo && typeof result.rows[0].deliveryInfo === "string"
                ? JSON.parse(result.rows[0].deliveryInfo)
                : result.rows[0].deliveryInfo,
            unseen: false
        };

        res.json({ success: true, order });
    } catch (err) {
        console.error("❌ Lỗi GET /api/orders/:id:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// Tạo đơn hàng mới (checkout) - Chỉ xoá sản phẩm đã chọn khỏi giỏ
// [CHANGE] POST /api/orders: hỗ trợ "single gift" khi client gửi comboRequiredIds
app.post("/api/orders", authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { items, total, deliveryInfo, paymentMethod, comboRequiredIds } = req.body;

        if (!items || !Array.isArray(items) || !items.length || !total) {
            return res.status(400).json({ success: false, error: "Thiếu dữ liệu đơn hàng" });
        }

        const normalized = items.map(it => ({
            ...it,
            id: String(it.id),
            salePrice: Number(it.salePrice) || 0,
            quantity: Number(it.quantity) || 1
        }));
        const computedTotal = normalized.reduce((s, it) => s + it.salePrice * it.quantity, 0);

        await client.query("BEGIN");

        let orderCode, exists = true;
        while (exists) {
            orderCode = generateOrderCode();
            const check = await client.query("SELECT 1 FROM orders WHERE order_code=$1", [orderCode]);
            exists = check.rows.length > 0;
        }

        // [NEW] Single gift ưu tiên khi có comboRequiredIds đủ bộ; ngược lại fallback computeGiftsForTotal
        let gifts = [];
        const requiredIds = Array.isArray(comboRequiredIds) ? comboRequiredIds.map(String) : [];
        if (requiredIds.length) {
            const single = await computeSingleGift({ items: normalized, requiredIds });
            gifts = Array.isArray(single) ? single : [];
        }
        if (!gifts.length) {
            gifts = await computeGiftsForTotal(computedTotal);
        }

        const orderItems = [...normalized, ...gifts];

        const insert = await client.query(
            `INSERT INTO orders (user_id, order_code, items, total, delivery_info, payment_method, unseen)
             VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, true)
                 RETURNING id, order_code AS "orderCode", items, total, status,
                           delivery_info AS "deliveryInfo",
                           payment_method AS "paymentMethod",
                           created_at AS "createdAt", unseen`,
            [
                req.user.id,
                orderCode,
                JSON.stringify(orderItems),
                computedTotal,
                deliveryInfo ? JSON.stringify(deliveryInfo) : null,
                paymentMethod || null
            ]
        );

        const productIdsToDelete = normalized.filter(it => !it.isGift).map(it => String(it.id));
        if (productIdsToDelete.length) {
            await client.query(
                `DELETE FROM cart_items
                 WHERE user_id=$1 AND product_id = ANY($2::text[])`,
                [req.user.id, productIdsToDelete]
            );
        }

        await client.query("COMMIT");

        const orderRow = insert.rows[0];
        const order = {
            ...orderRow,
            items: typeof orderRow.items === "string" ? JSON.parse(orderRow.items) : orderRow.items,
            deliveryInfo: orderRow.deliveryInfo && typeof orderRow.deliveryInfo === "string"
                ? JSON.parse(orderRow.deliveryInfo)
                : orderRow.deliveryInfo
        };

        res.json({ success: true, order });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Lỗi POST /api/orders:", err);
        res.status(500).json({ success: false, error: "Server error" });
    } finally {
        client.release();
    }
});

// Cập nhật trạng thái đơn
app.patch("/api/orders/:id", authenticateToken, async (req, res) => {
    try {
        const { status, unseen } = req.body;
        const { id } = req.params;

        if (!status && typeof unseen === "undefined") {
            return res.status(400).json({ success: false, error: "Thiếu dữ liệu cập nhật" });
        }

        const update = await pool.query(
            `UPDATE orders
             SET status = COALESCE($1, status),
                 unseen = COALESCE($2, unseen)
             WHERE id=$3 AND user_id=$4
                 RETURNING id, order_code AS "orderCode", items, total, status,
                           delivery_info AS "deliveryInfo",
                           payment_method AS "paymentMethod",
                           created_at AS "createdAt", unseen`,
            [
                status || null,
                typeof unseen !== "undefined" ? unseen : null,
                id,
                req.user.id
            ]
        );

        if (!update.rows.length) {
            return res.status(404).json({ success: false, error: "Không tìm thấy đơn hàng" });
        }

        const order = {
            ...update.rows[0],
            items: typeof update.rows[0].items === "string"
                ? JSON.parse(update.rows[0].items)
                : update.rows[0].items,
            deliveryInfo: update.rows[0].deliveryInfo && typeof update.rows[0].deliveryInfo === "string"
                ? JSON.parse(update.rows[0].deliveryInfo)
                : update.rows[0].deliveryInfo
        };

        res.json({ success: true, order });
    } catch (err) {
        console.error("❌ Lỗi PATCH /api/orders/:id:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// Xóa đơn hàng
app.delete("/api/orders/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const del = await pool.query(
            `DELETE FROM orders WHERE id=$1 AND user_id=$2 RETURNING id`,
            [id, req.user.id]
        );

        if (!del.rows.length) {
            return res.status(404).json({ success: false, error: "Không tìm thấy đơn hàng" });
        }

        res.json({ success: true, message: "Đã xoá đơn hàng" });
    } catch (err) {
        console.error("❌ Lỗi DELETE /api/orders/:id:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// ===== Start =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server chạy port ${PORT}`);
    console.log(`✅ Cho phép origin: ${FRONTEND_ORIGIN}`);
});
