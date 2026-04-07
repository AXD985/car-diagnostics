import requests
import time
import random

# رابط سيرفرك العالمي على Render
URL = "https://car-diagnostics-backend.onrender.com/api/obd2"

print("🚀 جاري بدء محاكاة سيارة أحمد...")

while True:
    try:
        # صنع بيانات وهمية (RPM وسرعة وحرارة)
        data = {
            "rpm": random.randint(800, 3500),
            "speed": random.randint(0, 100),
            "temp": random.randint(85, 105),
            "voltage": 14.1,
            "load": 25.5,
            "vin": "AHMED-TEST-CAR",
            "throttle": 20,
            "dtc_code": "[]"
        }
        
        # إرسال البيانات للسحاب
        res = requests.post(URL, json=data)
        
        if res.status_code == 200:
            print(f"✅ تم الإرسال بنجاح! RPM: {data['rpm']} | Speed: {data['speed']}")
        else:
            print(f"❌ السيرفر مشغول حالياً (Status: {res.status_code})")
            
        time.sleep(1) # إرسال رقم جديد كل ثانية
        
    except Exception as e:
        print(f"⚠️ خطأ: تأكد من اتصالك بالإنترنت! {e}")
        time.sleep(5)