const { connectToDatabase } = require('./db.js');

async function main() {
    try {
        const db = await connectToDatabase();
        console.log('Đã kết nối thành công, có thể sử dụng db:', db);
    } catch (error) {
        console.error('Lỗi khi chạy:', error);
    }
}

main();