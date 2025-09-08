// Lấy bài báo theo index (số thứ tự trong mảng)
export async function getNewsByIndex(index) {
	const newsArr = await getTechNews();
	if (!Array.isArray(newsArr) || index < 0 || index >= newsArr.length) return null;
	return newsArr[index];
}
// Lấy bài báo theo tiêu đề (title, không phân biệt hoa thường, bỏ khoảng trắng thừa)
export async function getNewsByTitle(title) {
	const newsArr = await getTechNews();
	if (!title) return null;
	const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
	return newsArr.find(n => norm(n.title) === norm(title)) || null;
}
// Hàm lấy dữ liệu tin tức từ news.json (dùng fetch, trả về Promise)
export async function getTechNews() {
	const response = await fetch('/pc-part-dataset/processed/news.json');
	if (!response.ok) throw new Error('Không thể tải news.json');
	return await response.json();
}
