import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RadialGauge } from 'canvas-gauges';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * نظام TITAN PRO MAX V5.0 - الإصدار الاحترافي المتكامل
 * يجمع بين التشخيص الذكي، التحكم الثنائي، ومراقبة الأداء اللحظي
 */

const API_URL = "https://car-diagnostics-b600.onrender.com/api/obd2";
const CMD_URL = "https://car-diagnostics-b600.onrender.com/api/command";

export default function App() {
  // 1. إدارة البيانات والحالات
  const [data, setData] = useState({ 
    rpm: 0, temp: 0, speed: 0, voltage: 12.6, load: 0, 
    vin: "", dtc_code: "", throttle: 0, intake: 0, timing: 0 
  });
  const [history, setHistory] = useState([]);
  const [activeError, setActiveError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [freezeFrame, setFreezeFrame] = useState(null);

  const rpmG = useRef(null);
  const tempG = useRef(null);

  // 2. قاعدة بيانات تيتان الميكانيكية الشاملة
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

  // 3. دالة إرسال أمر مسح الأعطال
  const handleClearCodes = async () => {
    try {
      await fetch(CMD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: "CLEAR_CODES" })
      });
      alert("🚀 تم إرسال أمر مسح الأعطال للسيارة بنجاح!");
      setActiveError(null);
    } catch (e) { console.error("خطأ في الاتصال بالسيرفر"); }
  };

  // 4. نظام التعرف الذكي على هوية المركبة (VIN)
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

  // 5. محرك جلب البيانات والعدادات
  useEffect(() => {
    rpmG.current = new RadialGauge({
      renderTo: 'rpm-gauge', width: 300, height: 300, units: 'RPM x1000',
      minValue: 0, maxValue: 8, majorTicks: ['0','1','2','3','4','5','6','7','8'],
      highlights: [{ from: 6.5, to: 8, color: 'rgba(200, 0, 0, .8)' }],
      colorPlate: '#050505', colorNumbers: '#00ffcc', needleType: 'arrow', valueBox: true, animationDuration: 500
    }).draw();

    tempG.current = new RadialGauge({
      renderTo: 'temp-gauge', width: 300, height: 300, units: 'TEMP °C',
      minValue: 0, maxValue: 150, majorTicks: ['0','30','60','90','120','150'],
      colorPlate: '#050505', colorNumbers: '#fff', animationDuration: 800
    }).draw();

    const fetchLiveData = async () => {
      try {
        const response = await fetch(API_URL);
        const incoming = await response.json();
        const standardizedData = {
          ...incoming,
          rpm: incoming.rpm || 0, temp: incoming.temp || 0,
          vin: incoming.vin || "", dtc_code: incoming.dtc_code || ""
        };

        setData(standardizedData);
        if (rpmG.current) rpmG.current.value = standardizedData.rpm / 1000;
        if (tempG.current) tempG.current.value = standardizedData.temp;

        // تحديث لقطة العطل
        if (standardizedData.dtc_code && !freezeFrame) {
            setFreezeFrame({ ...standardizedData, time: new Date().toLocaleTimeString() });
        }

        setHistory(prev => [...prev, { 
          rpm: standardizedData.rpm, 
          load: standardizedData.load || 0, 
          time: new Date().toLocaleTimeString().slice(-5) 
        }].slice(-50));
        
        const errorCode = standardizedData.dtc_code?.toLowerCase().trim();
        if (errorCode && geminiDatabase[errorCode]) {
          setActiveError({ code: standardizedData.dtc_code.toUpperCase(), desc: geminiDatabase[errorCode] });
        } else { setActiveError(null); }

      } catch (error) { console.log("اتصال مفقود..."); }
    };

    const interval = setInterval(fetchLiveData, 1000); 
    return () => clearInterval(interval);
  }, [geminiDatabase, freezeFrame]);

  const aiResponse = useMemo(() => {
    if (!searchTerm) return "بانتظار استفسارك الميكانيكي (مثال: حرارة، زيت، P0300)...";
    const term = searchTerm.toLowerCase().trim();
    const key = Object.keys(geminiDatabase).find(k => term.includes(k) || k.includes(term));
    return key ? geminiDatabase[key] : "لم أجد هذا المصطلح، جرب كود عطل أو اسم قطعة.";
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
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '30px', direction: 'rtl', fontFamily: 'Arial' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: '15px', marginBottom: '30px' }}>
        <div>
          <h1 style={{ color: '#00ffcc', margin: 0, fontSize: '2.2rem' }}>TITAN PRO MAX</h1>
          <small style={{ color: '#444' }}>نظام التشخيص الميداني والتحكم الكامل</small>
        </div>
        <input 
          type="text" 
          placeholder="🔍 ابحث عن عطل أو قطعة ميكانيكية..." 
          style={{ width: '40%', padding: '12px 20px', borderRadius: '15px', border: '1px solid #222', backgroundColor: '#080808', color: '#00ffcc' }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* VIN Recognition Card */}
      <div style={{ background: 'linear-gradient(90deg, #080808 0%, #111 100%)', padding: '20px', borderRadius: '20px', marginBottom: '25px', border: '1px solid #00ffcc22', display: 'flex', alignItems: 'center', gap: '25px' }}>
          <div style={{ fontSize: '3.5rem' }}>
            {data.vin?.startsWith("W") ? "🇩🇪" : data.vin?.startsWith("J") ? "🇯🇵" : data.vin?.startsWith("1") ? "🇺🇸" : "🚗"}
          </div>
          <div>
              <h4 style={{ color: '#00ffcc', margin: 0 }}>هوية المركبة الذكية:</h4>
              <h2 style={{ margin: '5px 0' }}>{getCarMake(data.vin)}</h2>
              <code style={{ color: '#444' }}>VIN: {data.vin || "---"}</code>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '25px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {/* العدادات */}
          <div style={{ background: '#080808', padding: '30px', borderRadius: '30px', display: 'flex', justifyContent: 'space-around', border: '1px solid #111' }}>
              <div style={{textAlign: 'center'}}><canvas id="rpm-gauge"></canvas><h4 style={{color: '#00ffcc'}}>دوران المحرك</h4></div>
              <div style={{textAlign: 'center'}}><canvas id="temp-gauge"></canvas><h4 style={{color: '#fff'}}>درجة الحرارة</h4></div>
          </div>
          {/* الرسم البياني */}
          <div style={{ background: '#080808', padding: '25px', borderRadius: '25px', height: '350px', border: '1px solid #111' }}>
            <h3 style={{ color: '#333', marginBottom: '15px' }}>تحليل الأداء اللحظي</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111" />
                <Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #00ffcc'}} />
                <Area type="monotone" dataKey="rpm" stroke="#00ffcc" fill="#00ffcc11" strokeWidth={3} />
                <Area type="monotone" dataKey="load" stroke="#ffcc00" fill="#ffcc0011" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {/* لوحة التحكم الاحترافية - الميزة الجديدة */}
          <div style={{ background: '#080808', padding: '25px', borderRadius: '25px', border: '1px solid #ff1e1e44' }}>
             <h3 style={{ color: '#ff1e1e', marginTop: 0 }}>🛠️ أدوات التحكم والتشخيص</h3>
             <button 
               onClick={handleClearCodes}
               style={{ width: '100%', padding: '15px', borderRadius: '12px', border: 'none', backgroundColor: '#ff1e1e', color: '#fff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}>
               🗑️ مسح أكواد الأعطال (Reset)
             </button>
             
             {freezeFrame && (
               <div style={{ background: '#111', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
                 <strong style={{ color: '#aaa', fontSize: '0.8rem' }}>📸 لقطة العطل (Freeze Frame):</strong>
                 <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>
                   السرعة: {freezeFrame.speed} كم | RPM: {freezeFrame.rpm}<br/>
                   الحرارة: {freezeFrame.temp}°C | الوقت: {freezeFrame.time}
                 </p>
               </div>
             )}
          </div>

          {/* مساعد تيتان الذكي */}
          <div style={{ background: '#080808', padding: '25px', borderRadius: '25px', border: '1px solid #00ffcc44' }}>
            <h3 style={{ color: '#00ffcc', marginTop: 0 }}>✨ مساعد TITAN</h3>
            <p style={{ color: '#eee', background: '#0c0c0c', padding: '15px', borderRadius: '15px', borderRight: '4px solid #00ffcc' }}>{aiResponse}</p>
            {activeError && (
               <div style={{ marginTop: '15px', padding: '12px', background: '#ff1e1e22', borderRadius: '12px', color: '#ff4d4d', border: '1px solid #ff1e1e44' }}>
                 <strong>⚠️ عطل نشط: {activeError.code}</strong>
                 <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>{activeError.desc}</p>
               </div>
            )}
          </div>

          {/* شبكة الحساسات الستة الكاملة */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {allSensors.map((item, index) => (
              <div key={index} style={{ background: '#080808', padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid #111' }}>
                <small style={{ color: '#444' }}>{item.label}</small>
                <h2 style={{ margin: '5px 0', color: item.color }}>{item.val} <small style={{fontSize: '0.8rem'}}>{item.unit}</small></h2>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}