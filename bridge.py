import requests
import time

# رابط السيرفر الخاص بك
URL = "https://car-diagnostics-b600.onrender.com/api/obd2"

print("🛠️  جاري إرسال بيانات فحص مرسيدس بنز (تجربة ضغط عالي)...")

# بيانات المحاكاة: سيارة مرسيدس مع عطل في نظام الـ ABS وضغط الوقود
test_data = {
    "rpm": 5800,           # دوران مرتفع
    "speed": 210,          # سرعة عالية جداً
    "temp": 108,           # حرارة مرتفعة قليلاً (أداء رياضي)
    "voltage": 14.6,       # شحن الدينامو ممتاز
    "vin": "WDC123456789",  # WDC = Mercedes-Benz 🇩🇪
    "load": 95,            # حمل محرك عالٍ
    "dtc_code": "u0121",   # عطل فقدان الاتصال بنظام الـ ABS
    "throttle": 88,
    "intake": 45,
    "timing": 22
}

try:
    response = requests.post(URL, json=test_data)
    if response.status_code == 200:
        print("✅ تم التحديث! افتح المتصفح الآن وشوف 'الوحش الألماني'.")
    else:
        print(f"❌ فشل الإرسال: {response.status_code}")
except Exception as e:
    print(f"❌ خطأ في الاتصال: {e}")