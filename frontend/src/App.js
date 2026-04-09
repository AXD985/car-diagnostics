import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RadialGauge } from 'canvas-gauges';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const API_URL = "http://127.0.0.1:5000/api/obd2";
const CMD_URL = "http://127.0.0.1:5000/api/command";

// قاعدة بيانات الأعطال الكاملة (Expert Knowledge Base)
const DTC_DATABASE = {
  "P0011": { 
    sensor: "حساس VVT / عمود الكامات", 
    function: "التحكم في توقيت فتح وغلق صمامات المحرك.", 
    cause: "نقص زيت المحرك، اتساخ فلتر الزيت، أو تلف الحساس.", 
    fix: "تغيير الزيت والفلتر فوراً أو استبدال صمام VVT." 
  },
  "P0300": { 
    sensor: "نظام الاحتراق (Misfire)", 
    function: "تنسيق توقيت الشرارة داخل الأسطوانات.", 
    cause: "بواجي تالفة، كويلات ضعيفة، أو وقود ملوث.", 
    fix: "استبدال شمعات الاحتراق (البواجي) وفحص الكويلات." 
  },
  "P0101": { 
    sensor: "حساس الهواء (MAF)", 
    function: "قياس تدفق الهواء الداخل للمحرك.", 
    cause: "اتساخ الحساس أو وجود تسريب في خرطوم الهواء.", 
    fix: "تنظيف الحساس بمنظف الكترونيات خاص." 
  }
};

