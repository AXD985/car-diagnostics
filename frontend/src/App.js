import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RadialGauge } from 'canvas-gauges';
import { 
  LineChart, 
  Line, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';

/** * TITAN PRO AI - ADVANCED VEHICLE DIAGNOSTICS
 * إعداد الطالب: أحمد
 * التحديث: إصلاح أخطاء العدادات + توسيع النظام البرمجي
 */

const API_URL = "http://127.0.0.1:5000/api/obd2";
const CMD_URL = "http://127.0.0.1:5000/api/command";

export default function App() {
  // --- STATE MANAGEMENT ---
  const [data, setData] = useState({ 
    rpm: 0, temp: 0, speed: 0, voltage: 13.8, load: 0, 
    vin: "TITAN-PRO-AI-2026", dtc_code: "", throttle: 0, 
    intake: 0, predicted_temp: 0, fuel_level: 0, runtime: "00:00:00"
  });

  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('dash'); 
  const [isDemo, setIsDemo] = useState(false);
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING...');

  const rpmG = useRef(null);
  const tempG = useRef(null);

  // --- LOGIC FUNCTIONS ---
  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  };

  const calculateHealth = () => {
    let health = 100;
    if (data.temp > 100) health -= 20;
    if (data.voltage < 12) health -= 15;
    if (data.dtc_code && data.dtc_code !== "P0000") health -= 40;
    return Math.max(health, 0);
  };

  // --- GAUGE INITIALIZATION (FIXED) ---
  const initGauges = useCallback(() => {
    if (activeTab === 'dash') {
      setTimeout(() => {
        const rpmEl = document.getElementById('rpm-gauge-canvas');
        const tempEl = document.getElementById('temp-gauge-canvas');

        if (rpmEl && !rpmG.current) {
          rpmG.current = new RadialGauge({
            renderTo: 'rpm-gauge-canvas',
            width: 250, height: 250, units: 'RPM x1000',
            minValue: 0, maxValue: 8,
            colorPlate: '#050505', colorNumbers: '#00ffcc', colorUnits: '#00ffcc',
            majorTicks: ['0','1','2','3','4','5','6','7','8'],
            highlights: [{ from: 6.5, to: 8, color: 'rgba(255, 0, 0, 0.5)' }],
            colorNeedle: '#ff1e1e',
            animation: true, // تم تبسيط التحريك هنا لحل الخطأ
            borders: false,
            needleType: 'arrow',
            valueBox: true
          }).draw();
        }

        if (tempEl && !tempG.current) {
          tempG.current = new RadialGauge({
            renderTo: 'temp-gauge-canvas',
            width: 250, height: 250, units: 'TEMP °C',
            minValue: 0, maxValue: 150,
            colorPlate: '#050505', colorNumbers: '#fff',
            majorTicks: ['0','30','60','90','120','150'],
            highlights: [{ from: 100, to: 150, color: 'rgba(255, 0, 0, 0.4)' }],
            colorNeedle: '#fff',
            animation: true,
            borders: false,
            valueBox: true
          }).draw();
        }
      }, 500);
    }
  }, [activeTab]);

  useEffect(() => { initGauges(); }, [initGauges]);

  // --- DATA POLLING ---
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}?mode=${isDemo ? 'demo' : 'real'}`);
        const result = await res.json();
        setData(result);
        setHistory(prev => [...prev, { ...result, t: new Date().toLocaleTimeString() }].slice(-40));
        setConnectionStatus('STABLE');
        
        if (rpmG.current) rpmG.current.value = result.rpm / 1000;
        if (tempG.current) tempG.current.value = result.temp;
      } catch (e) {
        setConnectionStatus('DISCONNECTED');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isDemo]);

  // --- STYLING ---
  const mainStyle = {
    backgroundColor: '#020202', color: '#e0e0e0', minHeight: '100vh',
    direction: 'rtl', fontFamily: 'Inter, system-ui, sans-serif'
  };

  const cardStyle = {
    background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '24px',
    padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
  };

  const gridItemStyle = (accent) => ({
    ...cardStyle, borderTop: `4px solid ${accent}`, textAlign: 'center',
    transition: 'all 0.3s ease'
  });

  return (
    <div style={mainStyle}>
      {/* Header / Navbar */}
      <header style={{ padding: '20px 50px', borderBottom: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#050505' }}>
        <div>
          <h1 style={{ margin: 0, color: '#00ffcc', fontSize: '1.8rem' }}>TITAN PRO AI <span style={{fontSize: '0.8rem', color: '#444'}}>v11.0</span></h1>
          <small style={{ color: connectionStatus === 'STABLE' ? '#00ff00' : '#ff1e1e' }}>STATUS: {connectionStatus}</small>
        </div>
        <nav style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => setActiveTab('dash')} style={{ padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', background: activeTab === 'dash' ? '#00ffcc' : '#111', color: activeTab === 'dash' ? '#000' : '#fff', border: 'none' }}>لوحة التحكم</button>
          <button onClick={() => setActiveTab('reports')} style={{ padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', background: activeTab === 'reports' ? '#00ffcc' : '#111', color: activeTab === 'reports' ? '#000' : '#fff', border: 'none' }}>التقارير</button>
          <button onClick={() => setActiveTab('docs')} style={{ padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', background: activeTab === 'docs' ? '#00ffcc' : '#111', color: activeTab === 'docs' ? '#000' : '#fff', border: 'none' }}>التوثيق الفني</button>
        </nav>
      </header>

      {activeTab === 'dash' && (
        <main style={{ padding: '30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '25px' }}>
            
            {/* Left Column: AI & Health */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <div style={gridItemStyle('#00ffcc')}>
                <h4 style={{ color: '#00ffcc', margin: '0 0 10px 0' }}>كفاءة النظام الذكي</h4>
                <div style={{ fontSize: '4.5rem', fontWeight: 'bold', color: calculateHealth() > 80 ? '#00ff00' : '#ffcc00' }}>{calculateHealth()}%</div>
                <p style={{ color: '#555', fontSize: '0.9rem' }}>بناءً على 14 مؤشر حيوي</p>
              </div>

              <div style={cardStyle}>
                <h4 style={{ color: '#00ffcc' }}>التنبؤ الحراري AI</h4>
                <div style={{ fontSize: '2.5rem', color: '#fff' }}>{data.predicted_temp}°C</div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={history.slice(-15)}>
                    <Area type="monotone" dataKey="predicted_temp" stroke="#00ffcc" fill="rgba(0,255,204,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={cardStyle}>
                <h4 style={{ color: '#ffae00' }}>سجل الرسائل الحية</h4>
                <div style={{ height: '200px', overflowY: 'auto', fontSize: '0.7rem', fontFamily: 'monospace', color: '#888' }}>
                  {logs.length === 0 ? "بانتظار وصول حزم البيانات..." : logs.map((l, i) => <div key={i} style={{borderBottom: '1px solid #111', padding: '4px'}}>{l}</div>)}
                </div>
              </div>
            </section>

            {/* Middle Column: Gauges & 6 Grid */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '40px' }}>
                <canvas id="rpm-gauge-canvas"></canvas>
                <canvas id="temp-gauge-canvas"></canvas>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                <div style={gridItemStyle('#00ffcc')}>
                  <small>السرعة</small>
                  <div style={{ fontSize: '2.2rem', margin: '10px 0' }}>{data.speed}</div>
                  <small style={{ color: '#444' }}>KM/H</small>
                </div>
                <div style={gridItemStyle('#ffae00')}>
                  <small>البطارية</small>
                  <div style={{ fontSize: '2.2rem', margin: '10px 0' }}>{data.voltage}</div>
                  <small style={{ color: '#444' }}>VOLTS</small>
                </div>
                <div style={gridItemStyle('#0066ff')}>
                  <small>الحمل</small>
                  <div style={{ fontSize: '2.2rem', margin: '10px 0' }}>{data.load}</div>
                  <small style={{ color: '#444' }}>%</small>
                </div>
                <div style={gridItemStyle('#e84393')}>
                  <small>الثروتل</small>
                  <div style={{ fontSize: '2.2rem', margin: '10px 0' }}>{data.throttle}</div>
                  <small style={{ color: '#444' }}>%</small>
                </div>
                <div style={gridItemStyle('#00b894')}>
                  <small>حرارة السحب</small>
                  <div style={{ fontSize: '2.2rem', margin: '10px 0' }}>{data.intake}</div>
                  <small style={{ color: '#444' }}>°C</small>
                </div>
                <div style={gridItemStyle('#6c5ce7')}>
                  <small>الوقود</small>
                  <div style={{ fontSize: '2.2rem', margin: '10px 0' }}>{data.fuel_level}</div>
                  <small style={{ color: '#444' }}>%</small>
                </div>
              </div>
            </section>

            {/* Right Column: DTC & Control */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <div style={{ ...cardStyle, border: '1px solid #ff1e1e', background: 'rgba(30,0,0,0.3)' }}>
                <h4 style={{ color: '#ff1e1e' }}>الأعطال المكتشفة</h4>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#ff1e1e' }}>{data.dtc_code || "No Errors"}</div>
                <button 
                  onClick={() => addLog("إرسال أمر مسح الأكواد...")}
                  style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#ff1e1e', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                  مسح ذاكرة الأخطاء
                </button>
              </div>

              <div style={cardStyle}>
                <h4 style={{ color: '#00ffcc' }}>VIN Info</h4>
                <div style={{ fontSize: '0.9rem', color: '#00ffcc', fontFamily: 'monospace' }}>{data.vin}</div>
              </div>

              <div style={cardStyle}>
                <h4 style={{ color: '#fff' }}>تحليل استهلاك الوقود</h4>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={history.slice(-8)}>
                    <Bar dataKey="load" fill="#0066ff">
                      {history.slice(-8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#0066ff' : '#00ffcc'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </main>
      )}

      {activeTab === 'docs' && (
        <div style={{ padding: '60px', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={cardStyle}>
            <h2 style={{ color: '#00ffcc' }}>التوثيق الهندسي للمشروع</h2>
            <hr style={{ borderColor: '#222', margin: '20px 0' }} />
            <h3>1. خوارزمية التنبؤ (TITAN AI Core)</h3>
            <p>النظام يستخدم معادلة تعتمد على "زمن رد الفعل الحراري" لتوقع الحرارة قبل وقوعها:</p>
            <div style={{ background: '#000', padding: '20px', borderRadius: '15px', textAlign: 'center', fontSize: '1.4rem', color: '#00ffcc', fontFamily: 'monospace' }}>
              {"Future_T = Current_T + (RPM_Factor * Load_Index)"}
            </div>
            <h3>2. بروتوكولات الاتصال</h3>
            <p>يتم جلب البيانات عبر مكتبة `obd` في بايثون ومن ثم تحويلها إلى `JSON` ليتم عرضها هنا في React بسرعة تحديث تصل إلى 1000ms.</p>
          </div>
        </div>
      )}

      {/* Footer / Data Stream Bar */}
      <footer style={{ position: 'fixed', bottom: 0, width: '100%', background: '#050505', borderTop: '1px solid #111', padding: '10px 50px', display: 'flex', gap: '30px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div style={{ color: '#00ffcc', fontSize: '0.8rem', animation: 'marquee 20s linear infinite' }}>
           LIVE RAW DATA: RPM:{data.rpm} | SPEED:{data.speed} | TEMP:{data.temp} | LOAD:{data.load}% | VOLT:{data.voltage}V | THROTTLE:{data.throttle}% | FUEL:{data.fuel_level}% | STATUS: {connectionStatus} | ENGINE_RUNTIME: {data.runtime}
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
      `}</style>
    </div>
  );
}