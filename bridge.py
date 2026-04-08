import obd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# تفعيل CORS بشكل كامل لضمان عمل الأزرار من موقع Render
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type"]
}})

def connect_obd():
    print("🔍 جاري فحص الاتصال...")
    # بما أن القطعة غير موجودة، سنقوم بإرجاع None فوراً 
    # لتجنب رسالة 'Failed to read port' وتوقف السيرفر
    return None

# محاولة الاتصال (ستنتقل لوضع الديمو مباشرة)
connection = connect_obd()

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    # بيانات ديمو لتشغيل عدادات TITAN PRO
    return jsonify({
        "rpm": 2800, 
        "speed": 120, 
        "temp": 95, 
        "load": 45,
        "voltage": 14.1, 
        "throttle": 30, 
        "vin": "DEMO-MODE-2026",
        "dtc_code": "P0300" 
    })

@app.route('/api/command', methods=['POST', 'OPTIONS'])
def handle_command():
    # حل مشكلة الأزرار (CORS Preflight)
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
        
    data = request.json
    cmd = data.get("command")
    print(f"📡 أمر مستلم من الواجهة: {cmd}")
    
    # الرد برسالة نجاح لتظهر في المتصفح (Alert)
    return jsonify({
        "status": "success", 
        "message": f"تم استقبال أمر {cmd} بنجاح في وضع المحاكاة"
    })

if __name__ == '__main__':
    print("🚀 السيرفر يعمل الآن على http://127.0.0.1:5000")
    print("💡 افتح موقع Render الآن وقم بعمل Refresh")
    # تشغيل السيرفر
    app.run(host='127.0.0.1', port=5000, debug=False)