export default function App() {
  const [data, setData] = useState({ 
    rpm: 0, temp: 0, speed: 0, voltage: 12.6, load: 0, 
    vin: "SEARCHING...", dtc_code: "", throttle: 0, intake: 0,
    predicted_temp: 0 // تم إضافة التنبؤ هنا
  });
  const [history, setHistory] = useState([]);
  const [isDemo, setIsDemo] = useState(false);
  const [activeTab, setActiveTab] = useState('dash'); 
  const [freezeFrame, setFreezeFrame] = useState(null);
  const [aiInsights, setAiInsights] = useState([]);
  const [dbStatus, setDbStatus] = useState("IDLE");

  const rpmG = useRef(null);
  const tempG = useRef(null);

  // 1. حساب Health Score (المنطق الذي يمثل الذكاء الاصطناعي)
  const calculateHealth = () => {
    let score = 100;
    if (data.temp > 100) score -= (data.temp - 100) * 3;
    if (data.voltage < 12.4) score -= 15;
    if (data.load > 85) score -= 10;
    if (data.dtc_code) score -= 40;
    return Math.max(score, 0).toFixed(0);
  };

  // 2. دالة تحميل تقرير الرحلة (JSON Report) لتوثيق العمل
  const downloadReport = () => {
    const report = {
      project: "TITAN AI V8.0",
      vin: data.vin,
      timestamp: new Date().toLocaleString(),
      health_score: calculateHealth() + "%",
      max_metrics: {
        peak_rpm: Math.max(...history.map(h => h.rpm || 0)),
        peak_temp: Math.max(...history.map(h => h.temp || 0))
      },
      diagnostic_log: data.dtc_code ? `Detected Error: ${data.dtc_code}` : "All Systems Normal"
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TITAN_REPORT_${data.vin}.json`;
    link.click();
  };

  // 3. نظام إرسال الأوامر (Clear DTC)
  const clearErrors = async () => {
    try {
      const res = await fetch(CMD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: "04" })
      });
      const resData = await res.json();
      alert(resData.message);
      setFreezeFrame(null);
    } catch (e) { alert("Error connecting to backend"); }
  };

  useEffect(() => {
    // بناء العدادات فور التشغيل
    if (!rpmG.current) {
        rpmG.current = new RadialGauge({
            renderTo: 'rpm-gauge', width: 220, height: 220, units: 'RPM x1000',
            minValue: 0, maxValue: 8, colorPlate: '#050505', colorNumbers: '#00ffcc',
            majorTicks: ['0','1','2','3','4','5','6','7','8'], fontNumbersSize: 22,
            highlights: [{ from: 6, to: 8, color: 'rgba(255,0,0,.75)' }]
        }).draw();
        tempG.current = new RadialGauge({
            renderTo: 'temp-gauge', width: 220, height: 220, units: 'TEMP °C',
            minValue: 0, maxValue: 150, colorPlate: '#050505', colorNumbers: '#fff',
            majorTicks: ['0','30','60','90','120','150'], fontNumbersSize: 22,
            highlights: [{ from: 100, to: 150, color: '#ff1e1e' }]
        }).draw();
    }

    const fetchData = async () => {
      try {
        setDbStatus("SYNCING...");
        const res = await fetch(`${API_URL}?mode=${isDemo ? 'demo' : 'real'}`);
        const incoming = await res.json();
        
        setData(incoming);
        setHistory(prev => [...prev, incoming].slice(-30));
        setDbStatus("STORED");
        
        // تحديث العدادات
        if (rpmG.current) rpmG.current.value = incoming.rpm / 1000;
        if (tempG.current) tempG.current.value = incoming.temp;
        
        // حفظ أول لحظة يظهر فيها العطل (Freeze Frame)
        if (incoming.dtc_code && !freezeFrame) setFreezeFrame(incoming);

        // منطق الـ AI Insights
        let logs = [];
        if (incoming.temp > 102) logs.push("⚠️ خطر: ارتفاع حاد في الحرارة المفقودة.");
        if (incoming.voltage < 12.5) logs.push("🔋 تنبيه: الجهد الكهربائي غير مستقر.");
        if (incoming.predicted_temp > 105) logs.push("🧠 تنبؤ: المحرك سيصل لدرجة حرارة حرجة قريباً.");
        setAiInsights(logs);

        setTimeout(() => setDbStatus("IDLE"), 500);
      } catch (e) { setDbStatus("OFFLINE"); }
    };

    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [isDemo, freezeFrame]);

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', direction: 'rtl', fontFamily: 'Arial' }}>
      
      {/* Navigation Bar */}
      <nav style={{ background: '#111', padding: '15px', display: 'flex', gap: '20px', borderBottom: '2px solid #00ffcc', alignItems: 'center' }}>
        <div>
            <h2 style={{ margin: 0, color: '#00ffcc', fontSize: '1.2rem' }}>TITAN AI V10.0</h2>
            <small style={{ color: '#666' }}>DB STATUS: <span style={{ color: '#00ff00' }}>{dbStatus}</span></small>
        </div>
        <button onClick={() => setActiveTab('dash')} style={navBtnStyle(activeTab === 'dash')}>لوحة التحكم</button>
        <button onClick={() => setActiveTab('help')} style={navBtnStyle(activeTab === 'help')}>الشرح العلمي</button>
        <button onClick={downloadReport} style={{ background: '#ffae00', color: '#000', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>تحميل تقرير 📄</button>
        <div style={{ marginRight: 'auto', display: 'flex', gap: '10px' }}>
            <button onClick={() => setIsDemo(!isDemo)} style={{ background: isDemo ? '#ffae00' : '#222', color: '#fff', border: 'none', padding: '10px', borderRadius: '5px' }}>
              {isDemo ? 'وضع العرض نشط' : 'الوضع الحقيقي نشط'}
            </button>
        </div>
      </nav>

      {activeTab === 'dash' ? (
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '320px 1fr 320px', gap: '20px' }}>
          
          {/* Column 1: Health Score, AI Log & Prediction */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#080808', padding: '30px', borderRadius: '25px', textAlign: 'center', border: '1px solid #222' }}>
              <h3 style={{ color: '#00ffcc', margin: '0 0 10px 0' }}>كفاءة المحرك</h3>
              <div style={{ fontSize: '4rem', color: calculateHealth() > 70 ? '#00ff00' : '#ff1e1e' }}>{calculateHealth()}%</div>
              <p>{calculateHealth() > 70 ? 'الأنظمة بحالة جيدة' : 'يتطلب صيانة فورية'}</p>
            </div>

            <div style={{ background: '#051010', padding: '20px', borderRadius: '25px', border: '2px solid #00ffcc' }}>
              <h4 style={{ color: '#00ffcc', marginTop: 0 }}>🧠 تنبؤ AI (الحرارة)</h4>
              <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: data.predicted_temp > 100 ? '#ff1e1e' : '#00ffcc' }}>
                {data.predicted_temp}°C
              </div>
              <p style={{ fontSize: '0.7rem', color: '#666' }}>توقع الحالة بعد 10 ثوانٍ بناءً على الحمل {data.load}%</p>
            </div>
            
            <div style={{ background: '#080808', padding: '20px', borderRadius: '25px', border: '1px solid #333', height: '180px', overflowY: 'auto' }}>
              <h4 style={{ color: '#00ffcc', marginTop: 0 }}>TITAN AI LOG 🤖</h4>
              {aiInsights.map((msg, i) => <div key={i} style={{ marginBottom: '10px', fontSize: '0.85rem', borderRight: '3px solid #00ffcc', paddingRight: '10px' }}>{msg}</div>)}
              {aiInsights.length === 0 && <div style={{ color: '#00ff00', fontSize: '0.85rem' }}>✅ الأنظمة مستقرة.</div>}
            </div>
          </div>

          {/* Column 2: Visual Gauges & Live Comparison Graph */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px' }}>
              <canvas id="rpm-gauge"></canvas>
              <canvas id="temp-gauge"></canvas>
            </div>
            <div style={{ height: '300px', background: '#080808', borderRadius: '25px', padding: '20px', border: '1px solid #111' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>مقارنة الحرارة اللحظية بالتنبؤ المستقبلي</h4>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis hide />
                  <YAxis stroke="#444" />
                  <Tooltip contentStyle={{ background: '#000', border: '1px solid #00ffcc' }} />
                  <Legend />
                  <Line type="monotone" dataKey="temp" stroke="#00ffcc" strokeWidth={3} name="الحرارة الحالية" dot={false} />
                  <Line type="monotone" dataKey="predicted_temp" stroke="#ff1e1e" strokeDasharray="5 5" name="توقع AI" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Column 3: Diagnostic Info & DB Monitor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#111', padding: '20px', borderRadius: '25px', border: '1px solid #ff1e1e' }}>
              <h4 style={{ margin: '0 0 15px 0' }}>الأعطال المكتشفة</h4>
              <div style={{ fontSize: '1.8rem', color: '#ff1e1e' }}>{data.dtc_code || "No Errors"}</div>
              {data.dtc_code && DTC_DATABASE[data.dtc_code] && (
                <div style={{ fontSize: '0.8rem', marginTop: '10px', color: '#ccc' }}>
                  <b>الحساس:</b> {DTC_DATABASE[data.dtc_code].sensor}<br/>
                  <b>الإصلاح:</b> {DTC_DATABASE[data.dtc_code].fix}
                </div>
              )}
            </div>

            <div style={{ background: '#080808', padding: '20px', borderRadius: '25px', border: '1px solid #222' }}>
              <h4 style={{ color: '#0066ff', marginTop: 0, fontSize: '0.9rem' }}>💾 سجل قاعدة البيانات الحية</h4>
              <div style={{ height: '120px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.7rem', color: '#00ff00' }}>
                {history.slice().reverse().map((entry, idx) => (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {`> SAVE: T=${entry.temp} L=${entry.load}% OK`}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#080808', padding: '20px', borderRadius: '25px', fontSize: '0.85rem' }}>
              <h4 style={{ color: '#ffae00', marginTop: 0 }}>❄️ Freeze Frame Data</h4>
              {freezeFrame ? (
                <div>تعطل النظام عند: {freezeFrame.rpm} RPM | {freezeFrame.temp}°C</div>
              ) : "لا توجد بيانات حرجة."}
            </div>

            <button onClick={clearErrors} style={{ padding: '15px', background: '#1a0000', color: '#ff1e1e', border: '1px solid #ff1e1e', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}>
              مسح ذاكرة الأعطال (DTC Clear)
            </button>
          </div>

        </div>
      ) : (
        <div style={{ padding: '50px', maxWidth: '900px', margin: '0 auto', lineHeight: '2' }}>
          <h2 style={{ color: '#00ffcc', borderBottom: '2px solid #00ffcc' }}>الشرح العلمي لهندسة TITAN AI V10</h2>
          <h3>1. نظام التنبؤ التلقائي (Predictive AI)</h3>
          <p>تم دمج خوارزمية <b>Linear Regression</b> مبسطة تقوم بتحليل الجهد اللحظي (Engine Load) للتنبؤ بارتفاع الحرارة قبل وقوعه، مما يسمح بحماية المحرك من التلف الحراري.</p>
          <h3>2. قاعدة البيانات المستمرة (Data Persistence)</h3>
          <p>النظام مربوط بقاعدة بيانات <b>JSON-based</b> في الخلفية، حيث يتم أرشفة كل حالة للحساسات مع طابع زمني دقيق لتمكين تحليل الرحلة لاحقاً.</p>
          <h3>3. معايير الصحة المتقدمة</h3>
          <p>يتم احتساب الـ Health Score بناءً على مصفوفة أوزان تربط بين فولتية البطارية، حرارة سائل التبريد، ووجود أكواد DTC النشطة.</p>
        </div>
      )}
    </div>
  );
}

const navBtnStyle = (active) => ({
  background: active ? '#00ffcc' : 'transparent',
  color: active ? '#000' : '#fff',
  border: '1px solid #00ffcc',
  padding: '10px 20px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  marginLeft: '10px'
});