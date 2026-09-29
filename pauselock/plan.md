# PauseLock — Hướng dẫn khóa tạm ngưng hệ thống

Module bọc app bằng màn hình cảnh báo + mật khẩu **trước khi** app chạy (Firebase, API, sync… không khởi tạo sớm).

**Nguyên tắc:** Không sửa logic/chức năng hiện có — chỉ thêm lớp khóa ngoài cùng.

**Mức bảo mật:** Rào cản nhẹ cho người dùng thông thường. Không thay thế xác thực server.

---

## Bộ file

Copy cả thư mục `pauselock/` vào **root** project:

```
pauselock/
  ├── pauselock-core.js   ← hash, session token, rate limit (dùng chung)
  ├── pauselock.js        ← static HTML / ES module (VBMS, v.v.)
  ├── pauselock.jsx       ← React + Vite
  └── plan.md             ← file hướng dẫn này (chỉ dev, không deploy)
```

---

## Checklist triển khai

### Chung (mọi loại app)

- [ ] Copy thư mục `pauselock/` vào root project
- [ ] Tạo `passwordHash` (xem bên dưới) — **không lưu mật khẩu plain text**
- [ ] Đổi `sessionKey` và `sessionSalt` cho từng app
- [ ] Sửa nội dung thông báo (`subtitle`, `title`, `paragraphs`)
- [ ] (Optional) Local-only — không cấu hình Vercel / GitHub deploy
- [ ] Kiểm tra: mở link → khóa → nhập đúng mật khẩu → app bình thường
- [ ] Kiểm tra: F5 cùng tab → không nhập lại; tab mới → nhập lại

### React + Vite

- [ ] Sửa `PAUSE_LOCK_CONFIG` trong `pauselock/pauselock.jsx`
- [ ] Bọc `PauseLockGate` ngoài cùng trong `src/App.jsx`
- [ ] `npm run dev` / `npm run build`

### Static HTML (VBMS, v.v.)

- [ ] Sửa `PAUSE_LOCK_CONFIG` trong `pauselock/pauselock.js`
- [ ] Gọi `await waitForPauseLockUnlock()` **trước** khởi tạo Firebase/API
- [ ] Ẩn màn login/entry ban đầu; `revealAppEntry` sẽ hiện sau khi mở khóa

---

## Bước 1 — Cấu hình `PAUSE_LOCK_CONFIG`

Sửa trong `pauselock.jsx` (React) hoặc `pauselock.js` (static HTML):

| Trường | Bắt buộc | Ghi chú |
|--------|----------|---------|
| `enabled` | Có | `true` = bật, `false` = tắt (không cần gỡ code) |
| `passwordHash` | Có | SHA-256 hex — **không lưu plain text** |
| `sessionSalt` | Có | Salt riêng mỗi app (vd: `myapp_pl_v1`) |
| `sessionKey` | Có | Key `sessionStorage` riêng mỗi app |
| `subtitle` | Có | Dòng phụ header |
| `title` | Có | Tiêu đề chính |
| `paragraphs` | Có | Nội dung thông báo (JSX hoặc HTML string) |
| `passwordHint` | Tùy chọn | Gợi ý dưới form |
| `passwordPlaceholder` | Tùy chọn | Placeholder ô mật khẩu |
| `wrongPasswordMessage` | Tùy chọn | Sai mật khẩu |
| `lockoutMessage` | Tùy chọn | Khóa tạm sau nhiều lần sai (`{seconds}`) |
| `confirmButton` | Tùy chọn | Nút xác nhận |
| `backgroundColor` | Tùy chọn | Màu nền màn khóa |

### Tạo `passwordHash`

```bash
node -e "console.log(require('crypto').createHash('sha256').update('MAT_KHAU_MOI').digest('hex'))"
```

Dán kết quả vào `passwordHash`. **Không commit mật khẩu gốc.**

### Ví dụ nội dung (React / JSX)

```jsx
paragraphs: [
  <>
    Toàn bộ nỗ lực xây dựng và vận hành App hỗ trợ hiện trường đã hoàn tất.
    Phương (TSV) đã chính thức kết thúc công việc tại CMIT vào ngày{" "}
    <strong>22/06/2026</strong>.
  </>,
  <>
    Phía công ty và Bộ phận IT đang có trách nhiệm triển khai, chuẩn bị hạ
    tầng hoặc cung cấp biện pháp thay thế cho anh em để không làm gián đoạn
    công việc.
  </>,
],
```

