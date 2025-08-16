# Price Overrides

File: `price-overrides.json`
Mục đích: ghi đè giá mặc định trong `PART_LIBRARY` và cả dữ liệu tải về (nếu trùng id) để phản ánh giá thị trường mới nhất.

## Cách hoạt động
- Khi trang build PC load, script `js_resetbuildPC.js` chạy hàm tự gọi `applyPriceOverrides()`.
- Hàm này tìm file `price-overrides.json` ở các base path: `../pc-part-dataset`, `pc-part-dataset`, `../../pc-part-dataset`.
- Với mỗi phần tử có `id` trùng key trong JSON, thuộc tính:
  - `item._oldPrice` lưu lại giá cũ.
  - `item.price` cập nhật sang giá mới.
- Nếu người dùng đã chọn linh kiện trước đó (localStorage) thì giá tổng sẽ cập nhật lại.

## Cập nhật giá
Chỉ cần sửa `price-overrides.json` và (tùy cache) refresh trang (Ctrl+F5) để áp dụng.

## Thêm sản phẩm mới
1. Đảm bảo mỗi item có `id` duy nhất.
2. Thêm key và giá mới (số nguyên VND) vào `price-overrides.json`.
3. Reload trang.

## Ví dụ
```json
{
  "cpu_7800x3d": 8400000,
  "gpu_4070": 13000000
}
```

## Ghi chú
- Giá nên là số nguyên (VND) không chứa dấu chấm. Hiển thị sẽ tự format.
- Nếu một id không tồn tại, mục đó sẽ bị bỏ qua.
- Có thể mở rộng sau: thêm timestamp hoặc nguồn để hiển thị tooltip.
