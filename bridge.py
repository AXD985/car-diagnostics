import flask
from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time
from datetime import datetime
import obd 

app = Flask(__name__)
CORS(app)

start_time = datetime.now()
connection = None

def get_connection():
    global connection
    if connection is None or not connection.is_connected():
        try:
            # محاولة الاتصال التلقائي
            connection = obd.OBD() 
        except:
            connection = None
    return connection

def get_runtime():
    delta = datetime.now() - start_time
    return str(delta).split('.')[0]

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    conn = get_connection()
    
    if conn and conn.is_connected():
        try:
            # --- بيانات المحرك الحية ---
            rpm = conn.query(obd.commands.RPM).value.magnitude
            speed = conn.query(obd.commands.SPEED).value.magnitude
            temp = conn.query(obd.commands.COOLANT_TEMP).value.magnitude
            load = conn.query(obd.commands.ENGINE_LOAD).value.magnitude
            voltage = conn.query(obd.commands.ELM_VOLTAGE).value.magnitude
            
            # --- بيانات الـ ECU (الإضافة الجديدة) ---
            # جلب بروتوكول الاتصال (مثل CAN BUS)
            ecu_protocol = conn.protocol_name()
            # جلب رقم الـ VIN الحقيقي
            vin_query = conn.query(obd.commands.VIN)
            real_vin = str(vin_query.value) if vin_query.value else "UNKNOWN-VIN"
            
            return jsonify({
                "rpm": int(rpm),
                "speed": int(speed),
                "temp": int(temp),
                "voltage": round(float(voltage), 1),
                "load": int(load),
                "vin": real_vin,
                "predicted_temp": round(temp + (load * 0.05), 1),
                "runtime": get_runtime(),
                # بيانات الـ ECU المضافة
                "ecu_info": {
                    "protocol": ecu_protocol,
                    "status": "ACTIVE",
                    "connection_type": "ELM327-AUTO",
                    "processor_load": random.randint(5, 15) # محاكاة لضغط المعالج
                },
                "status": "CONNECTED"
            })
        except Exception as e:
            print(f"Error fetching data: {e}")

    # وضع المحاكاة (Demo Mode) مع بيانات ECU وهمية
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
        "ecu_info": {
            "protocol": "ISO 15765-4 (CAN 11/500)",
            "status": "EMULATED",
            "connection_type": "VIRTUAL-LINK",
            "processor_load": random.randint(1, 5)
        },
        "status": "DEMO_MODE"
    })

@app.route('/api/command', methods=['POST'])
def send_command():
    conn = get_connection()
    data = request.json
    cmd_name = data.get('command')

    if conn and conn.is_connected() and cmd_name == "CLEAR_DTC":
        conn.query(obd.commands.CLEAR_DTC)
        return jsonify({"status": "success", "msg": "ECU Memory Cleared"})
    
    return jsonify({"status": "success", "msg": "Command Executed in Demo"})

if __name__ == '__main__':
    app.run(port=5000, debug=True)