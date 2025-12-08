const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const analyzeBtn = document.getElementById("analyzeBtn");

const neutralSpan = document.getElementById("neutral");
const stressSpan = document.getElementById("stress");
const levelSpan = document.getElementById("level");
const dominantSpan = document.getElementById("dominant");
const faceBox = document.querySelector(".face-box");
const stressBar = document.getElementById("stressBar");
const alertBox = document.getElementById("alertBox");
const activityLog = document.getElementById("activityLog");

// قراءة رقم الكاميرا من الرابط (camera.html?cam=3)
const params = new URLSearchParams(window.location.search);
const camID = params.get("cam");
if (camID) {
  document.getElementById("camTitle").textContent = "كاميرا رقم " + camID;
}

// تشغيل الكاميرا
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    video.srcObject = stream;

    // نبدأ التحليل التلقائي بعد ما تشتغل الكاميرا
    video.addEventListener("loadedmetadata", () => {
      startAutoAnalysis();
    });
  })
  .catch(err => {
    alert("تعذر تشغيل الكاميرا: " + err);
  });

// دالة تحليل الكادر
async function analyzeFrame() {
  if (video.videoWidth === 0 || video.videoHeight === 0) return;

  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.8));
  const formData = new FormData();
  formData.append("file", blob, "frame.jpg");

  analyzeBtn.textContent = "جاري التحليل...";
  analyzeBtn.disabled = true;

  try {
    const res = await fetch("http://127.0.0.1:8000/analyze", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    console.log("API Response:", data);

    updateUI(data);

  } catch (error) {
    console.error("Analysis Error:", error);
  }

  analyzeBtn.textContent = "إعادة التحليل الآن";
  analyzeBtn.disabled = false;
}

// تحديث الواجهة حسب نتيجة الذكاء الاصطناعي
function updateUI(data) {
  if (!data || data.status === "error") {
    showAlert("لم يتم الحصول على نتيجة التحليل", "medium");
    return;
  }

  if (data.status === "no_face") {
    faceBox.style.display = "none";
    showAlert("لا يوجد وجه في الكادر", "low");
    return;
  }

  // تحديث النصوص
  neutralSpan.textContent = data.neutral;
  stressSpan.textContent = data.stress_score;
  levelSpan.textContent = data.level;
  dominantSpan.textContent = data.dominant_emotion;

  // تحديث الرسم البياني
  stressBar.style.width = `${Math.min(data.stress_score, 100)}%`;

  // تحديث المستطيل حول الوجه
  if (data.details && data.details.region) {
    const r = data.details.region;
    faceBox.style.display = "block";
    faceBox.style.left = r.x + "px";
    faceBox.style.top = r.y + "px";
    faceBox.style.width = r.w + "px";
    faceBox.style.height = r.h + "px";
  } else {
    faceBox.style.display = "none";
  }

  // تنبيه ذكي
  showAlert(
    data.level === "high" ? "⚠ مستوى توتر مرتفع!" :
    data.level === "medium" ? "تنبيه: توتر متوسط" :
    "الوضع مستقر",
    data.level
  );

  // إضافة إلى سجل النشاط
  addActivityLog(data.dominant_emotion, data.level);
}

// تنبيه ذكي في أعلى الصفحة
function showAlert(message, level) {
  alertBox.style.display = "block";

  alertBox.className = "alert-box " +
    (level === "high" ? "alert-high" :
     level === "medium" ? "alert-medium" : "alert-low");

  alertBox.textContent = message;

  setTimeout(() => {
    alertBox.style.display = "none";
  }, 4000);
}

// إضافة عنصر لسجل النشاط
function addActivityLog(emotion, level) {
  const item = document.createElement("div");
  item.className = "activity-item";

  const time = new Date().toLocaleTimeString("ar-SA");

  item.innerHTML = `
    <div class="activity-text">
      العاطفة المسيطرة: <strong>${emotion}</strong>
    </div>
    <div class="activity-timestamp">${time}</div>
  `;

  activityLog.prepend(item);

  // الحفاظ على آخر 10 سجلات فقط
  while (activityLog.children.length > 10) {
    activityLog.removeChild(activityLog.lastChild);
  }
}

// التحليل التلقائي كل 5 ثوانٍ
function startAutoAnalysis() {
  analyzeFrame(); // أول تحليل مباشرة

  setInterval(() => {
    analyzeFrame();
  }, 5000);
}

// زر التحليل اليدوي
if (analyzeBtn) {
  analyzeBtn.addEventListener("click", analyzeFrame);
}


