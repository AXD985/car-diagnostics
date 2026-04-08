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
    "WBA": "BMW 🇩🇪",
    "WDC": "Mercedes-Benz 🇩🇪", 
    "WAU": "Audi 🇩🇪",
    "JT1": "Toyota 🇯🇵",
    "JHM": "Honda 🇯🇵",
    "1FA": "Ford 🇺🇸",
    "1GC": "Chevrolet 🇺🇸",
    "KMH": "Hyundai 🇰🇷",
    "KNA": "Kia 🇰🇷",
    "JN1": "Nissan 🇯🇵",
    "JDA": "Daihatsu 🇯🇵",
    "JM1": "Mazda 🇯🇵",
    "SAL": "Land Rover 🇬🇧",
    "SBM": "McLaren 🇬🇧",
    "WP0": "Porsche 🇩🇪",
    "WVW": "Volkswagen 🇩🇪",
    "ZFF": "Ferrari 🇮🇹"
  };

  // إذا وجد الكود في القائمة يعرضه، وإلا يعرض رقم الشاصي مع أيقونة عامة
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

const SENSORS = [
  { label: 'السرعة', key: 'speed', unit: 'km/h', type: 'none' },
  { label: 'الجهد', key: 'voltage', unit: 'V', type: 'voltage' },
  { label: 'الحمل', key: 'load', unit: '%', type: 'none' },
  { label: 'البوابة', key: 'throttle', unit: '%', type: 'none' },
  { label: 'هواء السحب', key: 'intake', unit: '°C', type: 'temp' },
  { label: 'التوقيت', key: 'timing', unit: '°', type: 'none' }
];

