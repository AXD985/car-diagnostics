import flask
from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

# متغيرات لحساب التنبؤ والبيانات التراكمية
start_time = datetime.now()

def get_runtime():
    delta = datetime.now() - start_time
    return str(delta).split('.')[0]

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    mode = request.args.get('mode', 'real')
    
    if mode == 'demo':
        # محاكاة بيانات واقعية متغيرة
        rpm = random.randint(750, 3500)
        speed = random.randint(0, 120)
        temp = random.randint(80, 105)
        load = random.randint(10, 85)
        voltage = round(random.uniform(13.5, 14.2), 1)
        throttle = random.randint(5, 40)
        intake = random.randint(30, 45)
        fuel = random.randint(15, 100)
        
        # خوارزمية التنبؤ الذكي (توقع الحرارة بناءً على الحمل والدوران)
        # إذا كان الدوران عالي والحمل عالي، نتوقع زيادة الحرارة
        predicted_temp = temp + (load * 0.1) + (rpm / 2000)
        
        # حساب تقييم القيادة (Eco Score)
        # ينخفض التقييم إذا زاد الـ RPM أو الثروتل بشكل مفاجئ
        eco_score = 100 - (rpm / 400) - (throttle / 5)
        
        return jsonify({
            "rpm": rpm,
            "speed": speed,
            "temp": temp,
            "voltage": voltage,
            "load": load,
            "throttle": throttle,
            "intake": intake,
            "fuel_level": fuel,
            "vin": "TITAN-PRO-AI-2026",
            "dtc_code": random.choice(["", "", "P0300", ""]), # تظهر أخطاء أحياناً
            "predicted_temp": round(predicted_temp, 1),
            "runtime": get_runtime(),
            "oil_life": 85,
            "eco_score": int(max(eco_score, 0)),
            "tire_pressure": "32 PSI"
        })
    else:
        # هنا تضع كود مكتبة obd الحقيقي للاتصال بالسيارة
        # سنبقيها فارغة حالياً لتعمل كـ Placeholder
        return jsonify({"status": "Waiting for OBD2 Adapter..."})

@app.route('/api/command', methods=['POST'])
def send_command():
    cmd = request.json.get('command')
    print(f"Executing OBD Command: {cmd}")
    return jsonify({"status": "success", "msg": f"Command {cmd} executed"})

if __name__ == '__main__':
    # تشغيل السيرفر على الهوست المحلي
    app.run(port=5000, debug=True)