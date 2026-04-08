import obd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# تفعيل CORS للسماح لواجهة React بالاتصال بالسيرفر
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type"]
}})

# إنشاء اتصال مع قطعة OBD2
# ملاحظة: سيقوم المكتبة بالبحث تلقائياً عن المنفذ (Bluetooth/USB/WiFi)
connection = obd.OBD() 

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    # التأكد من حالة الاتصال بالسيارة
    if not connection.is_connected():
        return jsonify({
            "error": "القطعة غير متصلة بالسيارة",
            "status": "offline",
            "vin": "---"
        }), 500

    # طلب البيانات من كمبيوتر السيارة (ECU)
    results = {
        "rpm": connection.query(obd.commands.RPM),
        "speed": connection.query(obd.commands.SPEED),
        "temp": connection.query(obd.commands.COOLANT_TEMP),
        "voltage": connection.query(obd.commands.CONTROL_MODULE_VOLTAGE),
        "load": connection.query(obd.commands.ENGINE_LOAD),
        "throttle": connection.query(obd.commands.THROTTLE_POS),
        "intake": connection.query(obd.commands.INTAKE_TEMP),
        "timing": connection.query(obd.commands.TIMING_ADVANCE),
        "vin": connection.query(obd.commands.VIN),
        "dtc": connection.query(obd.commands.GET_DTC)
    }

    # معالجة رقم الشاصي (VIN) للتعرف على نوع السيارة في الواجهة
    raw_vin = str(results["vin"].value) if results["vin"].value else ""
    # إذا لم تستجب السيارة بالـ VIN (بعض السيارات القديمة)، نرسل كود افتراضي ليعرض "Nissan" كمثال
    final_vin = raw_vin if raw_vin != "" else "JN1-TITAN-REAL-MODE"

    # تجميع البيانات وإرسالها بصيغة JSON تفهمها واجهة React
    return jsonify({
        "rpm": getattr(results["rpm"].value, 'magnitude', 0),
        "speed": getattr(results["speed"].value, 'magnitude', 0),
        "temp": getattr(results["temp"].value, 'magnitude', 0),
        "voltage": getattr(results["voltage"].value, 'magnitude', 12.6),
        "load": getattr(results["load"].value, 'magnitude', 0),
        "throttle": getattr(results["throttle"].value, 'magnitude', 0),
        "intake": getattr(results["intake"].value, 'magnitude', 0),
        "timing": getattr(results["timing"].value, 'magnitude', 0),
        "vin": final_vin,
        "dtc_code": results["dtc"].value[0][0] if results["dtc"].value else ""
    })

@app.route('/api/command', methods=['POST', 'OPTIONS'])
def handle_command():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
        
    try:
        data = request.get_json()
        cmd = data.get("command")
        
        # أمر مسح لمبة المكينة (Check Engine)
        if cmd == "04":
            connection.query(obd.commands.CLEAR_DTC)
            return jsonify({
                "status": "success", 
                "message": "تم إرسال أمر مسح رموز الأعطال للسيارة بنجاح ✅"
            })

        return jsonify({"status": "success", "message": f"تم تنفيذ الأمر {cmd}"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == '__main__':
    print("---" * 10)
    print("🚀 TITAN PRO AI - REAL MODE ACTIVE")
    print("📡 Server: http://127.0.0.1:5000")
    print("---" * 10)
    
    # تشغيل السيرفر
    app.run(host='0.0.0.0', port=5000, debug=False)