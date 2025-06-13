require('dotenv').config({ path: __dirname + '/.env', debug: true }); // Thêm debug
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // Thêm jsonwebtoken

const app = express();
app.use(express.json());

// Cấu hình CORS để chấp nhận nhiều origin (bao gồm cả localhost:63342 và localhost:5500)
const allowedOrigins = ['http://localhost:5500', 'http://localhost:63342'];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Không được phép bởi CORS'));
        }
    },
    credentials: true
}));

// Kiểm tra biến môi trường
console.log('Đường dẫn .env:', __dirname + '/.env');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS);
console.log('JWT_SECRET:', process.env.JWT_SECRET);

// Cấu hình Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('Lỗi cấu hình email:', error);
    } else {
        console.log('Cấu hình email sẵn sàng!');
    }
});

const url = 'mongodb+srv://dqdbs06:Tx0XJOnWS4eJsvX6@3tdcluster.lab1tuy.mongodb.net/?retryWrites=true&w=majority&appName=3TDCluster';
const dbName = 'ecommerce';
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key'; // Lấy từ .env hoặc mặc định

let db;

async function connectToDatabase() {
    const client = new MongoClient(url);
    try {
        await client.connect();
        console.log('Kết nối thành công tới MongoDB Atlas');
        db = client.db(dbName);
    } catch (error) {
        console.error('Lỗi kết nối:', error);
    }
}

connectToDatabase();

// Middleware kiểm tra trạng thái database
app.use((req, res, next) => {
    if (!db) return res.status(503).json({ message: 'Database không sẵn sàng' });
    next();
});

// API để đăng ký người dùng
app.post('/api/register', async (req, res) => {
    const { email, name, password } = req.body;
    console.log('Nhận yêu cầu đăng ký:', { email, name, password });

    try {
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email đã được đăng ký!' });
        }

        const newUser = { email, name, password }; // Lưu ý: Nên hash password
        const result = await db.collection('users').insertOne(newUser);
        console.log('Đã lưu người dùng:', result.insertedId);
        res.status(201).json({ message: 'Đăng ký thành công!', userId: result.insertedId });
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
});

// API để đăng nhập người dùng
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Nhận yêu cầu đăng nhập:', { email, password });

    try {
        const user = await db.collection('users').findOne({ email, password });
        if (user) {
            const { password: _, ...userData } = user;
            const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
            res.status(200).json({ message: 'Đăng nhập thành công!', user: userData, token });
        } else {
            res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
        }
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
});

// API để xác thực token
app.post('/api/verify-token', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Không có token!' });

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Token không hợp lệ!' });
        try {
            const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.id) });
            if (user) {
                const { password: _, ...userData } = user;
                res.json({ user: userData });
            } else {
                res.status(401).json({ message: 'Người dùng không tồn tại!' });
            }
        } catch (error) {
            console.error('Lỗi tìm user:', error);
            res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    });
});

// API để khôi phục mật khẩu (cập nhật để hỗ trợ bất kỳ email nào)
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log('Nhận yêu cầu khôi phục mật khẩu:', { email });

    try {
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Email không tồn tại trong hệ thống!' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // Hết hạn sau 1 giờ

        await db.collection('users').updateOne(
            { email },
            { $set: { resetToken, resetExpires } }
        );
        console.log('Đã tạo reset token:', resetToken);

        const mailOptions = {
            from: process.env.EMAIL_USER, // Gửi từ email đã cấu hình
            to: email, // Gửi đến email người dùng cung cấp
            subject: 'Khôi phục mật khẩu',
            html: `
                <h3>Xin chào,</h3>
                <p>Bạn đã yêu cầu khôi phục mật khẩu. Vui lòng sử dụng mã sau:</p>
                <h2 style="color: #007bff;">${resetToken}</h2>
                <p>Mã này sẽ hết hạn sau 1 giờ. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Đã gửi email khôi phục tới ${email}`);

        res.status(200).json({ message: 'Một mã khôi phục đã được gửi đến email của bạn!' });
    } catch (error) {
        console.error('Lỗi khôi phục mật khẩu:', error);
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
});

// API để đặt lại mật khẩu
app.post('/api/reset-password', async (req, res) => {
    const { email, resetToken, newPassword } = req.body;
    console.log('Nhận yêu cầu đặt lại mật khẩu:', { email, resetToken, newPassword });

    try {
        const user = await db.collection('users').findOne({ email, resetToken });
        if (!user) {
            return res.status(400).json({ message: 'Mã khôi phục không hợp lệ hoặc đã hết hạn!' });
        }

        const now = new Date();
        if (now > user.resetExpires) {
            return res.status(400).json({ message: 'Mã khôi phục đã hết hạn!' });
        }

        await db.collection('users').updateOne(
            { email },
            { $set: { password: newPassword, resetToken: null, resetExpires: null } }
        );
        console.log('Đã cập nhật mật khẩu cho:', email);

        res.status(200).json({ message: 'Mật khẩu đã được đặt lại thành công!' });
    } catch (error) {
        console.error('Lỗi đặt lại mật khẩu:', error);
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
});

// API để đăng xuất (tùy chọn, xóa token nếu cần)
app.post('/api/logout', (req, res) => {
    res.status(200).json({ message: 'Đăng xuất thành công!' });
    // Lưu ý: Client cần xóa cookie thủ công
});

// Xử lý lỗi chung
app.use((err, req, res, next) => {
    console.error('Lỗi không xử lý:', err);
    res.status(500).json({ message: 'Lỗi server nội bộ', error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});

// Xử lý đóng kết nối khi server dừng
process.on('SIGTERM', async () => {
    console.log('Đóng server...');
    if (db) await db.client.close();
    process.exit(0);
});

// Xử lý lỗi không bắt được (nếu có)
process.on('uncaughtException', (err) => {
    console.error('Lỗi không bắt được:', err);
    process.exit(1);
});