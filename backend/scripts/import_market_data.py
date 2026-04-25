import os
import sys
import json

"""
HƯỚNG DẪN CHẠY SCRIPT BẰNG DOCKER:

Script này cần truy cập vào DB và các biến môi trường cấu hình trong container.
Nếu bạn đang chạy ứng dụng qua docker-compose, hãy sử dụng lệnh sau:

    docker-compose exec backend python scripts/import_market_data.py

Hoặc nếu muốn truyền dữ liệu từ bên ngoài vào container tạm thời để chạy import:
    
    docker exec -it <tên_container_backend> bash
    # Trong container chạy:
    python scripts/import_market_data.py
"""

# Thêm đường dẫn thư mục backend vào sys.path để có thể import các module của app
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.firebase_init import get_db
from app.services.firestore_service import batch_update_market_prices
from google.cloud.firestore import SERVER_TIMESTAMP, DELETE_FIELD

def import_latest_market_prices(data_dir: str):
    """
    Đọc các file CSV từ thư mục data và cập nhật giá mới nhất vào collection `marketPrices`.
    """
    metadata_path = os.path.join(data_dir, "fund_metadata.json")
    if not os.path.exists(metadata_path):
        print(f"❌ Không tìm thấy file metadata: {metadata_path}")
        return

    with open(metadata_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    prices_map = {}
    print(f"Đang đọc dữ liệu từ {len(metadata)} mã tài sản...")

    for fund in metadata:
        ticker = fund.get("id")
        asset_type = fund.get("type", "fund")
        csv_file = fund.get("csv_file")
        csv_path = os.path.join(data_dir, csv_file)
        
        if not os.path.exists(csv_path):
            print(f"⚠️ Không tìm thấy file data: {csv_path}")
            continue
            
        with open(csv_path, 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
            if len(lines) <= 1:
                continue
            
            # Dòng cuối cùng chứa giá mới nhất
            last_line = lines[-1]
            parts = last_line.split(',')
            
            if len(parts) >= 2:
                date_str, price_str = parts[0], parts[1]
                try:
                    price = float(price_str)
                    prices_map[ticker] = {
                        "symbol": ticker,
                        "price": price,
                        "date": date_str,
                        "source": "VN-Funds-Dashboard",
                        "type": asset_type
                    }
                    print(f"  + {ticker}: {price:,.0f} đ (Ngày: {date_str})")
                except ValueError:
                    print(f"⚠️ Lỗi đọc giá của {ticker} ở dòng: {last_line}")

    if prices_map:
        print(f"\n🚀 Bắt đầu lưu {len(prices_map)} giá trị vào database (collection: marketPrices)...")
        batch_update_market_prices(prices_map)
        print("✅ Đã cập nhật thành công!")
    else:
        print("❌ Không có dữ liệu nào hợp lệ để cập nhật.")


def import_historical_daily_prices(data_dir: str, limit: int = None):
    """
    Tùy chọn: Nhập toàn bộ giá quá khứ vào `system/prices/daily/{date}`.
    Thao tác này sẽ gom nhóm giá trị theo từng ngày và ghi vào DB.
    """
    metadata_path = os.path.join(data_dir, "fund_metadata.json")
    with open(metadata_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    # Dictionary nhóm giá theo ngày: { "2024-01-01": {"DCDS": 80000, "VFF": 20000} }
    daily_prices = {}

    for fund in metadata:
        ticker = fund.get("id")
        csv_path = os.path.join(data_dir, fund.get("csv_file", ""))
        if not os.path.exists(csv_path):
            continue
            
        with open(csv_path, 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
            for line in lines[1:]: # Bỏ dòng header
                parts = line.split(',')
                if len(parts) >= 2:
                    date_str, price_str = parts[0], parts[1]
                    try:
                        price = float(price_str)
                        if date_str not in daily_prices:
                            daily_prices[date_str] = {}
                        daily_prices[date_str][ticker] = price
                    except ValueError:
                        pass

    print(f"Đã gộp dữ liệu thành {len(daily_prices)} ngày lịch sử.")
    
    # Ghi dữ liệu vào DB bằng batch
    db = get_db()
    col_ref = db.collection("system").document("prices").collection("daily")
    batch = db.batch()
    batch_count = 0
    written = 0

    print("🚀 Bắt đầu lưu dữ liệu lịch sử...")
    items_to_save = sorted(daily_prices.items())
    if limit is not None:
        items_to_save = items_to_save[-limit:]
        
    for date_str, prices in items_to_save:
        ref = col_ref.document(date_str)
        batch.set(ref, {
            "date": date_str,
            "prices": prices,
            "source": "VN-Funds-Dashboard",
            "updatedAt": SERVER_TIMESTAMP
        }, merge=True)
        
        batch_count += 1
        written += 1
        
        # Batch của Firestore giới hạn 500 thao tác
        if batch_count >= 400:
            batch.commit()
            batch = db.batch()
            batch_count = 0
            print(f"  ... Đã lưu {written}/{len(daily_prices)} ngày")

    if batch_count > 0:
        batch.commit()
        
    print(f"✅ Hoàn tất! Đã lưu dữ liệu cho {written} ngày vào system/prices/daily.")


def fix_wrong_tickers():
    """
    Sửa lại các mã bị thiếu dấu gạch ngang trong database (ví dụ: VCBFBCF -> VCBF-BCF)
    Cập nhật ở cả collection `marketPrices` và `system/prices/daily`.
    """
    db = get_db()
    
    TICKER_FIX_MAP = {
        "VCBFBCF": "VCBF-BCF",
        "VCBFFIF": "VCBF-FIF",
        "VCBFMGF": "VCBF-MGF",
        "VCBFTBF": "VCBF-TBF"
    }
    
    print("\n🚀 Bắt đầu sửa mã sai trong collection: marketPrices...")
    for old_ticker, new_ticker in TICKER_FIX_MAP.items():
        doc_ref = db.collection("marketPrices").document(old_ticker)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            data["symbol"] = new_ticker
            # Ghi vào doc mới
            db.collection("marketPrices").document(new_ticker).set(data)
            # Xóa doc cũ
            doc_ref.delete()
            print(f"  + Đã sửa marketPrices: {old_ticker} -> {new_ticker}")
        else:
            print(f"  - Không tìm thấy {old_ticker} trong marketPrices")
            
    print("\n🚀 Bắt đầu quét và sửa mã sai trong system/prices/daily...")
    daily_ref = db.collection("system").document("prices").collection("daily")
    docs = daily_ref.stream()
    batch = db.batch()
    batch_count = 0
    updated_count = 0
    
    for doc in docs:
        data = doc.to_dict()
        prices = data.get("prices", {})
        
        updates = {}
        for old_ticker, new_ticker in TICKER_FIX_MAP.items():
            if old_ticker in prices:
                # Dùng dot notation để thêm key mới và xóa key cũ an toàn (Atomic update)
                updates[f"prices.{new_ticker}"] = prices[old_ticker]
                updates[f"prices.{old_ticker}"] = DELETE_FIELD
                
        if updates:
            batch.update(doc.reference, updates)
            batch_count += 1
            updated_count += 1
            
            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0
                print(f"  ... Đã cập nhật {updated_count} ngày")
                
    if batch_count > 0:
        batch.commit()
        
    print(f"✅ Đã sửa xong lịch sử {updated_count} ngày trong system/prices/daily!")


if __name__ == "__main__":
    # get_db() sẽ tự động khởi tạo kết nối đến Firebase khi được gọi
    db = get_db()
    # Khi chạy trong Docker, ta sẽ copy dữ liệu vào thư mục này
    data_directory = r"/app/fund_data"
    
    print("="*50)
    print("TOOL CẬP NHẬT DỮ LIỆU GIÁ THỊ TRƯỜNG")
    print("="*50)
    print("1. Chỉ cập nhật giá mới nhất (marketPrices)")
    print("2. Cập nhật toàn bộ lịch sử (system/prices/daily) - Thao tác lớn!")
    print("3. Cập nhật thử nghiệm 10 ngày gần nhất (Test)")
    print("4. Sửa các mã lỗi (VCBF... -> VCBF-...)")
    print("="*50)
    
    choice = input("Nhập lựa chọn của bạn (1, 2, 3 hoặc 4): ")
    
    if choice == "1":
        import_latest_market_prices(data_directory)
    elif choice == "2":
        confirm = input("Cảnh báo: Nhập lịch sử có thể tiêu tốn nhiều thao tác ghi vào DB. Nhập 'yes' để tiếp tục: ")
        if confirm.lower() == 'yes':
            import_historical_daily_prices(data_directory)
        else:
            print("Đã hủy thao tác.")
    elif choice == "3":
        print("Đang chạy thử nghiệm 10 ngày giao dịch gần nhất...")
        import_historical_daily_prices(data_directory, limit=10)
    elif choice == "4":
        confirm = input("Thao tác này sẽ quét và sửa toàn bộ dữ liệu lịch sử nếu phát hiện sai. Nhập 'yes' để tiếp tục: ")
        if confirm.lower() == 'yes':
            fix_wrong_tickers()
        else:
            print("Đã hủy thao tác.")
    else:
        print("Lựa chọn không hợp lệ.")
