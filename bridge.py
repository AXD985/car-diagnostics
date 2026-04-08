import obd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # للسماح لواجهة React بالاتصال بالسيرفر

# الاتصال بالقطعة (تأكد من توصيلها بالبلوتوث أو USB)
# في حال كان الاتصال أوتوماتيكي:
connection = obd.OBD() 

@app.route('/api/obd2', methods=['GET'])
def get_obd_data():
    if not connection.is_connected():
        return jsonify({"error": "القطعة غير متصلة بالسيارة"}), 500

    # قراءة الحساسات الأساسية
    rpm = connection.query(obd.commands.RPM)
    speed = connection.query(obd.commands.SPEED)
    temp = connection.query(obd.commands.COOLANT_TEMP)
    load = connection.query(obd.commands.ENGINE_LOAD)
    voltage = connection.query(obd.commands.ELM_VOLTAGE)
    throttle = connection.query(obd.commands.THROTTLE_POS)

    return jsonify({
        "rpm": rpm.value.magnitude if not rpm.is_null() else 0,
        "speed": speed.value.magnitude if not speed.is_null() else 0,
        "temp": temp.value.magnitude if not temp.is_null() else 0,
        "load": load.value.magnitude if not load.is_null() else 0,
        "voltage": voltage.value.magnitude if not voltage.is_null() else 12.6,
        "throttle": throttle.value.magnitude if not throttle.is_null() else 0,
        "vin": connection.get_vin() or "UNKNOWN1234567",
        "dtc_code": get_first_dtc() # دالة لجلب أول كود عطل
    })

def get_first_dtc():
    dtc_query = connection.query(obd.commands.GET_DTC)
    if not dtc_query.is_null() and len(dtc_query.value) > 0:
        return dtc_query.value[0][0] # يعيد كود مثل P0300
    return ""

@app.route('/api/command', methods=['POST'])
def handle_command():
    cmd_type = request.json.get("command")
    
    if cmd_type == "04":
        # تنفيذ مسح الأعطال (Clear Codes)
        connection.query(obd.commands.CLEAR_DTC)
        return jsonify({"status": "success", "message": "تم مسح الأعطال بنجاح"})
    
    elif cmd_type == "03":
        # إعادة فحص الأعطال
        dtc_query = connection.query(obd.commands.GET_DTC)
        return jsonify({"status": "success", "dtcs": str(dtc_query.value)})

    return jsonify({"status": "error", "message": "أمر غير معروف"}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)