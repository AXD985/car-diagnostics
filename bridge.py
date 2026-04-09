import obd
import json
import time
import random
import os
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- إعدادات تخزين البيانات (Database) ---
DATABASE_PATH = "titan_master_database.json"
RUNTIME_LOG = "titan_runtime.log"

# كائن الذاكرة المؤقتة (System Context)
titan_system = {
    "boot_time": time.time(),
    "prediction_weight": 0.08,  # وزن الحمل في التنبؤ
    "temp_trend": [],
    "last_vin": "SEARCHING..."
}

# محاولة الاتصال بالسيارة عبر ELM327
try:
    connection = obd.OBD() 
except Exception as e:
    print(f"OBD Connection Warning: {e}")
    connection = None

def persist_to_db(payload):
    """حفظ البيانات فعلياً في ملف JSON ليكون مرجعاً تاريخياً (Database)"""
    entry = {
        "id": int(time.time() * 1000),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "data": payload
    }
    try:
        with open(DATABASE_PATH, "a", encoding="utf-8") as db:
            db.write(json.dumps(entry) + "\n")
        
        # سجل العمليات اليومي (Logging)
        with open(RUNTIME_LOG, "a", encoding="utf-8") as log:
            log.write(f"[{entry['timestamp']}] STATS SAVED | TEMP: {payload['temp']} | PRED: {payload['predicted_temp']}\n")
    except Exception as error:
        print(f"Persistence Error: {error}")

def ai_prediction_engine(current_temp, current_load, current_rpm):
    """
    Predictive Maintenance Algorithm
    توقع الحرارة بعد فترة زمنية بناءً على الحمل الميكانيكي ومعدل الدوران.
    المعادلة: الحرارة المتوقعة = الحالية + (الحمل * المعامل) + (تأثير الدوران)
    """
    prediction = current_temp + (current_load * titan_system["prediction_weight"]) + (current_rpm / 6000)
    return round(prediction, 2)

@app.route('/api/obd2', methods=['GET'])
def fetch_telemetry():
    mode = request.args.get('mode', 'real')
    
    if mode == 'demo':
        # محاكاة احترافية تتغير مع الوقت لتبهر اللجنة
        uptime = time.time() - titan_system["boot_time"]
        current_rpm = random.randint(1800, 5200)
        current_load = random.randint(35, 88)
        # رفع الحرارة تدريجياً لمحاكاة تشغيل حقيقي
        current_temp = 82.0 + (uptime * 0.04) + random.uniform(-0.4, 0.4)
        
        data = {
            "rpm": current_rpm,
            "speed": random.randint(40, 140),
            "temp": round(current_temp, 1),
            "voltage": round(random.uniform(13.6, 14.2), 1),
            "load": current_load,
            "throttle": random.randint(10, 80),
            "vin": "TITAN-AI-DEMO-2026",
            "dtc_code": "P0300" if current_temp > 103 else ""
        }
    else:
        # جلب البيانات الحقيقية من حساسات السيارة (OBD-II Protocol)
        if connection and connection.is_connected():
            try:
                data = {
                    "rpm": int(connection.query(obd.commands.RPM).value.magnitude or 0),
                    "speed": int(connection.query(obd.commands.SPEED).value.magnitude or 0),
                    "temp": int(connection.query(obd.commands.COOLANT_TEMP).value.magnitude or 0),
                    "voltage": round(connection.query(obd.commands.CONTROL_MODULE_VOLTAGE).value.magnitude or 12.6, 1),
                    "load": int(connection.query(obd.commands.ENGINE_LOAD).value.magnitude or 0),
                    "throttle": int(connection.query(obd.commands.THROTTLE_POS).value.magnitude or 0),
                    "vin": str(connection.query(obd.commands.VIN).value) or "TITAN-REAL-CAR",
                    "dtc_code": connection.query(obd.commands.GET_DTC).value[0][0] if connection.query(obd.commands.GET_DTC).value else ""
                }
            except Exception as e:
                return jsonify({"status": "error", "message": str(e)}), 500
        else:
            return jsonify({"status": "offline", "message": "ELM327 NOT CONNECTED"}), 503

    # تشغيل محرك التنبؤ الذكي
    data["predicted_temp"] = ai_prediction_engine(data["temp"], data["load"], data["rpm"])
    
    # الحفظ في قاعدة البيانات الدائمة
    persist_to_db(data)
    
    return jsonify(data)

@app.route('/api/command', methods=['POST'])
def execute_obd_command():
    command_code = request.json.get("command")
    if command_code == "04": # مسح الأعطال
        if connection and connection.is_connected():
            connection.query(obd.commands.CLEAR_DTC)
        titan_system["boot_time"] = time.time() # Reset Demo Timer
        return jsonify({"status": "success", "message": "✅ تم تصفير سجل الأعطال بنجاح"})
    return jsonify({"status": "fail", "message": "Unknown Command"})

if __name__ == '__main__':
    print("========================================")
    print("🛡️ TITAN AI MASTER BACKEND V10.0")
    print("📍 DATABASE: active")
    print("📍 PREDICTION ENGINE: running")
    print("========================================")
    app.run(host='0.0.0.0', port=5000, debug=False)