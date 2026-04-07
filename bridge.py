import obd
import requests
import time

# 1. الاتصال بالسيارة
# ملاحظة: إذا كنت تعرف رقم الـ COM Port اكتبه هنا، مثلاً: portstr="COM3"
connection = obd.OBD() 

# رابط السيرفر الخاص بك على Render
URL = "https://car-diagnostics-b600.onrender.com/api/obd2"

print("📡 بدأ استقبال البيانات من الحساسات...")

while True:
    if connection.is_connected():
        # قراءة الحساسات الأساسية
        rpm = connection.query(obd.commands.RPM).value.magnitude
        speed = connection.query(obd.commands.SPEED).value.magnitude
        temp = connection.query(obd.commands.COOLANT_TEMP).value.magnitude
        voltage = connection.query(obd.commands.CONTROL_MODULE_VOLTAGE).value.magnitude
        
        # قراءة رقم الشاصي (VIN)
        vin_query = connection.query(obd.commands.VIN)
        vin_code = str(vin_query.value) if vin_query.value else "UNKNOWN"

        # قراءة أكواد الأعطال (DTC)
        dtc_query = connection.query(obd.commands.GET_DTC)
        # نأخذ أول كود عطل إذا وجد
        dtc_code = dtc_query.value[0][0] if dtc_query.value else ""

        # تجهيز البيانات للإرسال
        data_to_send = {
            "rpm": int(rpm),
            "speed": int(speed),
            "temp": int(temp),
            "voltage": round(float(voltage), 1),
            "vin": vin_code,
            "dtc_code": dtc_code,
            "load": 50 # يمكنك إضافة حساس الـ LOAD أيضاً
        }

        try:
            requests.post(URL, json=data_to_send)
            print(f"✅ تم الإرسال: RPM={int(rpm)} | VIN={vin_code}")
        except:
            print("❌ فشل الاتصال بالسيرفر")

    else:
        print("🔄 جاري محاولة الاتصال بالقطعة... تأكد من تشغيل سويتش السيارة")
    
    time.sleep(1) # تحديث كل ثانية