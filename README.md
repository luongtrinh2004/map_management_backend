# 🚀 AD Map Management Backend (NestJS + MongoDB)

Hệ thống Backend quản lý dữ liệu bản đồ tập trung phục vụ phát triển và vận hành xe tự hành (Autonomous Driving). Hệ thống hỗ trợ quản lý bản đồ HD Map (Lanelet2 - OSM) và Point Cloud Map (PCD) theo khu vực và phiên bản.

## 📌 Tổng quan dự án (Project Overview)
Dự án cung cấp một API trung tâm để quản lý các phiên bản bản đồ AD. Hệ thống hỗ trợ tổ chức dữ liệu theo **Map Region**, quản lý phiên bản rõ ràng, truy xuất nhanh và hỗ trợ automation trong pipeline AD.

## 🛠 Công nghệ sử dụng (Tech Stack)
- **Framework:** NestJS (v10+)
- **Database:** MongoDB (Mongoose ODM) - Lưu trữ Metadata linh hoạt (Schema-less).
- **Core Services:**
  - **Lanelet Converter:** Chuyển đổi OSM sang GeoJSON để preview.
  - **PCD Optimizer:** Voxel Grid Downsampling giúp xem trước file 3D nặng ngay trên web.
  - **Smart Diff Engine:** Tự động tính toán sự khác biệt giữa các version.
- **File Handling:** Multer (xử lý stream file lớn).
- **Language:** TypeScript (Strict Mode).

## ✅ Tiến độ hiện tại (Phase 1 & 2 Status)

### Phase 1: Upload & Version Management (Hoàn thành 100%)
- [x] **Quản lý Region:** Hỗ trợ tạo và quản lý hàng trăm khu vực địa lý (Phenikaa, ParkCity, Masterise...).
- [x] **Hệ thống Versioning:** Upload bản đồ v1.0, v1.1... với cơ chế rollback và bảo vệ phiên bản.
- [x] **Metadata detail:** Tự động lưu UTM Zone, MGRS, Creator, Coordinate System vào `metadata.json`.
- [x] **API Download:** Cung cấp link tải trực tiếp cho `osm` và `pcd`.
- [x] **AD Pipeline Integration:** API `/api/maps/:code/latest` giúp xe tự hành tự động lấy bản đồ ổn định nhất.

### Phase 2: Preview & Visualization (Hoàn thành 100%)
- [x] **Lanelet Preview API:** Trả về dữ liệu GeoJSON đã được tối ưu cho Frontend.
- [x] **PCD Preview API:** Cung cấp file PCD đã qua Downsampling (Voxel Grid) để load nhẹ trên web.

### Phase 3: Automation & Validation (Đang thực hiện - 30%)
- [x] **Smart Diff:** Tính toán biến động Node/Way (OSM) và Point Count (PCD).
- [ ] **Map Validation:** (Kế hoạch) Kiểm tra lỗi logic lane hở, thiếu centerline.

## 📂 Cấu trúc Lưu trữ (Storage Structure)
```
maps/
├── phenikaa/
│   ├── v1.0/
│   │   ├── lanelet2_map.osm
│   │   ├── pointcloud_map.pcd
│   │   └── metadata.json
├── masterise/
...
```

## 🚀 Hướng dẫn cài đặt & Chạy
1. **Cài đặt dependencies:** `npm install`
2. **Chạy ứng dụng (Dev):** `npm run start:dev` (Mặc định: `http://localhost:6060`)

## 📅 Kế hoạch phát triển (Roadmap)
- [ ] **Cloud Storage:** Tích hợp AWS S3/MinIO để lưu trữ hàng ngàn bản đồ.
- [ ] **Advanced Validation:** Tự động kiểm tra tính hợp lệ của file OSM trước khi Mark Stable.
- [ ] **Authentication:** Bảo mật API bằng JWT/API Key cho xe tự hành.

---
*Phát triển bởi Đội ngũ Mapping System - 2026*
