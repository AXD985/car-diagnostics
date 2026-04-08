import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RadialGauge } from 'canvas-gauges';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer } from 'recharts';

const API_URL = "http://127.0.0.1:5000/api/obd2";
const CMD_URL = "http://127.0.0.1:5000/api/command";

export default function App() {
  // حالة البيانات الشاملة لجميع الحساسات
  const [data, setData] = useState({ 
    rpm: 0, temp: 0, speed: 0, voltage: 12.6, load: 0, 
    vin: "", dtc_code: "", throttle: 0, intake: 0, timing: 0 
  });
  const [history, setHistory] = useState([]);
  const [activeError, setActiveError] = useState(null);
  const [freezeFrame, setFreezeFrame] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const rpmG = useRef(null);
  const tempG = useRef(null);

  // --- 1. قاعدة البيانات الموسعة للأعطال والكلمات المفتاحية ---
  const geminiDatabase = useMemo(() => ({
    "p0011": "خلل في توقيت عمود الكامات (Camshaft). افحص مستوى ونظافة الزيت وحساس الـ VVT.",
    "p0300": "احتراق غير منتظم عشوائي (Misfire). افحص البواجي والكويلات فوراً.",
    "p0101": "مشكلة في مستشعر تدفق الهواء (MAF). تسبب تفتفة وضعف تسارع.",
    "p0171": "خليط هواء ووقود فقير. افحص تهريب الفاكيوم أو البخاخات.",
    "p0420": "كفاءة دبة التلوث منخفضة (Catalyst System). قد تحتاج لتنظيف أو تغيير.",
    "p0505": "خلل في نظام التحكم بالهواء الخامل (IAC). يسبب عدم استقرار الـ RPM عند الوقوف.",
    "p0113": "حساس حرارة هواء السحب (IAT) يعطي قراءة مرتفعة جداً.",
    "p0500": "خلل في مستشعر سرعة السيارة (VSS).",
    "حرارة": "تحذير: ارتفاع الحرارة خطر! افحص مستوى سائل التبريد، طلمبة الماء، والمراوح.",
    "زيت": "الزيت الأسود جداً يحتاج تغيير. اللون الحليبي يعني خلط ماء (مشكلة في وجه الرأس).",
    "تفتفة": "غالباً بسبب اتساخ بوابة الهواء (Throttle)، تلف البواجي، أو كويل محترق.",
    "فرامل": "نقص زيت الفرامل أو تآكل الفحمات يقلل كفاءة التوقف ويشعل لمبة ABS.",
    "بطارية": "إذا كان الجهد أقل من 12.0V والمحرك مطفأ، البطارية ضعيفة وتحتاج فحص.",
    "قير": "تأخر التعشيقات قد يكون بسبب نقص زيت القير أو اتساخ الفلتر الداخلي.",
    "صرفية": "زيادة صرف الوقود ترتبط غالباً بحساس الأكسجين (O2 Sensor) أو فلاتر الهواء.",
    "كتمة": "تحقق من صفاية البنزين، بخاخات الوقود، أو انسداد في منظومة العادم."
  }), []);

  // --- 2. نظام التعرف على ماركة السيارة من الـ VIN ---
  const getCarMake = (vin) => {
    if (!vin) return "جاري التعرف على المركبة...";
    const prefix = vin.substring(0, 3).toUpperCase();
    const map = { 
      "WBA": "BMW 🇩🇪", "WDC": "Mercedes-Benz 🇩🇪", "WAU": "Audi 🇩🇪", 
      "JT1": "Toyota 🇯🇵", "JHM": "Honda 🇯🇵", "1FA": "Ford 🇺🇸", 
      "1GC": "Chevrolet 🇺🇸", "ZFF": "Ferrari 🇮🇹", "KMH": "Hyundai 🇰🇷", 
      "KNA": "Kia 🇰🇷", "JTE": "Lexus 🇯🇵", "SJN": "Nissan 🇯🇵",
      "WVW": "Volkswagen 🇩🇪", "VF3": "Peugeot 🇫🇷", "SAL": "Land Rover 🇬🇧"
    };
    return map[prefix] || "مركبة ذكية متصلة 🚗";
  };

  // --- 3. نظام تحليل الأداء اللحظي (الذكاء الاصطناعي لتيتان) ---
  const performanceStatus = useMemo(() => {
    if (!isConnected) return "بانتظار البيانات لبدء التحليل...";
    const { rpm, throttle, load, voltage, temp } = data;
    if (throttle > 60 && rpm < 2500 && load > 80) return "⚠️ ملاحظة: حمل مرتفع مع RPM منخفض. قد يكون هناك كتمة في المحرك.";
    if (voltage < 13.0 && rpm > 1000) return "🔋 تنبيه: الجهد منخفض أثناء التشغيل. افحص الدينامو.";
    if (rpm > 5000) return "🔥 أداء عالي: المحرك في نطاق القوة القصوى.";
    if (temp > 105 && rpm > 3000) return "🌡️ تحذير: الحرارة ترتفع مع الضغط. خفف السرعة فوراً.";
    return "✅ جميع الأنظمة تعمل بتناغم مثالي حالياً.";
  }, [data, isConnected]);

  // --- 4. معالجة أوامر الفحص والمسح ---
  const sendOBDCommand = async (mode) => {
    try {
      const response = await fetch(CMD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: mode })
      });
      const resData = await response.json();
      if (response.ok) {
        alert(resData.message);
        if (mode === "04") {
          setActiveError(null);
          setFreezeFrame(null);
        }
      }
    } catch (e) { alert("❌ فشل الاتصال بالسيرفر المحلي (تأكد من تشغيل bridge.py)"); }
  };

  // --- 5. تحديث البيانات والرسومات ---
  useEffect(() => {
    // إعداد عداد الـ RPM
    if (!rpmG.current) {
        rpmG.current = new RadialGauge({
            renderTo: 'rpm-gauge', width: 220, height: 220, units: 'RPM x1000',
            minValue: 0, maxValue: 8, majorTicks: ['0','1','2','3','4','5','6','7','8'],
            highlights: [{ from: 6.5, to: 8, color: 'rgba(200, 0, 0, .8)' }],
            colorPlate: '#050505', colorNumbers: '#00ffcc', needleType: 'arrow', valueBox: true
        }).draw();
    }
    // إعداد عداد الحرارة
    if (!tempG.current) {
        tempG.current = new RadialGauge({
            renderTo: 'temp-gauge', width: 220, height: 220, units: 'TEMP °C',
            minValue: 0, maxValue: 150, majorTicks: ['0','30','60','90','120','150'],
            highlights: [{ from: 100, to: 150, color: 'rgba(255, 0, 0, .8)' }],
            colorPlate: '#050505', colorNumbers: '#fff'
        }).draw();
    }

    const fetchLiveData = async () => {
      try {
        const response = await fetch(API_URL);
        const incoming = await response.json();
        setIsConnected(true);
        setData(prev => ({ ...prev, ...incoming }));
        
        // تحديث العدادات المادية
        if (rpmG.current) rpmG.current.value = (incoming.rpm || 0) / 1000;
        if (tempG.current) tempG.current.value = incoming.temp || 0;
        
        // نظام الـ Freeze Frame عند ظهور عطل
        if (incoming.dtc_code && !freezeFrame) {
            setFreezeFrame({
                code: incoming.dtc_code, speed: incoming.speed,
                temp: incoming.temp, rpm: incoming.rpm,
                time: new Date().toLocaleTimeString()
            });
        }

        // تحديث الرسم البياني
        setHistory(prev => [...prev, { rpm: incoming.rpm || 0 }].slice(-30));

        // فحص قاعدة البيانات بحثاً عن العطل المكتشف
        const code = incoming.dtc_code?.toLowerCase().trim();
        if (code && geminiDatabase[code]) {
          setActiveError({ code: incoming.dtc_code.toUpperCase(), desc: geminiDatabase[code] });
        } else { setActiveError(null); }
        
      } catch (e) { setIsConnected(false); }
    };

    const interval = setInterval(fetchLiveData, 1000);
    return () => clearInterval(interval);
  }, [geminiDatabase, freezeFrame]);

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '15px', direction: 'rtl', fontFamily: 'Arial' }}>
      
      {/* الهيدر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <h1 style={{ color: '#00ffcc', margin: 0, fontSize: '1.4rem' }}>TITAN PRO MAX V5.7</h1>
          <small style={{color: isConnected ? '#00ff00' : '#ff1e1e'}}>{isConnected ? "● ONLINE" : "○ OFFLINE"}</small>
        </div>
      </div>

      {/* معلومات السيارة والـ VIN */}
      <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #222', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: '#00ffcc', fontSize: '1.1rem' }}>{getCarMake(data.vin)}</h2>
          <code style={{ color: '#444' }}>VIN: {data.vin || "---"}</code>
        </div>
        <div style={{ fontSize: '2rem' }}>{data.vin?.startsWith("W") ? "🇩🇪" : "🚗"}</div>
      </div>

      {/* توزيع الواجهة الرئيسي */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: '15px' }}>
        
        {/* العمود الأيسر: العدادات الدائرية */}
        <div style={{ background: '#080808', padding: '15px', borderRadius: '25px', textAlign: 'center', border: '1px solid #111' }}>
          <canvas id="rpm-gauge"></canvas>
          <hr style={{borderColor: '#111', margin: '15px 0'}} />
          <canvas id="temp-gauge"></canvas>
        </div>

        {/* العمود الأوسط: الرسم البياني والحساسات الرقمية */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ height: '220px', background: '#080808', padding: '10px', borderRadius: '25px', border: '1px solid #111' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
                <Area type="monotone" dataKey="rpm" stroke="#00ffcc" fill="#00ffcc15" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { label: 'السرعة', val: data.speed, unit: 'km/h' },
              { label: 'الجهد', val: data.voltage, unit: 'V' },
              { label: 'الحمل', val: data.load, unit: '%' },
              { label: 'البوابة', val: data.throttle, unit: '%' }
            ].map((s, i) => (
              <div key={i} style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #111', textAlign: 'center' }}>
                <small style={{ color: '#444', display: 'block' }}>{s.label}</small>
                <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{s.val} {s.unit}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* العمود الأيمن: أدوات الفحص والتحليل الذكي */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* قسم الأزرار */}
          <div style={{ background: '#0a0a0a', padding: '15px', borderRadius: '20px', border: '2px solid #ff1e1e' }}>
            <h4 style={{ color: '#ff1e1e', marginTop: 0 }}>🛠️ أدوات الفحص</h4>
            <button onClick={() => sendOBDCommand("03")} style={{ width: '100%', padding: '10px', backgroundColor: '#333', color: '#fff', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', border: 'none' }}>🔍 فحص (Mode 03)</button>
            <button onClick={() => sendOBDCommand("04")} style={{ width: '100%', padding: '10px', backgroundColor: '#ff1e1e', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', border: 'none' }}>🗑️ مسح (Mode 04)</button>
          </div>

          {/* قسم التحليل الذكي والأعطال */}
          <div style={{ background: '#080808', padding: '15px', borderRadius: '20px', border: '1px solid #333', flex: 1 }}>
            <h4 style={{ color: '#00ffcc', margin: '0 0 10px 0' }}>✨ تحليل تيتان الذكي</h4>
            <div style={{ padding: '10px', background: '#111', borderRadius: '10px', fontSize: '0.8rem', color: '#00ffcc', marginBottom: '10px' }}>
               {performanceStatus}
            </div>
            
            {/* عرض العطل النشط إذا وجد */}
            {activeError && (
              <div style={{ padding: '10px', background: '#ff1e1e15', borderRadius: '10px', border: '1px solid #ff1e1e33' }}>
                <strong style={{color: '#ff4d4d'}}>⚠️ {activeError.code}</strong>
                <p style={{fontSize: '0.75rem', margin: '5px 0 0 0'}}>{activeError.desc}</p>
              </div>
            )}

            {/* عرض لقطة البيانات (Freeze Frame) */}
            {freezeFrame && !activeError && (
              <div style={{ marginTop: '10px', padding: '8px', borderTop: '1px solid #222', fontSize: '0.7rem', color: '#666' }}>
                آخر لقطة بيانات للعطل: {freezeFrame.code} في الساعة {freezeFrame.time}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}