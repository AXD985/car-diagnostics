import obd
import json
import time
import random
import os
from flask import Flask, jsonify, request
from flask_cors import CORS

# --- إعدادات النظام ---
app = Flask(__name__)
CORS(app)

DB_FILE = "titan_master_database.json"
LOG_FILE = "system_runtime.log"

# كائن حالة النظام (System State)
system_context = {
    "start_time": time.time(),
    "prediction_weight": 0.085, # المعامل الرياضي للتنبؤ
    "is_connected": False
}

# --- 1. إعداد الاتصال بالسيارة (OBD-II) ---
try:
    # محاولة الاتصال بالقطعة (Bluetooth / WiFi / USB)
    connection = obd.OBD() 
    if connection.is_connected():
        system_context["is_connected"] = True
        print("✅ Connected to Vehicle ECU")
    else:
        print("⚠️ OBD Adapter not found, switching to Virtual Mode")
except Exception as e:
    connection = None
    print(f"❌ Connection Error: {e}")

# --- 2. محرك قاعدة البيانات (Database Engine) ---
def log_to_database(payload):
    """حفظ البيانات في ملف JSON ليكون مرجعاً تاريخياً للمشروع"""
    record = {
        "entry_id": int(time.time() * 1000),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "metrics": payload
    }
    try:
        # إضافة السجل إلى ملف قاعدة البيانات
        with open(DB_FILE, "a", encoding='utf-8') as db:
            db.write(json.dumps(record, ensure_ascii=False) + "\n")
            
        # إضافة سطر إلى ملف السجلات العام
        with open(LOG_FILE, "a", encoding='utf-8') as log:
            log.write(f"[{record['timestamp']}] VIN:{payload['vin']} | TEMP:{payload['temp']} | RPM:{payload['rpm']}\n")
    except Exception as e:
        print(f"Database Write Error: {e}")

# --- 3. محرك الذكاع الاصطناعي التنبئي (Predictive AI Engine) ---
def run_prediction_model(temp, load, rpm):
    """
    خوارزمية تنبؤية (Linear Projection)
    تتوقع درجة حرارة المحرك بعد 10-15 ثانية بناءً على الجهد الحالي.
    المعادلة: الحرارة المتوقعة = الحالية + (الحمل * المعامل) + (تأثير سرعة الدوران)
    """
    # معادلة مهجنة لتقدير الارتفاع الحراري
    prediction = temp + (load * system_context["prediction_weight"]) + (rpm / 7500)
    return round(prediction, 2)

# --- 4. نقاط الوصول (API Endpoints) ---

@app.route('/api/obd2', methods=['GET'])
def get_telemetry():
    mode = request.args.get('mode', 'real')
    
    if mode == 'demo' or not system_context["is_connected"]:
        # --- وضع المحاكاة الذكي (Smart Simulation) ---
        uptime = time.time() - system_context["start_time"]
        current_rpm = random.randint(2200, 5800)
        current_load = random.randint(45, 92)
        # محاكاة ارتفاع الحرارة مع الوقت والضغط
        base_temp = 88.0 + (uptime * 0.03) + (current_load * 0.05)
        
        data = {
            "rpm": current_rpm,
            "speed": random.randint(40, 160),
            "temp": round(base_temp, 1),
            "voltage": round(random.uniform(13.5, 14.1), 1),
            "load": current_load,
            "throttle": random.randint(15, 85),
            "intake": 38,
            "vin": "TITAN-AI-V10-DEMO",
            "dtc_code": "P0300" if base_temp > 104 else ""
        }
    else:
        # --- جلب بيانات حقيقية من الحساسات ---
        try:
            data = {
                "rpm": int(connection.query(obd.commands.RPM).value.magnitude),
                "speed": int(connection.query(obd.commands.SPEED).value.magnitude),
                "temp": int(connection.query(obd.commands.COOLANT_TEMP).value.magnitude),
                "voltage": round(connection.query(obd.commands.CONTROL_MODULE_VOLTAGE).value.magnitude, 1),
                "load": int(connection.query(obd.commands.ENGINE_LOAD).value.magnitude),
                "throttle": int(connection.query(obd.commands.THROTTLE_POS).value.magnitude),
                "intake": int(connection.query(obd.commands.INTAKE_TEMP).value.magnitude),
                "vin": str(connection.query(obd.commands.VIN).value) or "TITAN-REAL-CAR",
                "dtc_code": connection.query(obd.commands.GET_DTC).value[0][0] if connection.query(obd.commands.GET_DTC).value else ""
            }
        except Exception as e:
            return jsonify({"status": "error", "message": "Failed to read sensors"}), 500

    # تنفيذ التنبؤ باستخدام خوارزمية الـ AI
    data["predicted_temp"] = run_prediction_model(data["temp"], data["load"], data["rpm"])
    
    # تخزين البيانات في قاعدة البيانات
    log_to_database(data)
    
    return jsonify(data)

@app.route('/api/command', methods=['POST'])
def send_command():
    """تنفيذ أوامر الـ OBD2 مثل مسح الأعطال"""
    command = request.json.get("command")
    if command == "04": # رمز مسح الـ DTC
        if system_context["is_connected"]:
            connection.query(obd.commands.CLEAR_DTC)
        # إعادة تعيين زمن المحاكاة في وضع الديمو
        system_context["start_time"] = time.time()
        return jsonify({"status": "success", "message": "✅ تم مسح ذاكرة الأعطال بنجاح"})
    return jsonify({"status": "unknown", "message": "Command not recognized"})

# --- 5. تشغيل السيرفر ---
if __name__ == '__main__':
    print("\n" + "="*40)
    print("🚀 TITAN AI - ADVANCED BACKEND ENGINE")
    print(f"📊 DATABASE: {DB_FILE}")
    print(f"🧠 AI PREDICTION: ACTIVE")
    print("="*40 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=False)