// =================== MAIN COMPONENT ===================
export default function App() {
  // =================== STATE ===================
  const [data, setData] = useState({
    rpm: 0, temp: 0, speed: 0, voltage: 12.6, 
    load: 0, vin: "", dtc_code: "", throttle: 0, 
    intake: 0, timing: 0 
  });
  
  const [history, setHistory] = useState([]);
  const [tripLog, setTripLog] = useState([]);
  const [activeError, setActiveError] = useState(null);
  const [freezeFrame, setFreezeFrame] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // =================== REFS ===================
  const rpmG = useRef(null);
  const tempG = useRef(null);

  // =================== MEMOIZED VALUES ===================
  const geminiDatabase = useMemo(() => GEMINI_DATABASE, []);

  // =================== EVENT HANDLERS ===================
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

  // =================== EFFECTS ===================
  useEffect(() => {
    // Initialize Gauges
    if (!rpmG.current) {
      rpmG.current = new RadialGauge({
        renderTo: 'rpm-gauge',
        width: 220, height: 220,
        units: 'RPM x1000', minValue: 0, maxValue: 8,
        colorPlate: '#050505', colorNumbers: '#00ffcc',
        needleType: 'arrow', animatedValue: true
      }).draw();
    }

    if (!tempG.current) {
      tempG.current = new RadialGauge({
        renderTo: 'temp-gauge',
        width: 220, height: 220,
        units: 'TEMP °C', minValue: 0, maxValue: 150,
        colorPlate: '#050505', colorNumbers: '#fff',
        animatedValue: true
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

        // Error handling logic
        const code = incoming.dtc_code?.toLowerCase().trim();
        if (code && geminiDatabase[code]) {
          setActiveError({
            code: incoming.dtc_code.toUpperCase(),
            desc: geminiDatabase[code]
          });
          setFreezeFrame(prev => prev || { 
            ...incoming, 
            timestamp: new Date().toLocaleTimeString() 
          });
        } else {
          setActiveError(null);
        }

        // Update gauges
        if (rpmG.current) rpmG.current.value = (incoming.rpm || 0) / 1000;
        if (tempG.current) tempG.current.value = incoming.temp || 0;

        // Update history
        setHistory(prev => [...prev, { rpm: incoming.rpm || 0 }].slice(-30));
        setTripLog(prev => [...prev, { 
          time: new Date().toLocaleTimeString().split(' ')[0],
          rpm: incoming.rpm || 0,
          load: incoming.load || 0 
        }].slice(-50));

      } catch (e) {
        if (isMounted) setIsConnected(false);
      } finally {
        if (isMounted) {
          timeoutId = setTimeout(fetchLiveData, 1000);
        }
      }
    };

    fetchLiveData();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [geminiDatabase]);

  // =================== RENDER ===================
  return (
    <div style={{
      backgroundColor: '#000', color: '#fff',
      minHeight: '100vh', padding: '15px',
      direction: 'rtl', fontFamily: 'Arial'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '15px' 
      }}>
        <h1 style={{ 
          color: getStatusColor(data.temp, 'temp'), 
          fontSize: '1.4rem' 
        }}>
          TITAN ARCH V6.2 🚀
        </h1>
        <div style={{ 
          color: isConnected ? '#00ff00' : '#ff1e1e' 
        }}>
          {isConnected ? "● ONLINE" : "○ OFFLINE"}
        </div>
      </div>

      {/* Info Bar - ✅ تم التحديث هنا */}
      <div style={{ 
        background: '#080808', padding: '15px', 
        borderRadius: '15px', border: '1px solid #222',
        marginBottom: '15px', display: 'flex', 
        justifyContent: 'space-between' 
      }}>
        <div>
          <h2 style={{ 
            margin: 0, 
            color: '#00ffcc', 
            fontSize: '1.4rem',
            textShadow: '0 0 10px #00ffcc55'  // ✅ تم إضافة التوهج
          }}>
            {getCarMake(data.vin)}
          </h2>
          <code style={{ color: '#666', fontSize: '0.9rem' }}>  {/* ✅ تم التحديث */}
            ID: {data.vin || "SEARCHING..."}
          </code>
        </div>
        <div style={{ fontSize: '2rem' }}>🏎️</div>
      </div>

      {/* باقي الكود بدون تغيير */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '280px 1fr 300px', 
        gap: '15px' 
      }}>
        {/* Gauges Column */}
        <div style={{ 
          background: '#080808', padding: '15px', 
          borderRadius: '25px', border: '1px solid #111',
          textAlign: 'center' 
        }}>
          <canvas id="rpm-gauge"></canvas>
          <hr style={{ borderColor: '#111', margin: '15px 0' }} />
          <canvas id="temp-gauge"></canvas>
        </div>

        {/* Charts & Sensors Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ 
            height: '220px', background: '#080808', 
            borderRadius: '25px', border: '1px solid #111' 
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="rpmGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`${getStatusColor(data.rpm, 'rpm')}99`} />
                    <stop offset="100%" stopColor={`${getStatusColor(data.rpm, 'rpm')}00`} />
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="rpm" 
                  stroke={getStatusColor(data.rpm, 'rpm')}
                  fill="url(#rpmGradient)"
                  isAnimationActive={false} 
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <Tooltip />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sensors Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '10px' 
          }}>
            {SENSORS.map((sensor, i) => (
              <div key={sensor.key} style={{ 
                background: '#080808', 
                padding: '15px', 
                borderRadius: '15px', 
                border: `1px solid ${getStatusColor(data[sensor.key], sensor.type)}33`,
                textAlign: 'center' 
              }}>
                <small style={{ 
                  color: '#444', 
                  display: 'block', 
                  fontSize: '0.8rem' 
                }}>
                  {sensor.label}
                </small>
                <strong style={{ 
                  fontSize: '1.2rem', 
                  color: getStatusColor(data[sensor.key], sensor.type) 
                }}>
                  {data[sensor.key] || 0} {sensor.unit}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* Controls & Analysis Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Commands */}
          <div style={{ 
            background: '#1a0000', padding: '15px', 
            borderRadius: '20px', border: '1px solid #ff1e1e' 
          }}>
            <h4 style={{ color: '#ff1e1e', margin: '0 0 10px 0' }}>
              🛠️ الأوامر
            </h4>
            <button 
              onClick={() => sendOBDCommand("03")}
              style={{ 
                width: '100%', padding: '10px', 
                backgroundColor: '#333', color: '#fff', 
                borderRadius: '8px', marginBottom: '8px', 
                border: 'none', cursor: 'pointer' 
              }}
            >
              فحص
            </button>
            <button 
              onClick={() => sendOBDCommand("04")}
              style={{ 
                width: '100%', padding: '10px', 
                backgroundColor: '#ff1e1e', color: '#fff', 
                borderRadius: '8px', border: 'none', 
                cursor: 'pointer', fontWeight: 'bold' 
              }}
            >
              مسح الأخطاء
            </button>
          </div>

          {/* Analysis */}
          <div style={{ 
            background: '#080808', padding: '15px', 
            borderRadius: '20px', border: '1px solid #333', 
            flex: 1 
          }}>
            <h4 style={{ 
              color: '#00ffcc', margin: '0 0 10px 0' 
            }}>
              ✨ تحليل تيتان
            </h4>
            
            {freezeFrame && (
              <div style={{ 
                padding: '10px', 
                background: '#0066ff15', 
                borderRadius: '10px', 
                border: '1px solid #0066ff33', 
                marginBottom: '10px' 
              }}>
                <strong style={{ 
                  color: '#0066ff', 
                  fontSize: '0.8rem' 
                }}>
                  ❄️ Freeze Frame Locked
                </strong>
                <p style={{ fontSize: '0.7rem', margin: '5px 0' }}>
                  Code: {freezeFrame.dtc_code} | RPM: {freezeFrame.rpm}
                </p>
              </div>
            )}

            {activeError ? (
              <div style={{ 
                padding: '10px', 
                background: '#ff1e1e15', 
                borderRadius: '10px', 
                border: '1px solid #ff1e1e33' 
              }}>
                <strong style={{ color: '#ff4d4d' }}>
                  ⚠️ {activeError.code}
                </strong>
                <p style={{ 
                  fontSize: '0.75rem', 
                  margin: '5px 0 0 0' 
                }}>
                  {activeError.desc}
                </p>
              </div>
            ) : (
              <div style={{ 
                color: '#00ff00', 
                fontSize: '0.9rem', 
                textAlign: 'center', 
                padding: '15px' 
              }}>
                ✅ لا توجد أخطاء نشطة
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}