### Ví dụ nội dung (static HTML / template string)

```js
paragraphs: [
  `Toàn bộ nỗ lực xây dựng... ngày <strong>22/06/2026</strong>.`,
  `Phía công ty và Bộ phận IT đang có trách nhiệm...`,
],
```

---

## Bước 2a — React + Vite (`App.jsx`)

```jsx
import PauseLockGate from "../pauselock/pauselock.jsx";

function App() {
  return (
    <PauseLockGate>
      <ErrorBoundary>
        <LegacyApp />
      </ErrorBoundary>
    </PauseLockGate>
  );
}
```

Đặt `PauseLockGate` **ngoài cùng**. App con không mount cho đến khi mở khóa.

---

## Bước 2b — Static HTML (`VBMS.html`, v.v.)

Trong `<script type="module">`, import và gọi **trước** Firebase/API:

```js
import { waitForPauseLockUnlock } from "./pauselock/pauselock.js";

async function main() {
  await waitForPauseLockUnlock();
  // ... khoi tao Firebase, event listeners, ...
}

document.addEventListener("DOMContentLoaded", main);
```

Ẩn màn entry (login modal) bằng class `hidden` — `waitForPauseLockUnlock` tự hiện lại sau khi mở khóa.

---

## Bước 3 — Kiểm tra

1. Mở link → chỉ thấy bảng cảnh báo + ô mật khẩu
2. Nhập sai 5 lần → khóa tạm 30 giây
3. Nhập đúng → vào app, mọi chức năng như cũ
4. F5 cùng tab → không nhập lại (`sessionStorage` token dẫn xuất)
5. Tab mới → phải nhập lại

---

## Tắt khóa

Trong `pauselock.js` hoặc `pauselock.jsx`:

```js
enabled: false,
```

Không cần gỡ code tích hợp.

---

## Gỡ hoàn toàn

**React:** xóa `<PauseLockGate>`, import, và thư mục `pauselock/`.

**Static HTML:** xóa `import` + `await waitForPauseLockUnlock()`, hiện lại màn entry, xóa thư mục `pauselock/`.

---

## Cơ chế bảo mật (đã vá)

| Tính năng | Mô tả |
|-----------|--------|
| `passwordHash` | Không lưu mật khẩu plain text trong bundle |
| Session token | `sessionStorage` lưu token dẫn xuất, không phải `"1"` |
| Rate limit | 5 lần sai → khóa 30 giây (client-side) |

### Ai vượt được?

| Đối tượng | Khả năng |
|-----------|----------|
| Người dùng thông thường | Rất khó tự lấy mật khẩu |
| Người biết F12 / đọc JS | Có thể bypass (đọc hash + salt, tự tạo token) |
| Cần chặn thật | Dùng Basic Auth / API server — ngoài phạm vi PauseLock |

---

## Yêu cầu kỹ thuật

| Loại app | Yêu cầu |
|----------|---------|
| React + Vite | React 18+, Tailwind CSS, ESM |
| Static HTML | ES module, Tailwind (CDN hoặc build), `crypto.subtle` |
| Phụ thuộc | `react` (chỉ bản `.jsx`) |

---

## Lưu ý Windows — encoding

Lưu file `.jsx` / `.js` dạng **UTF-8** (không UTF-16).  
Lỗi `Unexpected character '\0'` → đổi encoding trong editor và lưu lại.

---

## Mẫu prompt cho AI / dev

> Khóa toàn bộ hệ thống khi mở link: hiện bảng cảnh báo tạm ngưng, bắt nhập mật khẩu (lưu SHA-256 hash, không plain text). Không thay đổi logic app. Dùng module `pauselock/` — React: bọc `PauseLockGate` trong `App.jsx`; static HTML: `await waitForPauseLockUnlock()` trước Firebase. Nội dung: `[NỘI DUNG]`.

---

## Tham chiếu — app đã áp dụng

| Project | Cách tích hợp |
|---------|----------------|
| `vbms` | `VBMS.html` → `await waitForPauseLockUnlock()` |
| `containercheckingcmitapp` | `src/App.jsx` → `<PauseLockGate>` |
