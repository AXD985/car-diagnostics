import obd
from flask import Flask, jsonify, request
import random
import time
from flask_cors import CORS

app = Flask(__name__)

# تفعيل CORS للسماح بالاتصال من أي مكان (Render أو Localhost)
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type"]
}})

# متغيرات لمحاكاة حركة البيانات (Demo Mode Logic)
sim_data = {
    "rpm": 2500,
    "temp": 90,
    "speed": 100,
    "voltage": 13.8,
    "dtc_code": "P0300" # كود العطل الذي سيقوم الـ AI في الواجهة بتحليله
}

def update_simulated_data():
    """تحديث البيانات بشكل عشوائي بسيط لمحاكاة واقعية للمحرك"""
    sim_data["rpm"] = random.randint(2400, 3200)
    sim_data["temp"] = random.randint(92, 98)
    sim_data["voltage"] = round(random.uniform(13.5, 14.2), 1)
    sim_data["load"] = random.randint(30, 60)
    sim_data["throttle"] = random.randint(15, 45)

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    # تحديث القيم قبل إرسالها للواجهة لجعل العدادات تتحرك
    update_simulated_data()
    
    return jsonify({
        "rpm": sim_data["rpm"],
        "speed": sim_data["speed"],
        "temp": sim_data["temp"],
        "load": sim_data.get("load", 40),
        "voltage": sim_data["voltage"],
        "throttle": sim_data.get("throttle", 25),
        "vin": "TITAN-PRO-AI-2026",
        "dtc_code": sim_data["dtc_code"]
    })

@app.route('/api/command', methods=['POST', 'OPTIONS'])
def handle_command():
    # حل مشكلة Preflight requests في المتصفحات
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
        
    try:
        data = request.get_json()
        cmd = data.get("command")
        
        print(f"📡 أمر مستلم من نظام الذكاء الاصطناعي: {cmd}")
        
        # إذا كان الأمر هو مسح الأعطال (04)
        if cmd == "04":
            sim_data["dtc_code"] = "" # مسح كود العطل من المحاكي
            return jsonify({
                "status": "success", 
                "message": "تم مسح رموز الأعطال (DTC) بنجاح عبر نظام AI"
            })

        return jsonify({
            "status": "success", 
            "message": f"تم تنفيذ الأمر {cmd} في وضع المحاكاة"
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == '__main__':
    print("---" * 10)
    print("🚀 TITAN PRO AI BACKEND IS RUNNING")
    print("📡 Listening on: http://127.0.0.1:5000")
    print("💡 Mode: AI Simulation Enabled")
    print("---" * 10)
    
    # تشغيل السيرفر على جميع العناوين المتاحة لتسهيل الاتصال
    app.run(host='0.0.0.0', port=5000, debug=False)