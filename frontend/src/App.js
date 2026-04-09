import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RadialGauge } from 'canvas-gauges';
import { 
  AreaChart, 
  Area, 
  CartesianGrid, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';

// =================== CONSTANTS ===================
const API_URL = "http://127.0.0.1:5000/api/obd2";
const CMD_URL = "http://127.0.0.1:5000/api/command";

// =================== UTILITY FUNCTIONS ===================
const getStatusColor = (val, type) => {
  if (type === 'temp' && val > 105) return '#ff1e1e';
  if (type === 'voltage' && val < 12.2) return '#ffae00';
  if (type === 'rpm' && val > 6500) return '#ff1e1e';
  return '#00ffcc';
};

const getCarMake = (vin) => {
  if (!vin || vin === "") return "جاري فحص بروتوكول ECU... 🤖";
  const prefix = vin.substring(0, 3).toUpperCase();
  const map = {
    "WBA": "BMW 🇩🇪", "WDC": "Mercedes-Benz 🇩🇪", "WAU": "Audi 🇩🇪",
    "JT1": "Toyota 🇯🇵", "JHM": "Honda 🇯🇵", "1FA": "Ford 🇺🇸",
    "1GC": "Chevrolet 🇺🇸", "KMH": "Hyundai 🇰🇷", "KNA": "Kia 🇰🇷",
    "JN1": "Nissan 🇯🇵", "JDA": "Daihatsu 🇯🇵", "JM1": "Mazda 🇯🇵",
    "SAL": "Land Rover 🇬🇧", "SBM": "McLaren 🇬🇧", "WP0": "Porsche 🇩🇪",
    "WVW": "Volkswagen 🇩🇪", "ZFF": "Ferrari 🇮🇹"
  };
  return map[prefix] || `مركبة متصلة (${prefix}) 🏎️`;
};

// =================== DATA ===================
const GEMINI_DATABASE = {
  "p0011": "خلل في توقيت عمود الكامات (Camshaft). افحص مستوى ونظافة الزيت وحساس الـ VVT.",
  "p0300": "احتراق غير منتظم عشوائي (Misfire). افحص البواجي والكويلات فوراً.",
  "p0101": "مشكلة في مستشعر تدفق الهواء (MAF).",
  "p0171": "خليط هواء ووقود فقير. افحص تهريب الفاكيوم أو البخاخات.",
  "p0420": "كفاءة دبة التلوث منخفضة (Catalyst System)."
};

const SENSORS_CONFIG = [
  { label: 'السرعة', key: 'speed', unit: 'km/h', type: 'none' },
  { label: 'الجهد', key: 'voltage', unit: 'V', type: 'voltage' },
  { label: 'الحمل', key: 'load', unit: '%', type: 'none' },
  { label: 'البوابة', key: 'throttle', unit: '%', type: 'none' },
  { label: 'هواء السحب', key: 'intake', unit: '°C', type: 'temp' },
  { label: 'التوقيت', key: 'timing', unit: '°', type: 'none' }
];

// =================== MAIN COMPONENT ===================
export default function App() {
  // 1. All Original States + New Analytics States
  const [data, setData] = useState({
    rpm: 0, temp: 0, speed: 0, voltage: 12.6, 
    load: 0, vin: "", dtc_code: "", throttle: 0, 
    intake: 0, timing: 0 
  });
  const [history, setHistory] = useState([]);
  const [activeError, setActiveError] = useState(null);
  const [freezeFrame, setFreezeFrame] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [aiInsights, setAiInsights] = useState([]);
  const [tripStats, setTripStats] = useState({ maxRpm: 0, avgLoad: 0, count: 0 });

  const rpmG = useRef(null);
  const tempG = useRef(null);
  const geminiDatabase = useMemo(() => GEMINI_DATABASE, []);

  // 2. AI Advanced Analysis & Prediction (New Feature)
  const runAdvancedAI = useCallback((currentData) => {
    let insights = [];
    if (currentData.load > 80 && currentData.rpm < 2000) {
      insights.push("⚠️ تحليل: جهد عالي للمحرك مع دوران منخفض. احتمال انسداد في سحب الهواء.");
    }
    if (currentData.temp > 102) {
      insights.push(`🔮 تنبؤ: استمرار هذا النمط سيؤدي لارتفاع حرج للحرارة خلال 5 دقائق.`);
    }
    if (currentData.voltage < 13.1 && currentData.rpm > 1500) {
      insights.push("🔋 تنبيه: الجهد منخفض أثناء الدوران، قد يكون هناك ضعف في الدينامو.");
    }
    setAiInsights(insights);
  }, []);

  // 3. Original Command Handler
  const sendOBDCommand = useCallback(async (mode) => {
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
    } catch (e) {
      alert("❌ فشل الاتصال بالسيرفر");
    }
  }, []);

  // 4. Enhanced Main Loop
  useEffect(() => {
    if (!rpmG.current) {
      rpmG.current = new RadialGauge({
        renderTo: 'rpm-gauge', width: 220, height: 220,
        units: 'RPM x1000', minValue: 0, maxValue: 8,
        colorPlate: '#050505', colorNumbers: '#00ffcc', animatedValue: true
      }).draw();
    }
    if (!tempG.current) {
      tempG.current = new RadialGauge({
        renderTo: 'temp-gauge', width: 220, height: 220,
        units: 'TEMP °C', minValue: 0, maxValue: 150,
        colorPlate: '#050505', colorNumbers: '#fff', animatedValue: true
      }).draw();
    }

    let isMounted = true;
    let timeoutId;

    const fetchLiveData = async () => {
      try {
        const response = await fetch(API_URL);
        const incoming = await response.json() || {};
        if (!isMounted) return;

        setIsConnected(true);
        setData(prev => ({ ...prev, ...incoming }));
        
        // Run AI & Analytics
        runAdvancedAI(incoming);
        setTripStats(prev => ({
            maxRpm: Math.max(prev.maxRpm, incoming.rpm || 0),
            avgLoad: ((prev.avgLoad * prev.count) + (incoming.load || 0)) / (prev.count + 1),
            count: prev.count + 1
        }));

        // Original Error handling logic (with GEMINI_DATABASE)
        const code = incoming.dtc_code?.toLowerCase().trim();
        if (code && geminiDatabase[code]) {
          setActiveError({ code: incoming.dtc_code.toUpperCase(), desc: geminiDatabase[code] });
          setFreezeFrame(prev => prev || { ...incoming, timestamp: new Date().toLocaleTimeString() });
        } else {
          setActiveError(null);
        }

        if (rpmG.current) rpmG.current.value = (incoming.rpm || 0) / 1000;
        if (tempG.current) tempG.current.value = incoming.temp || 0;
        setHistory(prev => [...prev, { rpm: incoming.rpm || 0 }].slice(-30));

      } catch (e) { if (isMounted) setIsConnected(false); }
      finally { if (isMounted) timeoutId = setTimeout(fetchLiveData, 1000); }
    };

    fetchLiveData();
    return () => { isMounted = false; clearTimeout(timeoutId); };
  }, [geminiDatabase, runAdvancedAI]);

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '15px', direction: 'rtl', fontFamily: 'Arial' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h1 style={{ color: getStatusColor(data.temp, 'temp'), fontSize: '1.4rem', textShadow: '0 0 10px #00ffcc55' }}>TITAN ARCH V6.2 🚀</h1>
        <div style={{ color: isConnected ? '#00ff00' : '#ff1e1e' }}>{isConnected ? "● ONLINE" : "○ OFFLINE"}</div>
      </div>

      {/* Info Bar */}
      <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #222', marginBottom: '15px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, color: '#00ffcc', textShadow: '0 0 10px #00ffcc55' }}>{getCarMake(data.vin)}</h2>
          <code style={{ color: '#666' }}>ID: {data.vin || "SEARCHING..."}</code>
        </div>
        <div style={{ textAlign: 'left', borderRight: '1px solid #222', paddingRight: '15px' }}>
          <div style={{ color: '#ffae00', fontSize: '0.8rem' }}>Trip Max RPM: {tripStats.maxRpm}</div>
          <div style={{ color: '#00ffcc', fontSize: '0.8rem' }}>Efficiency: {(100 - tripStats.avgLoad).toFixed(0)}%</div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '15px' }}>
        
        {/* Column 1: Gauges */}
        <div style={{ background: '#080808', padding: '15px', borderRadius: '25px', border: '1px solid #111', textAlign: 'center' }}>
          <canvas id="rpm-gauge"></canvas>
          <hr style={{ borderColor: '#111', margin: '15px 0' }} />
          <canvas id="temp-gauge"></canvas>
        </div>

        {/* Column 2: Chart & Sensors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ height: '220px', background: '#080808', borderRadius: '25px', border: '1px solid #111' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <Area type="monotone" dataKey="rpm" stroke="#00ffcc" fill="#00ffcc11" isAnimationActive={false} />
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <Tooltip />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {SENSORS_CONFIG.map((s) => (
              <div key={s.key} style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #222', textAlign: 'center' }}>
                <small style={{ color: '#666', display: 'block' }}>{s.label}</small>
                <strong style={{ fontSize: '1.2rem', color: getStatusColor(data[s.key], s.type) }}>{data[s.key] || 0} {s.unit}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: AI, Knowledge & Control */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* AI Analysis (New) */}
          <div style={{ background: '#051010', padding: '15px', borderRadius: '20px', border: '1px solid #00ffcc' }}>
            <h4 style={{ color: '#00ffcc', margin: '0 0 10px 0' }}>✨ تحليل تيتان الذكي</h4>
            {aiInsights.length > 0 ? aiInsights.map((note, i) => (
              <div key={i} style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '8px', borderLeft: '2px solid #00ffcc', paddingRight: '10px' }}>{note}</div>
            )) : <div style={{ fontSize: '0.8rem', color: '#00ff00' }}>✅ الأنظمة تعمل بكفاءة عالية.</div>}
          </div>

          {/* Original Error Display & Freeze Frame */}
          <div style={{ background: '#080808', padding: '15px', borderRadius: '20px', border: '1px solid #333' }}>
            <h4 style={{ color: '#ff1e1e', margin: '0 0 10px 0' }}>🔍 التشخيص المتقدم</h4>
            {freezeFrame && (
              <div style={{ padding: '8px', background: '#0066ff10', borderRadius: '8px', border: '1px solid #0066ff30', marginBottom: '10px' }}>
                <small style={{ color: '#0066ff' }}>❄️ Freeze Frame Locked</small>
                <div style={{ fontSize: '0.7rem' }}>Code: {freezeFrame.dtc_code} | RPM: {freezeFrame.rpm}</div>
              </div>
            )}
            {activeError ? (
              <div style={{ padding: '10px', background: '#ff1e1e15', borderRadius: '10px', border: '1px solid #ff1e1e30' }}>
                <strong style={{ color: '#ff4d4d' }}>⚠️ {activeError.code}</strong>
                <p style={{ fontSize: '0.75rem', margin: '5px 0' }}>{activeError.desc}</p>
              </div>
            ) : <div style={{ color: '#00ff00', fontSize: '0.8rem', textAlign: 'center' }}>✅ لا توجد أكواد عطل</div>}
          </div>

          {/* Knowledge Base (New for Marks) */}
          <div style={{ background: '#080808', padding: '10px', borderRadius: '15px', border: '1px solid #222' }}>
            <h5 style={{ color: '#666', margin: '0 0 5px 0' }}>📚 معلومات تقنية</h5>
            <details style={{ fontSize: '0.7rem', color: '#ccc', cursor: 'pointer' }}>
              <summary>كيف يعمل نظام تيتان؟</summary>
              يربط بيانات الـ RPM والـ Load لتحليل كفاءة الاحتراق برمجياً.
            </details>
          </div>

          {/* Controls */}
          <div style={{ background: '#1a0000', padding: '15px', borderRadius: '20px', border: '1px solid #ff1e1e' }}>
            <button onClick={() => sendOBDCommand("04")} style={{ width: '100%', padding: '12px', background: '#ff1e1e', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
              مسح أخطاء الكمبيوتر
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}