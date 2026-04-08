import obd
import time
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
# تفعيل CORS للسماح بالاتصال من الواجهة
CORS(app, resources={r"/api/*": {"origins": "*"}})

def connect_obd():
    print("🔍 جاري محاولة فحص الاتصال بالقطعة...")
    # استخدام try لمنع البرنامج من الانهيار في حال غياب القطعة
    try:
        # محاولة سريعة للبحث عن المنفذ
        connection = obd.OBD(portstr="COM1", baudrate=38400, timeout=1)
        if connection.is_connected():
            print("✅ تم الاتصال بالقطعة!")
            return connection
    except Exception as e:
        print(f"⚠️ تنبيه: لم يتم العثور على قطعة ({e})")
    
    print("🚀 تفعيل وضع المحاكاة (Demo Mode) بنجاح.")
    return None

# تشغيل محاولة الاتصال (ستفشل وتكمل بأمان)
connection = connect_obd()

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    # طالما القطعة غير موجودة، سنرسل هذه البيانات للواجهة لتراها تعمل
    return jsonify({
        "rpm": 2800, 
        "speed": 120, 
        "temp": 95, 
        "load": 45,
        "voltage": 14.1, 
        "throttle": 30, 
        "vin": "WBA-TITAN-PRO-2026",
        "dtc_code": "P0300" 
    })

@app.route('/api/command', methods=['POST', 'OPTIONS'])
def handle_command():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
        
    cmd = request.json.get("command")
    print(f"📡 استلمت أمر من الواجهة: {cmd}")
    
    # هنا ستظهر لك رسالة Alert في المتصفح تخبرك أن الزر استجاب
    return jsonify({
        "status": "success", 
        "message": f"تم استلام أمر {cmd} في وضع المحاكاة بنجاح"
    })

if __name__ == '__main__':
    # تشغيل السيرفر على منفذ 5000
    app.run(host='127.0.0.1', port=5000)