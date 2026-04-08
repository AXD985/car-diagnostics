import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RadialGauge } from 'canvas-gauges';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const API_URL = "http://127.0.0.1:5000/api/obd2";
const CMD_URL = "http://127.0.0.1:5000/api/command";

export default function App() {
  const [data, setData] = useState({ 
    rpm: 0, temp: 0, speed: 0, voltage: 12.6, load: 0, 
    vin: "", dtc_code: "", throttle: 0, intake: 0, timing: 0 
  });
  const [history, setHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeError, setActiveError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // --- حالات نظام الدردشة المضافة ---
  const [userQuery, setUserQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("أهلاً بك في Titan AI. يمكنك سؤالي عن حالة المحرك أو طلب نصيحة ميكانيكية.");
  const [isThinking, setIsThinking] = useState(false);

  const rpmG = useRef(null);
  const tempG = useRef(null);
  const timeoutIdRef = useRef(null);

  const aiEngine = useMemo(() => ({
    database: {
      "p0011": { title: "توقيت عمود الكامات (Camshaft)", advice: "افحص مستوى الزيت فوراً، قد يكون الحساس متسخاً." },
      "p0300": { title: "احتراق عشوائي (Misfire)", advice: "تجنب السرعات العالية. افحص البواجي والكويلات." },
      "p0101": { title: "حساس تدفق الهواء (MAF)", advice: "نظف حساس الهواء بمنتج مخصص وتأكد من إغلاق فلتر الهواء." },
      "p0171": { title: "خليط وقود فقير (Lean)", advice: "يوجد هواء زائد يدخل المحرك. افحص ليات الفاكيوم." },
      "p0420": { title: "كفاءة دبة التلوث (Catalyst)", advice: "الدبة لا تعمل بكفاءة. قد تحتاج لتنظيف أو استبدال حساس الأكسجين." }
    },
    analyzeStatus: (d) => {
      if (d.temp > 105) return { msg: "خطر: ارتفاع حرارة المحرك!", color: "#ff1e1e" };
      if (d.voltage < 11.5) return { msg: "تنبيه: جهد البطارية منخفض جداً", color: "#ffae00" };
      if (d.rpm > 7000) return { msg: "تحذير: دوران المحرك مرتفع جداً", color: "#ff1e1e" };
      return { msg: "جميع الأنظمة الحيوية مستقرة", color: "#00ffcc" };
    }
  }), []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);

    if (!rpmG.current) {
      rpmG.current = new RadialGauge({
        renderTo: 'rpm-gauge', width: 220, height: 220, units: 'RPM x1000',
        minValue: 0, maxValue: 8, colorPlate: '#050505', colorNumbers: '#00ffcc', 
        needleType: 'arrow', animatedValue: true, borders: false,
        highlights: [{ from: 6.5, to: 8, color: 'rgba(255,0,0,.75)' }]
      }).draw();
    }
    if (!tempG.current) {
      tempG.current = new RadialGauge({
        renderTo: 'temp-gauge', width: 220, height: 220, units: 'TEMP °C',
        minValue: 0, maxValue: 150, colorPlate: '#050505', colorNumbers: '#fff',
        highlights: [{ from: 100, to: 150, color: 'rgba(255,0,0,.75)' }]
      }).draw();
    }

    let isMounted = true;

    const fetchLiveData = async () => {
      try {
        const response = await fetch(API_URL);
        const incoming = await response.json();
        
        if (!isMounted) return;
        setIsConnected(true);
        setData(prev => ({ ...prev, ...incoming }));

        setHistory(prev => {
          const newPoint = { 
            time: new Date().toLocaleTimeString().split(' ')[0], 
            rpm: incoming.rpm || 0, 
            temp: incoming.temp || 0 
          };
          return [...prev.slice(-19), newPoint];
        });

        const code = incoming.dtc_code?.toLowerCase().trim();
        if (code && aiEngine.database[code]) {
          setActiveError({ code: code.toUpperCase(), ...aiEngine.database[code] });
        } else {
          setActiveError(null);
        }

        if (rpmG.current) rpmG.current.value = (incoming.rpm || 0) / 1000;
        if (tempG.current) tempG.current.value = incoming.temp || 0;

      } catch (e) {
        if (isMounted) setIsConnected(false);
      } finally {
        timeoutIdRef.current = setTimeout(fetchLiveData, 1000);
      }
    };

    fetchLiveData();

    return () => { 
      isMounted = false; 
      clearTimeout(timeoutIdRef.current); 
      window.removeEventListener('resize', handleResize);
      rpmG.current?.destroy?.();
      tempG.current?.destroy?.();
    };
  }, [aiEngine]);

  const currentStatus = aiEngine.analyzeStatus(data);

  // --- دالة إرسال السؤال ومعالجته ---
  const handleAskAI = () => {
    if (!userQuery.trim()) return;
    setIsThinking(true);
    setAiResponse("جاري تحليل بيانات الحساسات الحالية...");

    setTimeout(() => {
      let response = "بناءً على الفحص اللحظي: ";
      if (data.temp > 98) response += "المحرك يميل للسخونة، تأكد من دورة التبريد. ";
      else if (activeError) response += `يوجد كود عطل (${activeError.code}). ${activeError.advice}`;
      else response += "أداء المحرك مثالي حالياً ولا يوجد مؤشرات لأعطال ميكانيكية.";
      
      setAiResponse(response);
      setIsThinking(false);
      setUserQuery("");
    }, 1200);
  };

  const handleClearCode = async () => {
    try {
      const res = await fetch(CMD_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ command: "04" }) 
      });
      const result = await res.json();
      if (res.ok) {
        setActiveError(null);
        alert(result.message || "تم مسح كود العطل بنجاح ✅");
      }
    } catch {
      alert("فشل الاتصال بالسيرفر ❌");
    }
  };

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '15px', direction: 'rtl', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* 🤖 AI Status Bar */}
      <div style={{ 
        background: `${currentStatus.color}15`, 
        border: `1px solid ${currentStatus.color}`, 
        padding: '12px 25px', borderRadius: '50px', 
        marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px'
      }}>
        <span style={{ fontSize: '1.5rem' }}>🤖</span>
        <div style={{ flex: 1, fontWeight: 'bold', color: currentStatus.color }}>{currentStatus.msg}</div>
        <div style={{ fontSize: '0.8rem', color: isConnected ? '#00ff00' : '#ff1e1e' }}>
          {isConnected ? `مركبة ذكية متصلة | VIN: ${data.vin}` : "جاري البحث عن ECU..."}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr 320px', gap: '15px' }}>
        
        {/* العدادات */}
        <div style={{ background: '#0a0a0a', padding: '20px', borderRadius: '30px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
          <canvas id="rpm-gauge"></canvas>
          <div style={{ margin: '20px 0', borderBottom: '1px solid #1a1a1a' }}></div>
          <canvas id="temp-gauge"></canvas>
        </div>

        {/* الرسم البياني والمربعات */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ height: '350px', background: '#050505', borderRadius: '30px', padding: '20px', border: '1px solid #1a1a1a' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#00ffcc', fontSize: '0.9rem' }}>تحليل الأداء اللحظي (AI Visualization)</h4>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorRpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ffcc" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#00ffcc" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #333', color: '#fff'}} />
                <Area type="monotone" dataKey="rpm" stroke="#00ffcc" fillOpacity={1} fill="url(#colorRpm)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[{ label: 'البطارية', val: data.voltage, unit: 'V' }, { label: 'الحمل', val: data.load, unit: '%' }, { label: 'البوابة', val: data.throttle, unit: '%' }].map((item, idx) => (
              <div key={idx} style={{ background: '#0a0a0a', padding: '15px', borderRadius: '20px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                <small style={{ color: '#666' }}>{item.label}</small>
                <div style={{ fontSize: '1.4rem', color: '#00ffcc', fontWeight: 'bold' }}>{item.val}{item.unit}</div>
              </div>
            ))}
          </div>
        </div>

        {/* تشخيص AI + شريط الأسئلة المدمج */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ background: '#0a0a0a', padding: '20px', borderRadius: '30px', border: '1px solid #333', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ color: '#00ffcc', marginTop: 0 }}>📋 تشخيص تيتان AI</h3>
            
            {/* نافذة عرض الرد الذكي */}
            <div style={{ 
              flex: 1, 
              background: '#050505', 
              borderRadius: '15px', 
              padding: '12px', 
              border: '1px solid #1a1a1a', 
              fontSize: '0.85rem', 
              marginBottom: '15px',
              color: isThinking ? '#666' : '#fff',
              lineHeight: '1.5'
            }}>
              {aiResponse}
              {activeError && (
                <div style={{ marginTop: '10px', color: '#ff1e1e', fontWeight: 'bold', borderTop: '1px solid #222', paddingTop: '10px' }}>
                  {activeError.code}: {activeError.title}
                </div>
              )}
            </div>

            {/* شريط الإدخال */}
            <div style={{ display: 'flex', gap: '5px' }}>
              <input 
                type="text" 
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAskAI()}
                placeholder="اسأل الـ AI عن سيارتك..."
                style={{ flex: 1, background: '#111', border: '1px solid #333', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
              />
              <button 
                onClick={handleAskAI}
                style={{ background: '#00ffcc', color: '#000', border: 'none', borderRadius: '10px', padding: '0 15px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                إرسال
              </button>
            </div>

            {activeError && (
              <button onClick={handleClearCode} style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#ff1e1e', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
                مسح كود العطل
              </button>
            )}
          </div>
          
          <div style={{ background: '#1a1000', padding: '15px', borderRadius: '25px', border: '1px solid #ffae0033' }}>
            <h5 style={{ margin: '0 0 5px 0', color: '#ffae00' }}>⚠️ مراقبة الحساسات</h5>
            <div style={{ fontSize: '0.75rem', color: '#ccc' }}>
               {data.temp > 100 ? "الحرارة مرتفعة - يرجى القيادة بهدوء" : "جميع الحساسات تعمل بكفاءة عالية"}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}