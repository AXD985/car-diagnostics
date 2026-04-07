import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RadialGauge } from 'canvas-gauges';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * نظام TITAN PRO MAX - الإصدار التشخيصي المتطور (V4.0)
 * تم دمج قاعدة بيانات الأعطال المتقدمة مع نظام التعرف الذكي الجديد
 */

// رابط السيرفر العالمي الخاص بك على Render
const API_URL = "https://car-diagnostics-b600.onrender.com/api/obd2";

export default function App() {
  // 1. إدارة البيانات والحالات
  const [data, setData] = useState({ 
    rpm: 0, temp: 0, speed: 0, voltage: 12.6, load: 0, 
    vin: "", dtc_code: "", throttle: 0, intake: 0, timing: 0 
  });
  const [history, setHistory] = useState([]);
  const [activeError, setActiveError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const rpmG = useRef(null);
  const tempG = useRef(null);

  // 2. قاعدة بيانات تيتان المطورة (قاعدة بيانات ميكانيكية شاملة)
  const geminiDatabase = useMemo(() => ({
    // --- أكواد أعطال قياسية (P-Codes) ---
    "p0011": "خلل في توقيت عمود الكامات (Camshaft). افحص مستوى ونظافة الزيت وحساس الـ VVT.",
    "p0016": "عدم تطابق إشارة الكرنك والكام شفت. قد يكون بسبب تمدد جنزير الماكينة (Timing Chain).",
    "p0087": "ضغط مسطرة الوقود منخفض جداً. افحص طرمبة البنزين الضغط العالي (HPFP) أو فلتر البنزين.",
    "p0101": "مشكلة في مستشعر تدفق الهواء (MAF). تسبب تفتفة، ضعف تسارع، وزيادة استهلاك الوقود.",
    "p0115": "عطل مستشعر حرارة المحرك. قد يسبب غليان الماء أو عمل المراوح بأقصى سرعة دائماً.",
    "p0121": "خلل في إشارة حساس بوابة الهواء (TPS). يسبب تعليق في سرعة المحرك أو عدم استجابة للدعسة.",
    "p0171": "خليط الهواء والوقود فقير (Lean). يوجد هواء زائد؛ افحص خراطيم الثلاجة أو تهريب هواء (Vacuum).",
    "p0299": "انخفاض ضغط الشاحن التربيني (Turbo Underboost). افحص خراطيم التيربو أو بوابة الهدر (Wastegate).",
    "p0300": "احتراق غير منتظم عشوائي (Misfire). افحص البواجي، الكويلات، وضفيرة الاحتراق فوراً.",
    "p0420": "كفاءة دبة الرصاص (Catalyst) منخفضة. انسداد في الشكمان يسبب كتمة وحرارة عالية للماكينة.",
    "p0500": "مستشعر السرعة (VSS) لا يعطي إشارة. قد يتوقف عداد السرعة أو يتأثر تبديل نمر القير.",
    "p0562": "جهد النظام منخفض جداً. البطارية أو الدينامو يحتاجان لفحص فني شامل للدوائر الكهربائية.",
    "p0700": "خلل في نظام التحكم بناقل الحركة (Gearbox). يتطلب فحص ضغط زيت وحساسات القير الداخلية.",
    "p0741": "خلل في كلتش تحويل العزم (Torque Converter). القير قد لا يشبك النمرة الأخيرة بشكل صحيح.",
    "p2135": "حساس الثروتل (TPS): خلل في توافق إشارة دواسة البنزين أو بوابة الهواء الإلكترونية.",
    "u0121": "فقدان الاتصال مع وحدة الـ ABS. مشكلة في ضفيرة الـ CAN-Bus أو فيوز نظام الفرامل.",
    
    // --- مفاهيم ونصائح ميكانيكية ---
    "زيت": "الزيت المحروق (أسود جداً) يقلل العمر الافتراضي. اللون الحليبي يعني خلط ماء (تلف وجه الرأس).",
    "لزوجة": "استخدم لزوجة 5W-30 للسيارات الحديثة. اللزوجة العالية في الشتاء قد تسبب تأخر تزييت الرأس.",
    "حرارة": "تحذير: ارتفاع الحرارة خطر! افحص مستوى سائل التبريد، بلف الحرارة، والمراوح، وطرمبة الماء.",
    "تفتفة": "تحليل: غالباً بسبب اتساخ البوابة (Throttle)، تلف البواجي، الكويلات، أو كراسي المحرك.",
    "عزم": "ضعف العزم: انسداد فلتر البنزين، ضعف طرمبة الوقود، أو انسداد في دبة البيئة (الشكمان).",
    "قير": "نتعة القير تعني نقص زيت أو اتساخ الفلتر. زيت القير يتغير كل 60-80 ألف كم للحماية.",
    "دخان": "أسود: احتراق وقود زائد | أزرق: احتراق زيت (شنبر) | أبيض كثيف: تسريب ماء داخل الغرف.",
    "بخاخات": "انسداد البخاخات يسبب صعوبة تشغيل صباحي، تفتفة، وضعف في سحب السيارة بالمرتفعات.",
    "تيربو": "يجب ترك المحرك يعمل لمدة دقيقة قبل إطفائه بعد المشاوير الطويلة لتبريد ريش التيربو بالزيت.",
    "فرامل": "رجة عند الفرملة تعني هوبات تحتاج خرط. الصرير الحاد يعني فحمات منتهية وتحتاج تبديل.",
    "بطارية": "العمر الافتراضي سنتان. الأملاح على الأقطاب تضعف التوصيل وتمنع السلف من تدوير المحرك.",
    "abs": "نظام مانع الانغلاق. إضاءة لمبة الـ ABS غالباً بسبب اتساخ حساسات العجلات أو قطع في الضفيرة.",
    "bmw": "نظام تيتان يدعم BMW بالكامل. استخدم الزيوت التخليقية ومياه التبريد الأصلية للحفاظ على المحرك.",
    "vanos": "نظام الفانوس (Vanos) حساس جداً لنظافة الزيت. أي إهمال يسبب خشونة في صوت المحرك وضعف عزم.",
  }), []);

  // 3. نظام التعرف الذكي (VIN Recognition) - يدعم الماركات العالمية الجديدة
  const getCarMake = (vin) => {
    if (!vin || vin === "" || vin === "undefined") return "بانتظار الاتصال بالمركبة...";
    const prefix = vin.substring(0, 3).toUpperCase();
    const map = {
      "WBA": "BMW (ألماني 🇩🇪)", 
      "WBS": "BMW M-Series 🇩🇪", 
      "WDC": "Mercedes-Benz 🇩🇪",
      "WAU": "Audi 🇩🇪",
      "WVW": "Volkswagen 🇩🇪",
      "JT1": "Toyota 🇯🇵",
      "JHM": "Honda 🇯🇵",
      "JN1": "Nissan 🇯🇵",
      "1FA": "Ford 🇺🇸", 
      "KMH": "Hyundai 🇰🇷",
      "KNA": "Kia 🇰🇷",
      "SAL": "Land Rover 🇬🇧"
    };
    return map[prefix] || "مركبة عامة (Generic Car)";
  };

  // 4. إعداد العدادات وجلب البيانات المستمر
  useEffect(() => {
    // رسم العدادات
    rpmG.current = new RadialGauge({
      renderTo: 'rpm-gauge', width: 300, height: 300, units: 'RPM x1000',
      minValue: 0, maxValue: 8, majorTicks: ['0','1','2','3','4','5','6','7','8'],
      highlights: [{ from: 6.5, to: 8, color: 'rgba(200, 0, 0, .8)' }],
      colorPlate: '#050505', colorNumbers: '#00ffcc', needleType: 'arrow',
      valueBox: true, animationDuration: 500
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
        
        // توحيد البيانات لضمان القراءة مهما كان اسم الحقل من السيرفر
        const standardizedData = {
          ...incoming,
          rpm: incoming.rpm || 0,
          temp: incoming.temp || 0,
          vin: incoming.vin || incoming.VIN || "",
          dtc_code: incoming.dtc_code || incoming.DTC || ""
        };

        setData(standardizedData);

        // تحديث إبرة العدادات
        if (rpmG.current) rpmG.current.value = standardizedData.rpm / 1000;
        if (tempG.current) tempG.current.value = standardizedData.temp;
        
        // تحديث الرسم البياني
        setHistory(prev => [...prev, { 
          rpm: standardizedData.rpm, 
          load: standardizedData.load || 0, 
          time: new Date().toLocaleTimeString().slice(-5) 
        }].slice(-50));
        
        // التحقق من أكواد الأعطال وعرضها في المساعد
        const errorCode = standardizedData.dtc_code?.toLowerCase().trim();
        if (errorCode && geminiDatabase[errorCode]) {
          setActiveError({ code: standardizedData.dtc_code.toUpperCase(), desc: geminiDatabase[errorCode] });
        } else { 
          setActiveError(null); 
        }

      } catch (error) {
        console.error("خطأ في الاتصال بالسيرفر السحابي:", error);
      }
    };

    const interval = setInterval(fetchLiveData, 1000); 
    return () => clearInterval(interval);
  }, [geminiDatabase]);

  // 5. محرك البحث والتشخيص الذكي
  const getAIResponse = () => {
    if (!searchTerm) return "بانتظار استفسارك الميكانيكي (مثال: حرارة، زيت، P0300)...";
    const term = searchTerm.toLowerCase().trim();
    const key = Object.keys(geminiDatabase).find(k => term.includes(k) || k.includes(term));
    return key ? geminiDatabase[key] : "لم أجد هذا المصطلح بدقة، جرب كلمات مثل: تيربو، دخان، طرمبة، أو كود عطل P0299.";
  };

  const aiResponse = getAIResponse();

  const allSensors = [
    { label: 'السرعة', val: data.speed, unit: 'km/h', color: '#fff' },
    { label: 'الجهد', val: data.voltage, unit: 'V', color: '#00ffcc' },
    { label: 'حمل المحرك', val: data.load, unit: '%', color: '#fff' },
    { label: 'البوابة', val: data.throttle, unit: '%', color: '#fff' },
    { label: 'الهواء الداخل', val: data.intake || 0, unit: '°C', color: '#fff' },
    { label: 'توقيت الإشعال', val: data.timing || 0, unit: '°', color: '#fff' }
  ];

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '30px', direction: 'rtl', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: '15px', marginBottom: '30px' }}>
        <div>
          <h1 style={{ color: '#00ffcc', margin: 0, letterSpacing: '2px', fontSize: '2.2rem' }}>TITAN PRO MAX</h1>
          <small style={{ color: '#444' }}>نظام التشخيص السحابي المتكامل</small>
        </div>
        <input 
          type="text" 
          placeholder="🔍 ابحث عن عطل أو قطعة ميكانيكية..." 
          style={{ width: '40%', padding: '12px 20px', borderRadius: '15px', border: '1px solid #222', backgroundColor: '#080808', color: '#00ffcc', outline: 'none' }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* VIN Card - تم تعديل العلم ليدعم جميع الماركات */}
      <div style={{ background: 'linear-gradient(90deg, #080808 0%, #111 100%)', padding: '20px 25px', borderRadius: '20px', marginBottom: '25px', border: '1px solid #00ffcc22', display: 'flex', alignItems: 'center', gap: '25px' }}>
          <div style={{ fontSize: '3.5rem' }}>
            {data.vin?.toUpperCase().startsWith("W") ? "🇩🇪" : 
             data.vin?.toUpperCase().startsWith("J") ? "🇯🇵" : 
             data.vin?.toUpperCase().startsWith("1") ? "🇺🇸" : 
             data.vin?.toUpperCase().startsWith("K") ? "🇰🇷" : 
             data.vin?.toUpperCase().startsWith("S") ? "🇬🇧" : "🚗"}
          </div>
          <div>
              <h4 style={{ color: '#00ffcc', margin: 0, fontSize: '0.9rem' }}>نظام التعرف الذكي على هوية المركبة:</h4>
              <h2 style={{ margin: '5px 0', fontSize: '1.8rem' }}>{getCarMake(data.vin)}</h2>
              <code style={{ color: '#444' }}>رقم الشاصي المستلم: {data.vin || "بانتظار وصول إشارة الجهاز..." }</code>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '25px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {/* Gauges */}
          <div style={{ background: '#080808', padding: '30px', borderRadius: '30px', display: 'flex', justifyContent: 'space-around', border: '1px solid #111' }}>
              <div style={{textAlign: 'center'}}><canvas id="rpm-gauge"></canvas><h4 style={{color: '#00ffcc'}}>دوران المحرك</h4></div>
              <div style={{textAlign: 'center'}}><canvas id="temp-gauge"></canvas><h4 style={{color: '#fff'}}>درجة الحرارة</h4></div>
          </div>
          {/* Chart */}
          <div style={{ background: '#080808', padding: '25px', borderRadius: '25px', height: '350px', border: '1px solid #111' }}>
            <h3 style={{ color: '#333', marginBottom: '15px' }}>تحليل الأداء اللحظي (Real-time Analytics)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111" />
                <Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #00ffcc', borderRadius: '10px'}} />
                <Area type="monotone" dataKey="rpm" stroke="#00ffcc" fill="#00ffcc11" strokeWidth={3} />
                <Area type="monotone" dataKey="load" stroke="#ffcc00" fill="#ffcc0011" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {/* AI Assistant - المساعد الذكي المطور */}
          <div style={{ background: '#080808', padding: '25px', borderRadius: '25px', border: '1px solid #00ffcc44', minHeight: '220px' }}>
            <h3 style={{ color: '#00ffcc', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>✨ مساعد TITAN للتشخيص</h3>
            <div style={{ background: '#0c0c0c', padding: '18px', borderRadius: '15px', borderRight: '4px solid #00ffcc' }}>
              <p style={{ color: '#eee', fontSize: '1rem', lineHeight: '1.6', margin: 0 }}>{aiResponse}</p>
            </div>
            
            {/* عرض العطل النشط فور اكتشافه من السيرفر */}
            {activeError && (
               <div style={{ marginTop: '15px', padding: '12px', background: '#ff1e1e22', borderRadius: '12px', color: '#ff4d4d', border: '1px solid #ff1e1e44' }}>
                 <strong>⚠️ عطل فني نشط: {activeError.code}</strong>
                 <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem' }}>{activeError.desc}</p>
               </div>
            )}
          </div>

          {/* Sensors Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {allSensors.map((item, index) => (
              <div key={index} style={{ background: '#080808', padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid #111' }}>
                <small style={{ color: '#444', fontWeight: 'bold' }}>{item.label}</small>
                <h2 style={{ margin: '5px 0', color: item.color, fontSize: '1.8rem' }}>{item.val} <small style={{fontSize: '0.8rem'}}>{item.unit}</small></h2>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}