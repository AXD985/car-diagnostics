import requests
import time
import random

# روابط السيرفر الخاصة بك
URL = "https://car-diagnostics-b600.onrender.com/api/obd2"
CMD_URL = "https://car-diagnostics-b600.onrender.com/api/command"

print("🏎️  بدء TITAN PRO الميداني (بيانات متغيرة + استقبال أوامر)...")

# قيم البداية
rpm = 800
speed = 0
temp = 85
current_dtc = ""

try:
    for i in range(100): # محاكاة طويلة جداً للتجربة
        # 1. التحقق: هل ضغط أحمد على زر "مسح الأعطال" في الموقع؟
        try:
            cmd_check = requests.get(CMD_URL)
            if cmd_check.status_code == 200:
                command = cmd_check.json().get("command")
                if command == "CLEAR_CODES":
                    print("🧹 تم استلام أمر مسح الأعطال من الموقع.. جاري التنفيذ!")
                    current_dtc = "" # مسح العطل في المحاكاة
        except: pass

        # 2. محاكاة حركة الأرقام (تسارع تلقائي)
        if i < 20: # تسارع
            rpm += random.randint(200, 400)
            speed += random.randint(5, 12)
        elif i < 40: # ثبات
            rpm = random.randint(3000, 3200)
            speed = random.randint(110, 120)
        else: # تباطؤ
            rpm -= random.randint(300, 500)
            speed -= random.randint(10, 15)
        
        # تفعيل عطل تلقائي عند الخطوة 15 لاختبار "لقطة العطل" والمسح
        if i == 15: current_dtc = "P0300"
        
        # التأكد من الحدود
        rpm = max(800, min(rpm, 7500))
        speed = max(0, min(speed, 240))

        test_data = {
            "rpm": rpm,
            "speed": speed,
            "temp": temp + (i // 10),
            "voltage": round(random.uniform(13.9, 14.3), 1),
            "vin": "WBS123456789", # BMW M-Series
            "dtc_code": current_dtc,
            "load": random.randint(20, 80),
            "throttle": random.randint(15, 90)
        }

        # 3. إرسال البيانات للسيرفر السحابي
        response = requests.post(URL, json=test_data)
        
        if response.status_code == 200:
            status = f"🔥 DTC ACTIVE: {current_dtc}" if current_dtc else "🟢 System Clear"
            print(f"📊 {i+1}: RPM={rpm} | Speed={speed} | {status}")
        
        time.sleep(1) # تحديث كل ثانية

except Exception as e:
    print(f"❌ خطأ فني: {e}")