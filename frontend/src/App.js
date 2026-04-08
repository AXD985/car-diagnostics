import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RadialGauge } from 'canvas-gauges';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * نظام TITAN PRO MAX V5.5 - النسخة الشاملة والمستقرة
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
    "p0016": "عدم تطابق إشارة الكرنك والكام شفت. قد يكون بسبب تمدد جنزير الماكينة (Timing Chain).",
    "p0087": "ضغط مسطرة الوقود منخفض جداً. افحص طرمبة البنزين الضغط العالي (HPFP) أو فلتر البنزين.",
    "p0101": "مشكلة في مستشعر تدفق الهواء (MAF). تسبب تفتفة، ضعف تسارع، وزيادة استهلاك الوقود.",
    "p0115": "عطل مستشعر حرارة المحرك. قد يسبب غليان الماء أو عمل المراوح بأقصى سرعة دائماً.",
    "p0121": "خلل في إشارة حساس بوابة الهواء (TPS). يسبب تعليق في سرعة المحرك أو عدم استجابة للدعسة.",
    "p0300": "احتراق غير منتظم عشوائي (Misfire). افحص البواجي، الكويلات، وضفيرة الاحتراق فوراً.",
    "u0121": "فقدان الاتصال مع وحدة الـ ABS. مشكلة في ضفيرة الـ CAN-Bus أو فيوز نظام الفرامل.",
    "حرارة": "تحذير: ارتفاع الحرارة خطر! افحص مستوى سائل التبريد، بلف الحرارة، والمراوح، وطرمبة الماء.",
    "زيت": "الزيت الأسود يقلل عمر المحرك. اللون الحليبي يعني خلط ماء (تلف وجه الرأس).",
    "تفتفة": "غالباً بسبب اتساخ البوابة (Throttle)، تلف البواجي، الكويلات، أو كراسي المحرك.",
    "قير": "نتعة القير تعني نقص زيت أو اتساخ الفلتر. يتغير الزيت كل 60-80 ألف كم.",
  }), []);

  const handleClearCodes = async () => {
    try {
      await fetch(CMD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: "CLEAR_CODES" })
      });
      alert("🚀 تم إرسال أمر مسح الأعطال للسيارة بنجاح!");
      setActiveError(null);
      setFreezeFrame(null);
    } catch (e) { console.error("خطأ في الاتصال بالسيرفر"); }
  };

  const getCarMake = (vin) => {
    if (!vin || vin === "") return "بانتظار الاتصال بالمركبة...";
    const prefix = vin.substring(0, 3).toUpperCase();
    const map = {
      "WBA": "BMW (ألماني 🇩🇪)", "WBS": "BMW M-Series 🇩🇪", "WDC": "Mercedes-Benz 🇩🇪",
      "WAU": "Audi 🇩🇪", "JT1": "Toyota 🇯🇵", "JHM": "Honda 🇯🇵", "1FA": "Ford 🇺🇸", 
      "KMH": "Hyundai 🇰🇷", "KNA": "Kia 🇰🇷", "SAL": "Land Rover 🇬🇧"
    };
    return map[prefix] || "مركبة عامة (Generic Car)";
  };

  useEffect(() => {
    rpmG.current = new RadialGauge({
      renderTo: 'rpm-gauge', width: 200, height: 200, units: 'RPM x1000',
      minValue: 0, maxValue: 8, majorTicks: ['0','1','2','3','4','5','6','7','8'],
      highlights: [{ from: 6.5, to: 8, color: 'rgba(200, 0, 0, .8)' }],
      colorPlate: '#050505', colorNumbers: '#00ffcc', needleType: 'arrow', valueBox: true, animationDuration: 500
    }).draw();

    tempG.current = new RadialGauge({
      renderTo: 'temp-gauge', width: 200, height: 200, units: 'TEMP °C',
      minValue: 0, maxValue: 150, majorTicks: ['0','30','60','90','120','150'],
      colorPlate: '#050505', colorNumbers: '#fff', animationDuration: 800
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
            setFreezeFrame({ ...incoming, time: new Date().toLocaleTimeString() });
        }

        setHistory(prev => [...prev, { 
          rpm: incoming.rpm || 0, 
          time: new Date().toLocaleTimeString().slice(-5) 
        }].slice(-30));
        
        const errorCode = incoming.dtc_code?.toLowerCase().trim();
        if (errorCode && geminiDatabase[errorCode]) {
          setActiveError({ code: incoming.dtc_code.toUpperCase(), desc: geminiDatabase[errorCode] });
        } else { setActiveError(null); }

      } catch (error) { setIsConnected(false); }
    };

    const interval = setInterval(fetchLiveData, 1000); 
    return () => clearInterval(interval);
  }, [geminiDatabase, freezeFrame]);

  const aiResponse = useMemo(() => {
    if (!searchTerm) return "بانتظار استفسارك الميكانيكي...";
    const term = searchTerm.toLowerCase().trim();
    const key = Object.keys(geminiDatabase).find(k => term.includes(k) || k.includes(term));
    return key ? geminiDatabase[key] : "لم أجد هذا المصطلح.";
  }, [searchTerm, geminiDatabase]);

  const allSensors = [
    { label: 'السرعة', val: data.speed, unit: 'km/h', color: '#fff' },
    { label: 'الجهد', val: data.voltage, unit: 'V', color: '#00ffcc' },
    { label: 'حمل المحرك', val: data.load, unit: '%', color: '#fff' },
    { label: 'البوابة', val: data.throttle, unit: '%', color: '#fff' },
    { label: 'الهواء الداخل', val: data.intake || 0, unit: '°C', color: '#fff' },
    { label: 'توقيت الإشعال', val: data.timing || 0, unit: '°', color: '#fff' }
  ];

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '15px', direction: 'rtl', fontFamily: 'Arial', overflowX: 'hidden' }}>
      
      {/* 1. Header & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '10px' }}>
        <div>
          <h1 style={{ color: '#00ffcc', margin: 0, fontSize: '1.4rem' }}>TITAN PRO MAX V5.5</h1>
          <small style={{color: isConnected ? '#00ff00' : '#ff1e1e'}}>{isConnected ? "● النظام متصل" : "○ جاري الاتصال..."}</small>
        </div>
        <input 
          type="text" 
          placeholder="🔍 ابحث عن عطل أو قطعة..." 
          style={{ flex: 1, maxWidth: '350px', padding: '10px', borderRadius: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #333' }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 2. VIN & Identity Card */}
      <div style={{ background: 'linear-gradient(90deg, #080808 0%, #151515 100%)', padding: '12px 20px', borderRadius: '15px', border: '1px solid #222', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: '#00ffcc', fontSize: '1.1rem' }}>{getCarMake(data.vin)}</h2>
          <code style={{ color: '#555', fontSize: '0.8rem' }}>VIN: {data.vin || "---"}</code>
        </div>
        <div style={{ fontSize: '1.8rem' }}>{data.vin?.startsWith("W") ? "🇩🇪" : "🚗"}</div>
      </div>

      {/* 3. Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: '15px' }}>
        
        {/* العمود الأول: العدادات */}
        <div style={{ background: '#080808', padding: '15px', borderRadius: '20px', textAlign: 'center', border: '1px solid #111' }}>
          <div style={{marginBottom: '10px'}}><canvas id="rpm-gauge"></canvas></div>
          <small style={{color: '#00ffcc', display: 'block', marginBottom: '15px'}}>دوران المحرك</small>
          <canvas id="temp-gauge"></canvas>
          <small style={{color: '#fff', display: 'block'}}>درجة الحرارة</small>
        </div>

        {/* العمود الثاني: التحليل البياني والحساسات */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ height: '230px', background: '#080808', padding: '15px', borderRadius: '20px', border: '1px solid #111' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111" />
                <Area type="monotone" dataKey="rpm" stroke="#00ffcc" fill="#00ffcc11" isAnimationActive={false} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {allSensors.map((s, i) => (
              <div key={i} style={{ background: '#080808', padding: '12px', borderRadius: '15px', textAlign: 'center', border: '1px solid #111' }}>
                <small style={{ color: '#444', display: 'block' }}>{s.label}</small>
                <strong style={{ fontSize: '1.1rem', color: s.color }}>{s.val} <small style={{fontSize: '0.6rem'}}>{s.unit}</small></strong>
              </div>
            ))}
          </div>
        </div>

        {/* العمود الثالث: التشخيص والتحكم */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ background: '#0a0a0a', padding: '15px', borderRadius: '20px', border: '2px solid #ff1e1e' }}>
            <h4 style={{ color: '#ff1e1e', marginTop: 0, marginBottom: '10px', fontSize: '0.9rem' }}>🛠️ لوحة التحكم</h4>
            <button 
              onClick={handleClearCodes}
              style={{ width: '100%', padding: '12px', backgroundColor: '#ff1e1e', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
              🗑️ مسح أكواد الأعطال
            </button>
          </div>

          {freezeFrame && (
            <div style={{ background: '#00ffcc08', padding: '12px', borderRadius: '15px', border: '1px solid #00ffcc44' }}>
              <strong style={{ color: '#00ffcc', fontSize: '0.85rem' }}>📸 لقطة العطل:</strong>
              <div style={{ fontSize: '0.75rem', marginTop: '5px', color: '#ccc' }}>
                • السرعة: {freezeFrame.speed} كم/س | • الحرارة: {freezeFrame.temp}°C
              </div>
            </div>
          )}

          <div style={{ background: '#080808', padding: '15px', borderRadius: '20px', border: '1px solid #333' }}>
            <h4 style={{ color: '#00ffcc', margin: '0 0 10px 0', fontSize: '0.9rem' }}>✨ مساعد تيتان</h4>
            <p style={{ fontSize: '0.8rem', color: '#aaa' }}>{aiResponse}</p>
            {activeError && (
              <div style={{ marginTop: '10px', padding: '10px', background: '#ff1e1e15', borderRadius: '10px', border: '1px solid #ff1e1e33' }}>
                <strong style={{color: '#ff4d4d', fontSize: '0.85rem'}}>⚠️ تنبيه: {activeError.code}</strong>
                <p style={{fontSize: '0.75rem', color: '#eee'}}>{activeError.desc}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}