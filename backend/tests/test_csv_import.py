from app.services.csv_import_service import parse_prices_csv, parse_transactions_csv, transaction_key

LEGACY = '''Dấu thời gian,Loại giao dịch,Tài sản,Mã,Số lượng,Đơn giá nguyên tệ theo loại tài sản,Loại tiền (VNĐ | USDT),"Tỷ giá lúc mua/bán
(loại tiền / VNĐ)",Giá trị bán theo giá vốn,Thành tiền (VNĐ),Lãi/Lỗ VNĐ,Lãi/Lỗ %,Nơi lưu trữ,Ghi chú
14/03/2026 10:00:00,Nạp tiền,Tiền mặt VNĐ,VNĐ,"100.000.000",1,VNĐ,1,,"100.000.000",,,Techcombank,Lương
15/03/2026 10:00:00,Mua,Cổ phiếu,FUEVN100,"1.000","25.000",VNĐ,1,,"25.000.000",,,SSI,"DCA, tháng 3"
16/03/2026 10:00:00,Bán,Cổ phiếu,FUEVN100,200,"26.000",VNĐ,1,"5.000.000","5.200.000","200.000","4,0%",SSI,
18/03/2026 10:00:00,Mua,Tài sản mã hóa,BTC,"0,01","70.000",USDT,"25.500",,"17.850.000",,,Binance,
20/03/2026 10:00:00,Cổ tức,Cổ phiếu,FUEVN100,800,"1.250",VNĐ,1,,"1.000.000",,,SSI,Cổ tức 2025
21/03/2026 10:00:00,Chuyển khoản,Cổ phiếu,ABC,1,1,VNĐ,1,,1,,,,
'''


def test_legacy_google_form_csv():
    result = parse_transactions_csv(LEGACY)
    assert result["numberFormat"] == "vi"
    assert result["columns"]["exchangeRate"].startswith("Tỷ giá")
    assert result["total"] == 6
    valid = result["valid"]
    assert [t["transactionType"] for t in valid] == ["Nạp tiền", "Mua", "Bán", "Mua", "Cổ tức"]

    deposit, buy, sell, btc, dividend = valid
    assert deposit["ticker"] == "" and deposit["totalVND"] == 100_000_000 and deposit["quantity"] == 100_000_000
    assert buy["quantity"] == 1000 and buy["unitPrice"] == 25000 and buy["notes"] == "DCA, tháng 3"
    assert sell["quantity"] == -200 and sell["totalVND"] == 5_200_000 and sell["pnlVND"] == 200_000
    assert btc["quantity"] == 0.01 and btc["currency"] == "USDT" and btc["exchangeRate"] == 25500
    assert dividend["totalVND"] == 1_000_000 and dividend["quantity"] == 800 and dividend["unitPrice"] == 1250

    assert result["errorCount"] == 1
    # Row numbers match what a spreadsheet shows: the quoted line break inside the
    # header does not add a row, so the 6th data record is row 7.
    assert result["errors"][0]["line"] == 7
    assert "Loại giao dịch không hợp lệ" in result["errors"][0]["message"]


def test_app_export_round_trip_and_duplicates():
    exported = (
        "﻿Ngày giờ,Loại giao dịch,Loại tài sản,Mã,Số lượng,Đơn giá,Loại tiền,Tỷ giá,Thành tiền (VNĐ),Lãi/Lỗ VNĐ,Nơi lưu trữ,Ghi chú\n"
        "07/09/2026 11:00:00,Mua,Trái phiếu,VFF,199,25093.830674536097,VNĐ,1,4993672,,Fmarket,DCA hằng tháng\n"
        "15/06/2026 14:00:00,Bán,Tài sản mã hóa,ETH,-0.34547,172425.5,VNĐ,1,59567696,,Binance,\n"
        "07/09/2026 11:00:00,Mua,Trái phiếu,VFF,199,25093.830674536097,VNĐ,1,4993672,,Fmarket,DCA hằng tháng\n"
    )
    result = parse_transactions_csv(exported)
    assert result["numberFormat"] == "en"
    assert len(result["valid"]) == 2
    assert result["duplicates"] == [4]
    vff, eth = result["valid"]
    assert vff["unitPrice"] == 25093.830674536097 and vff["totalVND"] == 4993672
    assert eth["quantity"] == -0.34547

    again = parse_transactions_csv(exported, existing=[vff, eth])
    assert again["valid"] == [] and again["duplicates"] == [2, 3, 4]


def test_missing_header_is_reported():
    assert "error" in parse_transactions_csv("a,b,c\n1,2,3\n")
    assert "error" in parse_transactions_csv("")


def test_transaction_key_ignores_seconds_and_sign():
    a = {"date": "07/09/2026 11:00:00", "transactionType": "Bán", "ticker": "vff", "quantity": -2, "totalVND": 10.4}
    b = {"date": "07/09/2026 11:00:59", "transactionType": "Bán", "ticker": "VFF", "quantity": 2, "totalVND": 10}
    assert transaction_key(a) == transaction_key(b)


def test_prices_single_column_needs_ticker():
    csv = "Ngày,Giá\n01/09/2026,\"8.450.000\"\n02/09/2026,\"8.470.000\"\n"
    assert "error" in parse_prices_csv(csv)
    result = parse_prices_csv(csv, ticker="nhan9999")
    assert result["layout"] == "single"
    assert result["prices"] == {"NHAN9999": {"2026-09-01": 8450000, "2026-09-02": 8470000}}
    assert result["tickers"]["NHAN9999"]["last"] == "2026-09-02"


def test_prices_without_header_and_yahoo_style():
    result = parse_prices_csv("2026-09-01;176500000\n2026-09-02;177000000\n", ticker="GOLDRING")
    assert result["prices"]["GOLDRING"]["2026-09-02"] == 177000000
    yahoo = "Date,Open,High,Low,Close,Adj Close,Volume\n2026-09-01,1,2,0.5,1.5,1.4,100\n"
    assert parse_prices_csv(yahoo, ticker="X")["prices"]["X"]["2026-09-01"] == 1.5


def test_prices_wide_and_long_layouts():
    wide = "Date,VNM,FPT\n2026-09-01,70000,120000\n2026-09-02,,121000\n"
    result = parse_prices_csv(wide)
    assert result["layout"] == "wide"
    assert result["prices"] == {"VNM": {"2026-09-01": 70000}, "FPT": {"2026-09-01": 120000, "2026-09-02": 121000}}

    long = "Ngày,Mã,Giá đóng cửa\n01/09/2026,VNM,70000\n01/09/2026,bad code!,1\n02/09/2026,VNM,-5\n"
    result = parse_prices_csv(long)
    assert result["layout"] == "long"
    assert result["prices"] == {"VNM": {"2026-09-01": 70000}}
    assert result["errorCount"] == 2
