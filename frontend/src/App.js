import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RadialGauge } from 'canvas-gauges';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer } from 'recharts';

/**
 * TITAN PRO MAX V5.7 - ELITE PERFORMANCE EDITION
 * الميزات المضافة: محلل الأداء الذكي (Logic-based Analysis)
 */

const API_URL = "https://car-diagnostics-b600.onrender.com/api/obd2";
const CMD_URL = "https://car-diagnostics-b600.onrender.com/api/command";

export default function App() {
  const [data, setData] = useState({ 
    rpm: 0, temp: 0, speed: 0, voltage: 12.6, load: 0, 
    vin: "", dtc_code: "", throttle: 0, intake: 0, timing: 0 
  });
  const [history, setHistory] = useState([]);
  const [activeError, setActiveError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [freezeFrame, setFreezeFrame] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const rpmG = useRef(null);
  const tempG = useRef(null);

  const geminiDatabase = useMemo(() => ({
    "p0011": "خلل في توقيت عمود الكامات (Camshaft). افحص مستوى ونظافة الزيت وحساس الـ VVT.",
    "p0300": "احتراق غير منتظم عشوائي (Misfire). افحص البواجي والكويلات فوراً.",
    "p0101": "مشكلة في مستشعر تدفق الهواء (MAF). تسبب تفتفة وضعف تسارع.",
    "p0171": "خليط هواء ووقود فقير. افحص تهريب الفاكيوم أو البخاخات.",
    "حرارة": "تحذير: ارتفاع الحرارة خطر! افحص مستوى سائل التبريد والمراوح.",
    "زيت": "الزيت الأسود جداً يحتاج تغيير. اللون الحليبي يعني خلط ماء (مشكلة رأس مكينة).",
    "تفتفة": "غالباً بسبب اتساخ البوابة (Throttle) أو تلف البواجي والكويلات."
  }), []);

  // --- إضافة محلل الأداء الذكي (Logic Analyzer) ---
  const performanceStatus = useMemo(() => {
    if (!isConnected) return "بانتظار البيانات لبدء التحليل...";
    
    const { rpm, throttle, load, voltage } = data;

    // 1. تحليل ضعف العزم (كتمة)
    if (throttle > 60 && rpm < 2500 && load > 80) {
      return "⚠️ ملاحظة: حمل مرتفع مع RPM منخفض. قد يكون هناك ضعف في سحب الهواء أو كتمة في العادم.";
    }
    // 2. تحليل جهد الكهرباء
    if (voltage < 13.0 && rpm > 1000) {
      return "🔋 تنبيه: الجهد منخفض أثناء الدوران. افحص كفاءة الدينامو (Alternator).";
    }
    // 3. تحليل القيادة الرياضية
    if (rpm > 5000) {
      return "🔥 أداء عالي: المحرك في نطاق القوة القصوى (Power Band).";
    }
    // 4. تحليل كفاءة التبريد عند الضغط
    if (data.temp > 105 && rpm > 3000) {
      return "🌡️ تحذير: الحرارة ترتفع مع الضغط العالي. خفف السرعة فوراً.";
    }

    return "✅ جميع الأنظمة تعمل بتناغم مثالي حالياً.";
  }, [data, isConnected]);

  const sendOBDCommand = async (mode) => {
    try {
      const response = await fetch(CMD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: mode })
      });
      if (response.ok) {
        if (mode === "04") {
          alert("🚀 Mode 04: تم مسح الأعطال وإعادة ضبط الحساسات.");
          setActiveError(null);
          setFreezeFrame(null);
        } else if (mode === "03") {
          alert("🔍 Mode 03: جاري فحص كمبيوتر السيارة للبحث عن أعطال مخزنة...");
        }
      }
    } catch (e) { alert("❌ فشل الاتصال بالسيرفر"); }
  };

  const getCarMake = (vin) => {
    if (!vin) return "بانتظار البيانات...";
    const prefix = vin.substring(0, 3).toUpperCase();
    const map = {
      "WBA": "BMW 🇩🇪", "WDC": "Mercedes 🇩🇪", "WAU": "Audi 🇩🇪", "JT1": "Toyota 🇯🇵",
      "JHM": "Honda 🇯🇵", "KMH": "Hyundai 🇰🇷", "KNA": "Kia 🇰🇷", "1FA": "Ford 🇺🇸"
    };
    return map[prefix] || "مركبة عامة (Generic Car)";
  };

  useEffect(() => {
    rpmG.current = new RadialGauge({
      renderTo: 'rpm-gauge', width: 220, height: 220, units: 'RPM x1000',
      minValue: 0, maxValue: 8, majorTicks: ['0','1','2','3','4','5','6','7','8'],
      highlights: [{ from: 6.5, to: 8, color: 'rgba(200, 0, 0, .8)' }],
      colorPlate: '#050505', colorNumbers: '#00ffcc', needleType: 'arrow', valueBox: true
    }).draw();

    tempG.current = new RadialGauge({
      renderTo: 'temp-gauge', width: 220, height: 220, units: 'TEMP °C',
      minValue: 0, maxValue: 150, majorTicks: ['0','30','60','90','120','150'],
      colorPlate: '#050505', colorNumbers: '#fff'
    }).draw();

    const fetchLiveData = async () => {
      try {
        const response = await fetch(API_URL);
        const incoming = await response.json();
        setIsConnected(true);
        setData(prev => ({ ...prev, ...incoming }));
        
        if (rpmG.current) rpmG.current.value = (incoming.rpm || 0) / 1000;
        if (tempG.current) tempG.current.value = incoming.temp || 0;

        if (incoming.dtc_code && !freezeFrame) {
            setFreezeFrame({
                code: incoming.dtc_code,
                speed: incoming.speed,
                temp: incoming.temp,
                rpm: incoming.rpm,
                time: new Date().toLocaleTimeString()
            });
        }

        setHistory(prev => [...prev, { rpm: incoming.rpm || 0 }].slice(-30));
        
        const code = incoming.dtc_code?.toLowerCase().trim();
        if (code && geminiDatabase[code]) {
          setActiveError({ code: incoming.dtc_code.toUpperCase(), desc: geminiDatabase[code] });
        } else { setActiveError(null); }
      } catch (e) { setIsConnected(false); }
    };

    const interval = setInterval(fetchLiveData, 1000);
    return () => clearInterval(interval);
  }, [geminiDatabase, freezeFrame]);

  const allSensors = [
    { label: 'السرعة', val: data.speed, unit: 'km/h', color: '#fff' },
    { label: 'الجهد', val: data.voltage, unit: 'V', color: '#00ffcc' },
    { label: 'الحمل', val: data.load, unit: '%', color: '#fff' },
    { label: 'البوابة', val: data.throttle, unit: '%', color: '#fff' },
    { label: 'الهواء الداخل', val: data.intake || 0, unit: '°C', color: '#fff' },
    { label: 'التوقيت', val: data.timing || 0, unit: '°', color: '#fff' }
  ];

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '15px', direction: 'rtl', fontFamily: 'Arial' }}>
      
      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <h1 style={{ color: '#00ffcc', margin: 0, fontSize: '1.4rem' }}>TITAN PRO MAX V5.7</h1>
          <small style={{color: isConnected ? '#00ff00' : '#ff1e1e'}}>{isConnected ? "● ONLINE" : "○ OFFLINE"}</small>
        </div>
        <input 
          type="text" placeholder="🔍 ابحث ميكانيكياً..." 
          style={{ flex: 1, maxWidth: '350px', padding: '10px', borderRadius: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #333' }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 2. Identity Card */}
      <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #222', marginBottom: '15px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, color: '#00ffcc', fontSize: '1.1rem' }}>{getCarMake(data.vin)}</h2>
          <code style={{ color: '#444' }}>VIN: {data.vin || "---"}</code>
        </div>
        <div style={{ fontSize: '1.8rem' }}>{data.vin?.startsWith("W") ? "🇩🇪" : "🚗"}</div>
      </div>

      {/* 3. Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: '15px' }}>
        
        {/* Column 1: Gauges */}
        <div style={{ background: '#080808', padding: '15px', borderRadius: '25px', textAlign: 'center', border: '1px solid #111' }}>
          <canvas id="rpm-gauge"></canvas>
          <small style={{color: '#00ffcc', display: 'block', margin: '5px 0'}}>Engine RPM</small>
          <hr style={{borderColor: '#111', margin: '15px 0'}} />
          <canvas id="temp-gauge"></canvas>
          <small style={{display: 'block'}}>Coolant Temp</small>
        </div>

        {/* Column 2: Graph & Sensors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ height: '220px', background: '#080808', padding: '10px', borderRadius: '25px', border: '1px solid #111' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
                <Area type="monotone" dataKey="rpm" stroke="#00ffcc" fill="#00ffcc08" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {allSensors.map((s, i) => (
              <div key={i} style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #111', textAlign: 'center' }}>
                <small style={{ color: '#444', display: 'block' }}>{s.label}</small>
                <strong style={{ fontSize: '1.1rem', color: s.color }}>{s.val} <small style={{fontSize: '0.6rem'}}>{s.unit}</small></strong>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Pro Tools & AI Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ background: '#0a0a0a', padding: '15px', borderRadius: '20px', border: '2px solid #ff1e1e' }}>
            <h4 style={{ color: '#ff1e1e', marginTop: 0, marginBottom: '10px' }}>🛠️ أدوات الفحص</h4>
            <button onClick={() => sendOBDCommand("03")} style={{ width: '100%', padding: '10px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' }}>🔍 فحص (Mode 03)</button>
            <button onClick={() => sendOBDCommand("04")} style={{ width: '100%', padding: '10px', backgroundColor: '#ff1e1e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ مسح (Mode 04)</button>
          </div>

          {freezeFrame && (
            <div style={{ background: '#00ffcc08', padding: '12px', borderRadius: '15px', border: '1px solid #00ffcc44' }}>
              <strong style={{ color: '#00ffcc', fontSize: '0.85rem' }}>📸 Freeze Frame:</strong>
              <div style={{ fontSize: '0.75rem', marginTop: '5px', color: '#ccc', lineHeight: '1.4' }}>
                • العطل: {freezeFrame.code}<br/>
                • السرعة: {freezeFrame.speed} كم/س | • RPM: {freezeFrame.rpm}<br/>
                • الوقت: {freezeFrame.time}
              </div>
            </div>
          )}

          {/* قسم محلل تيتان الذكي المحدث */}
          <div style={{ background: '#080808', padding: '15px', borderRadius: '20px', border: '1px solid #333', flex: 1 }}>
            <h4 style={{ color: '#00ffcc', margin: '0 0 10px 0' }}>✨ تحليل تيتان الذكي</h4>
            
            {/* عرض حالة الأداء المعتمدة على المنطق */}
            <div style={{ padding: '10px', background: '#111', borderRadius: '10px', fontSize: '0.8rem', color: '#00ffcc', marginBottom: '10px', borderRight: '3px solid #00ffcc' }}>
               {performanceStatus}
            </div>

            {activeError && (
              <div style={{ padding: '10px', background: '#ff1e1e15', borderRadius: '10px', border: '1px solid #ff1e1e33' }}>
                <strong style={{color: '#ff4d4d', fontSize: '0.85rem'}}>⚠️ {activeError.code}</strong>
                <p style={{fontSize: '0.75rem', color: '#eee'}}>{activeError.desc}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}