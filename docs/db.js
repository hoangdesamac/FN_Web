const { MongoClient } = require('mongodb');
const url = 'mongodb+srv://dqdbs06:Tx0XJOnWS4eJsvX6@3tdcluster.lab1tuy.mongodb.net/?retryWrites=true&w=majority&appName=3TDCluster';
const dbName = 'ecommerce';

let db = null;

async function connectToDatabase() {
    try {
        const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        console.log('Kết nối thành công tới MongoDB Atlas');
        db = client.db(dbName);
        return db;
    } catch (error) {
        console.error('Lỗi kết nối:', error);
        throw error;
    }
}

function getDb() {
    if (!db) throw new Error('Chưa kết nối tới database!');
    return db;
}

module.exports = { connectToDatabase, getDb };