import flask
from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time
from datetime import datetime
import math
import os  # أضفنا مكتبة os لقراءة إعدادات السيرفر

app = Flask(__name__)
# تفعيل CORS للسماح لأي واجهة (Frontend) بالاتصال بالسيرفر
CORS(app, resources={r"/api/*": {"origins": "*"}})

start_time = datetime.now()
counter = 0

def get_runtime():
    delta = datetime.now() - start_time
    return str(delta).split('.')[0]

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    global counter
    counter += 0.1 
    
    rpm = int(1900 + 1100 * math.sin(counter))
    speed = int(60 + 40 * math.sin(counter * 0.5))
    temp = int(90 + 2 * math.sin(counter * 0.1))
    load = int(30 + 20 * math.cos(counter))
    voltage = round(13.8 + 0.2 * math.sin(counter * 0.05), 1)

    return jsonify({
        "rpm": abs(rpm),
        "speed": abs(speed),
        "temp": temp,
        "voltage": voltage,
        "load": abs(load),
        "vin": "TITAN-PRO-AI-2026",
        "predicted_temp": round(temp + (abs(load) * 0.05) + 1.5, 1),
        "runtime": get_runtime(),
        "ecu_info": {
            "protocol": "ISO 15765-4 (CAN 11/500)",
            "status": "ONLINE_EMULATION",
            "connection_type": "RENDER-CLOUD",
            "processor_load": random.randint(8, 12)
        },
        "status": "DEMO_MODE",
        "throttle": int(20 + 15 * math.sin(counter)),
        "fuel_level": 75,
        "dtc_code": "" 
    })

@app.route('/api/command', methods=['POST'])
def send_command():
    return jsonify({"status": "success", "msg": "Command Executed via Cloud"})

# هذا الجزء مهم جداً لمنصة Render
if __name__ == '__main__':
    # Render يحدد المنفذ تلقائياً عبر متغير بيئة يسمى PORT
    port = int(os.environ.get("PORT", 5000))
    # التشغيل على 0.0.0.0 ضروري ليتمكن السيرفر من استقبال الطلبات الخارجية
    app.run(host='0.0.0.0', port=port)