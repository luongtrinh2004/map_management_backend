# 🚀 AD Map Management Backend (NestJS + MongoDB)

Hệ thống Backend quản lý dữ liệu bản đồ cho xe tự hành (Autonomous Driving), được chuyển đổi từ Python FastAPI sang Node.js NestJS để đạt được sự ổn định, tính mở rộng cao và hiệu năng vượt trội.

## 📌 Tổng quan dự án (Project Overview)
Dự án được xây dựng nhằm cung cấp một API trung tâm để quản lý các phiên bản bản đồ AD (Lanelet2 .osm và Pointcloud .pcd). Hệ thống hỗ trợ tổ chức dữ liệu theo khu vực (Region) và phiên bản (Version), đảm bảo tính toàn vẹn của dữ liệu và khả năng truy xuất nhanh chóng.

## 🛠 Công nghệ sử dụng (Tech Stack)
- **Framework:** NestJS (v10+)
- **Database:** MongoDB (Mongoose ODM)
- **File Handling:** Multer (Multipart/form-data)
- **Language:** TypeScript (Strict Mode)
- **Static Assets:** ServeStatic for Public files (Favicon, Web assets)

## ✅ Các tính năng đã hoàn thành (Achievements)
1.  **Migration Thành Công:** Toàn bộ hệ thống đã được chuyển đổi sang NestJS + MongoDB.
2.  **Quản lý Region:** API CRUD hoàn chỉnh cho các khu vực địa lý.
3.  **Hệ thống Versioning:** Hỗ trợ upload nhiều phiên bản bản đồ khác nhau cho một Region.
4.  **Lưu trữ thông minh:** Dữ liệu file được tổ chức theo cấu trúc chuẩn: `maps/{region_code}/{version_name}/`.
5.  **Tự động tạo Metadata:** Mỗi khi upload thành công, hệ thống tự động sinh file `metadata.json` chứa thông tin chi tiết (utm_zone, mgrs, creator...).
6.  **Hệ thống Download:** API truy xuất file trực tiếp theo Asset Type (OSM/PCD).
7.  **Relative Path Support:** Lưu đường dẫn tương đối trong DB giúp hệ thống linh hoạt khi di chuyển môi trường triển khai.
8.  **Type Safety:** Sửa lỗi gạch đỏ (Lint/TypeScript) 100%, đảm bảo code sạch và ổn định.

## 📂 Cấu trúc Lưu trữ (Storage Structure)
```
maps/
├── phenikaa/
│   ├── v1.0/
│   │   ├── lanelet2_map.osm
│   │   ├── pointcloud_map.pcd
│   │   └── metadata.json
│   └── v1.1/
```

## 🚀 Hướng dẫn cài đặt & Chạy
1.  **Cài đặt dependencies:**
    ```bash
    npm install
    ```
2.  **Chạy ứng dụng (Development):**
    ```bash
    npm run start:dev
    ```
3.  **Build Production:**
    ```bash
    npm run build
    ```
    Ứng dụng mặc định chạy tại: `http://localhost:6060`

## 📅 Mục tiêu sắp tới (Roadmap)
- [ ] **Authentication:** Tích hợp JWT và RBAC (quản lý quyền truy cập theo vai trò).
- [ ] **Cloud Storage:** Hỗ trợ lưu trữ file trên AWS S3 hoặc Google Cloud Storage.
- [ ] **Webhooks:** Thông báo khi có phiên bản bản đồ mới được cập nhật.
- [ ] **Optimization:** Áp dụng caching (Redis) cho các API truy vấn latest map.
- [ ] **Logs Viewer:** Tích hợp ELK Stack hoặc Winston để quản lý logs chuyên sâu.

---
*Phát triển bởi Đội ngũ Mapping System - 2026*
