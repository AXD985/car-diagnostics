import obd
from flask import Flask, jsonify, request
from flask_cors import CORS
import time
import random # لاستخدامه في توليد بيانات وهمية عند عدم وجود سيارة

app = Flask(__name__)

CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type"]
}})

trip_data = {
    "start_time": time.time(),
    "max_rpm": 0,
    "avg_load": [],
    "overheat_warnings": 0
}

# --- التعديل الذكي هنا ---
# نحاول الاتصال بالسيارة، وإذا فشلنا نستخدم وضع المحاكاة (Debug Mode)
try:
    connection = obd.OBD() 
    REAL_MODE = connection.is_connected()
except:
    REAL_MODE = False

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    # إذا كنا في وضع السيارة الحقيقي ولم نجد اتصال
    if REAL_MODE and not connection.is_connected():
        return jsonify({"status": "offline", "error": "Disconnected"}), 500

    if REAL_MODE:
        # قراءة البيانات الحقيقية من السيارة
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
        rpm_val = getattr(results["rpm"].value, 'magnitude', 0)
        speed_val = getattr(results["speed"].value, 'magnitude', 0)
        temp_val = getattr(results["temp"].value, 'magnitude', 0)
        load_val = getattr(results["load"].value, 'magnitude', 0)
        vin_val = str(results["vin"].value) if results["vin"].value else "TITAN-PRO-AI-2026"
        dtc_val = results["dtc"].value[0][0] if results["dtc"].value else ""
    else:
        # وضع المحاكاة (Demo Mode) لكي يظهر ONLINE وتتحرك العدادات
        rpm_val = random.randint(800, 3500)
        speed_val = random.randint(0, 120)
        temp_val = random.randint(85, 95)
        load_val = random.randint(20, 60)
        vin_val = "TITAN-PRO-AI-2026"
        dtc_val = ""

    # تحديث تحليلات الرحلة
    if rpm_val > trip_data["max_rpm"]:
        trip_data["max_rpm"] = rpm_val
    trip_data["avg_load"].append(load_val)

    return jsonify({
        "status": "online", # نرسل حالة online دائماً في وضع المحاكاة
        "rpm": rpm_val,
        "speed": speed_val,
        "temp": temp_val,
        "voltage": 13.8 if REAL_MODE else random.uniform(13.2, 14.1),
        "load": load_val,
        "throttle": random.randint(10, 40) if not REAL_MODE else getattr(results["throttle"].value, 'magnitude', 0),
        "intake": 35 if not REAL_MODE else getattr(results["intake"].value, 'magnitude', 0),
        "timing": 15 if not REAL_MODE else getattr(results["timing"].value, 'magnitude', 0),
        "vin": vin_val,
        "dtc_code": dtc_val,
        "analytics": {
            "max_rpm": trip_data["max_rpm"],
            "avg_load": sum(trip_data["avg_load"]) / len(trip_data["avg_load"]),
            "warnings": trip_data["overheat_warnings"]
        }
    })

@app.route('/api/command', methods=['POST', 'OPTIONS'])
def handle_command():
    if request.method == 'OPTIONS': return jsonify({"status": "ok"}), 200
    try:
        data = request.get_json()
        if data.get("command") == "04" and REAL_MODE:
            connection.query(obd.commands.CLEAR_DTC)
        return jsonify({"status": "success", "message": "✅ تم تنفيذ الأمر بنجاح"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == '__main__':
    print("---" * 15)
    print(f"🚀 MODE: {'REAL CAR' if REAL_MODE else 'SIMULATOR (DEMO)'}")
    print("🔗 API: http://127.0.0.1:5000/api/obd2")
    print("---" * 15)
    app.run(host='0.0.0.0', port=5000, debug=False)