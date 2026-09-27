from datetime import datetime

from app.utils.parsing import detect_number_format, normalize_text, parse_date_any, parse_number


def test_normalize_text_strips_vietnamese_accents():
    assert normalize_text("Thành tiền (VNĐ)") == "thanh tien vnd"
    assert normalize_text("Lãi/Lỗ %") == "lai lo %"
    assert normalize_text("Tài sản mã hoá") == normalize_text("Tài sản mã hóa") == "tai san ma hoa"


def test_parse_number_formats():
    assert parse_number("25.794.645,76", "vi") == 25794645.76
    assert parse_number("25,794,645.76", "en") == 25794645.76
    assert parse_number("22044,61", "vi") == 22044.61
    assert parse_number("-45,02000", "vi") == -45.02
    assert parse_number("(1.000)", "vi") == -1000
    assert parse_number("176.500.000 ₫") == 176500000       # auto: two dot groups → thousands
    assert parse_number("0.345470") == 0.34547               # auto: decimal point
    assert parse_number("1,234,567") == 1234567              # auto: comma thousands
    assert parse_number("abc") is None
    assert parse_number("") is None
    assert parse_number(42) == 42.0


def test_detect_number_format_by_majority():
    assert detect_number_format(["25.794.645,76", "22044,61", "100"]) == "vi"
    assert detect_number_format(["25093.830674", "0.34547", "1000"]) == "en"
    assert detect_number_format(["1.234", "100"]) == "en"    # ambiguous → default


def test_parse_date_any():
    assert parse_date_any("14/03/2026 10:05:07") == datetime(2026, 3, 14, 10, 5, 7)
    assert parse_date_any("4/3/2026") == datetime(2026, 3, 4)
    assert parse_date_any("2026-03-14") == datetime(2026, 3, 14)
    assert parse_date_any("2026-03-14T08:00:00Z") == datetime(2026, 3, 14, 8, 0, 0)
    assert parse_date_any("31/02/2026") is None
    assert parse_date_any(1773446400) is not None           # epoch seconds
    assert parse_date_any("not a date") is None
