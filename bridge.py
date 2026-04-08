import obd
import time
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- إعداد الاتصال الذكي ---
def connect_obd():
    print("🔍 جاري البحث عن قطعة OBD2...")
    # محاولة الاتصال التلقائي
    ports = obd.scan_serial()
    print(f"📡 المنافذ المتاحة: {ports}")
    
    # محاولة الاتصال بأول منفذ متاح، وإذا فشل نستخدم المحاكي
    connection = obd.OBD() 
    
    if connection.is_connected():
        print(f"✅ تم الاتصال بنجاح على منفذ: {connection.port_name()}")
    else:
        print("⚠️ لم يتم العثور على قطعة، سيتم تشغيل وضع المحاكاة (Demo Mode)")
    
    return connection

connection = connect_obd()

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    # التحقق من حالة الاتصال ومحاولة إعادة الاتصال إذا انقطع
    if not connection.is_connected():
        # إذا كنت تريد بيانات تجريبية عند عدم التوصيل (لأغراض البرمجة)
        return jsonify({
            "rpm": 850, "speed": 0, "temp": 94, "load": 15,
            "voltage": 14.1, "throttle": 12, "vin": "BMW-SIM-2026",
            "dtc_code": "P0300" 
        })

    # قراءة البيانات الحقيقية من السيارة
    try:
        results = {
            "rpm": connection.query(obd.commands.RPM).value.magnitude if not connection.query(obd.commands.RPM).is_null() else 0,
            "speed": connection.query(obd.commands.SPEED).value.magnitude if not connection.query(obd.commands.SPEED).is_null() else 0,
            "temp": connection.query(obd.commands.COOLANT_TEMP).value.magnitude if not connection.query(obd.commands.COOLANT_TEMP).is_null() else 0,
            "load": connection.query(obd.commands.ENGINE_LOAD).value.magnitude if not connection.query(obd.commands.ENGINE_LOAD).is_null() else 0,
            "voltage": connection.query(obd.commands.ELM_VOLTAGE).value.magnitude if not connection.query(obd.commands.ELM_VOLTAGE).is_null() else 12.6,
            "throttle": connection.query(obd.commands.THROTTLE_POS).value.magnitude if not connection.query(obd.commands.THROTTLE_POS).is_null() else 0,
            "vin": connection.get_vin() or "BMW-M-SERIES",
            "dtc_code": get_first_dtc()
        }
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_first_dtc():
    dtc_query = connection.query(obd.commands.GET_DTC)
    if not dtc_query.is_null() and len(dtc_query.value) > 0:
        return dtc_query.value[0][0]
    return ""

@app.route('/api/command', methods=['POST'])
def handle_command():
    if not connection.is_connected():
        return jsonify({"status": "error", "message": "يجب توصيل القطعة بالسيارة أولاً لمسح الأعطال"})

    cmd_type = request.json.get("command")
    
    if cmd_type == "04":
        # ملاحظة: Mode 04 يتطلب وضع Ignition ON والمحرك طافئ
        connection.query(obd.commands.CLEAR_DTC)
        return jsonify({"status": "success", "message": "تم إرسال أمر مسح الأعطال بنجاح"})
    
    elif cmd_type == "03":
        dtc_query = connection.query(obd.commands.GET_DTC)
        return jsonify({"status": "success", "dtcs": str(dtc_query.value)})

    return jsonify({"status": "error", "message": "أمر غير معروف"}), 400

if __name__ == '__main__':
    # تشغيل السيرفر
    app.run(host='0.0.0.0', port=5000)