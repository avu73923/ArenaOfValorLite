# Arena of Valor: Lite

Game đấu trường 1v1 phong cách tối giản, chạy hoàn toàn trên trình duyệt bằng HTML/CSS/JavaScript thuần (không cần build tool, không cần thư viện ngoài).

Phá trụ, tránh né, bung skill và hạ gục Nexus của đối thủ trước khi Nexus của bạn bị phá.

## Cấu trúc project

```
ArenaOfValorLite/
├── index.html   # Khung giao diện + HUD
├── style.css    # Giao diện tối giản (nền tối, 1 màu nhấn vàng, phe xanh/đỏ)
├── game.js      # Toàn bộ logic game (entity, AI, combat, skill, render)
└── README.md
```

## Cách chơi thử ngay

Chỉ cần mở `index.html` bằng trình duyệt bất kỳ (Chrome, Edge, Firefox...), không cần server.

### Điều khiển

| Phím | Chức năng |
|---|---|
| `W A S D` | Di chuyển tướng |
| `Space` | Đánh thường (tự nhắm mục tiêu gần nhất trong tầm) |
| `Q` | Lao Tới — dịch chuyển nhanh theo hướng di chuyển |
| `E` | Cầu Lửa — phóng chiêu tầm xa gây sát thương |
| `R` | Khiên — hồi máu + khiên chắn tạm thời |

### Luật chơi

- Mỗi bên có 1 **Nexus** (trụ sở) và 1 **Trụ** bảo vệ phía trước.
- **Trụ** phải bị phá trước, sau đó **Nexus** mới có thể bị tấn công.
- Lính (minion) tự động xuất hiện theo đợt (8 giây/lần) và đi dọc theo làn đường.
- Tướng địch được điều khiển bởi AI đơn giản: sẽ giao tranh khi có mục tiêu trong tầm, rút lui khi máu thấp, và tự đẩy lính khi làn đường trống.
- Thắng khi phá hủy Nexus địch, thua nếu Nexus của bạn bị phá trước.

## Đăng lên GitHub Pages

1. Tạo repo mới trên GitHub, ví dụ đặt tên `ArenaOfValorLite`.
2. Đẩy code lên:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Arena of Valor Lite"
   git branch -M main
   git remote add origin https://github.com/<username>/ArenaOfValorLite.git
   git push -u origin main
   ```
4. Vào **Settings → Pages** trong repo, chọn nhánh `main` và thư mục `/ (root)`, bấm Save.
5. Sau vài phút, game sẽ chạy tại: `https://<username>.github.io/ArenaOfValorLite/`

## Gợi ý mở rộng sau này

- Thêm nhiều tướng với bộ skill khác nhau (chọn tướng ở màn hình bắt đầu).
- Thêm item/trang bị mua bằng vàng kiếm được từ việc hạ lính.
- Thêm chế độ nhiều người chơi qua WebSocket.
- Thêm rừng (jungle) và quái trung lập giữa hai làn.
