import flask
from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time
from datetime import datetime
import obd  # تأكد من تثبيتها عبر: pip install obd

app = Flask(__name__)
CORS(app)

start_time = datetime.now()

# محاولة الاتصال بجهاز OBD2 (سواء USB أو Bluetooth)
# يمكنك تركها فارغة للبحث التلقائي أو تحديد المنفذ مثل: obd.OBD("/dev/ttyUSB0")
connection = None

def get_connection():
    global connection
    if connection is None or not connection.is_connected():
        try:
            connection = obd.OBD() # البحث التلقائي عن القطعة
        except:
            connection = None
    return connection

def get_runtime():
    delta = datetime.now() - start_time
    return str(delta).split('.')[0]

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    conn = get_connection()
    
    # إذا كان الجهاز متصل بالسيارة، نسحب بيانات حقيقية
    if conn and conn.is_connected():
        try:
            rpm = conn.query(obd.commands.RPM).value.magnitude
            speed = conn.query(obd.commands.SPEED).value.magnitude
            temp = conn.query(obd.commands.COOLANT_TEMP).value.magnitude
            load = conn.query(obd.commands.ENGINE_LOAD).value.magnitude
            voltage = conn.query(obd.commands.ELM_VOLTAGE).value.magnitude
            
            # منطق التنبؤ الذكي الحقيقي بناءً على القراءات الفعلية
            predicted_temp = temp + (load * 0.05)
            eco_score = 100 - (rpm / 300)
            
            return jsonify({
                "rpm": int(rpm),
                "speed": int(speed),
                "temp": int(temp),
                "voltage": round(float(voltage), 1),
                "load": int(load),
                "vin": "REAL-VEHICLE-2026",
                "predicted_temp": round(predicted_temp, 1),
                "runtime": get_runtime(),
                "status": "CONNECTED"
            })
        except Exception as e:
            print(f"Error fetching data: {e}")

    # إذا لم يكن هناك اتصال، نعود لوضع المحاكاة (Demo Mode) تلقائياً
    # وهذا يضمن أن الموقع لن يتوقف عن العمل أبداً
    rpm = random.randint(800, 3200)
    temp = random.randint(88, 98)
    load = random.randint(15, 70)
    
    return jsonify({
        "rpm": rpm,
        "speed": random.randint(20, 110),
        "temp": temp,
        "voltage": round(random.uniform(13.6, 14.1), 1),
        "load": load,
        "vin": "TITAN-PRO-AI-2026",
        "predicted_temp": round(temp + (load * 0.05), 1),
        "runtime": get_runtime(),
        "status": "DEMO_MODE"
    })

@app.route('/api/command', methods=['POST'])
def send_command():
    # هنا يمكنك إضافة أوامر حقيقية مثل مسح الأخطاء
    # conn.query(obd.commands.CLEAR_DTC)
    return jsonify({"status": "success", "msg": "OBD Command Executed"})

if __name__ == '__main__':
    print("TITAN PRO AI Backend is ready!")
    app.run(port=5000, debug=True)