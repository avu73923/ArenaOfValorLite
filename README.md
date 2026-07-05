# Arena of Valor: Lite — Bản 3D

Phiên bản 3D của game, dùng [Three.js](https://threejs.org/) (tải qua CDN, không cần cài đặt hay build tool gì thêm). Camera góc chéo trên xuống cố định theo phong cách Liên Quân / LOL, luôn bám theo tướng của bạn. Nhân vật là mô hình người đơn giản (đầu, thân, tay, chân) dựng từ khối hình học cơ bản — không dùng texture phức tạp, giữ đúng phong cách tối giản.

## Cấu trúc project

```
ArenaOfValorLite-3D/
├── index.html    # Khung giao diện + HUD + minimap
├── style.css     # Giao diện tối giản
├── game.js       # Toàn bộ LOGIC game (entity, AI, combat, skill) — không đụng tới Three.js
├── scene3d.js    # Toàn bộ RENDER 3D (model, ánh sáng, camera) — đọc dữ liệu từ game.js
└── README.md
```

Tách riêng hoàn toàn logic (`game.js`) và render (`scene3d.js`) để sau này dễ đổi sang render engine khác nếu muốn, mà không phải viết lại luật chơi.

## Cách chơi thử ngay

Mở `index.html` bằng trình duyệt (cần có kết nối mạng vì Three.js và font được tải qua CDN). Không cần server, không cần cài gì thêm.

### Điều khiển

| Phím | Chức năng |
|---|---|
| `W A S D` | Di chuyển tướng |
| `Space` | Đánh thường (tự nhắm mục tiêu gần nhất trong tầm) |
| `Q` | Lao Tới — dịch chuyển nhanh theo hướng đang di chuyển |
| `E` | Cầu Lửa — phóng chiêu tầm xa gây sát thương |
| `R` | Khiên — hồi máu + khiên chắn tạm thời |

Góc nhìn 3D chỉ hiển thị khu vực quanh tướng của bạn, nên có thêm **minimap** ở góc trên bên phải màn hình để theo dõi toàn bộ trận đấu (lính, trụ, Nexus, vị trí tướng địch).

### Luật chơi

- Mỗi bên có 1 **Nexus** (khối pha lê) và 1 **Trụ** (tháp đá) bảo vệ phía trước.
- **Trụ** phải bị phá trước, sau đó **Nexus** mới có thể bị tấn công.
- Lính (minion) tự động xuất hiện theo đợt (8 giây/lần) và đi dọc theo làn đường.
- Tướng địch được điều khiển bởi AI: giao tranh khi có mục tiêu trong tầm, rút lui khi máu thấp, tự đẩy lính khi làn đường trống.
- Thắng khi phá hủy Nexus địch, thua nếu Nexus của bạn bị phá trước.

## Đăng lên GitHub Pages

Cách làm giống hệt bản 2D trước:

```bash
git init
git add .
git commit -m "3D version: Arena of Valor Lite"
git branch -M main
git remote add origin https://github.com/<username>/ArenaOfValorLite.git
git push -u origin main
```

Sau đó vào **Settings → Pages** trong repo, chọn nhánh `main`, thư mục `/ (root)`, bấm Save. Vì Three.js được nạp qua CDN (`cdnjs.cloudflare.com`), trang vẫn chạy bình thường trên GitHub Pages mà không cần đóng gói thêm gì.

## Ghi chú kỹ thuật

- Model nhân vật dựng thủ công bằng các khối `BoxGeometry`, `CylinderGeometry`, `SphereGeometry` — không có file `.glb`/`.fbx` nào cần tải, nên load rất nhanh.
- Camera dùng `PerspectiveCamera`, luôn giữ nguyên góc nghiêng, chỉ dịch chuyển theo vị trí tướng (giống cơ chế camera của Liên Quân/LOL — người chơi không xoay được camera).
- Không dùng shadow map (đổ bóng) để giữ hiệu năng mượt trên nhiều loại máy; ánh sáng dùng ambient + directional cơ bản.

## Gợi ý mở rộng sau này

- Thêm nhiều tướng với hình dáng/màu sắc và bộ skill khác nhau.
- Thêm hoạt ảnh đi bộ/vung tay thực sự (hiện tại nhân vật trượt theo hướng di chuyển, chưa có animation chân tay).
- Cho phép zoom/xoay camera nhẹ trong giới hạn.
- Thêm rừng (jungle) và quái trung lập giữa hai làn.
