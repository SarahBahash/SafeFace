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

let genderSpan = document.getElementById("gender");

// رقم الكاميرا
const camID = new URLSearchParams(window.location.search).get("cam");
if (camID) document.getElementById("camTitle").textContent = "كاميرا رقم " + camID;

// ----------------------------
// تشغيل الكاميرا
// ----------------------------
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
// ----------------------------
// إعدادات الأداء
// ----------------------------
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const JPEG_QUALITY = 0.6;
const ANALYSIS_INTERVAL = 3000;

let noFaceCounter = 0;
let intervalID;
let isAnalyzing = false;

// ----------------------------
// تحليل الصورة (محسّن)
// ----------------------------
async function analyzeFrame() {
  if (isAnalyzing || video.videoWidth === 0) return;
  isAnalyzing = true;

  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;


  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );

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
    updateUI(data);

  } catch (e) {
    console.error("API ERROR:", e);
  }

  analyzeBtn.textContent = "إعادة التحليل الآن";
  analyzeBtn.disabled = false;
  isAnalyzing = false;
}

// ----------------------------
// تحديث الواجهة
// ----------------------------
function updateUI(data) {

  if (data.status === "no_face") {
    noFaceCounter++;
    faceBox.style.display = "none";
    showAlert("لا يوجد شخص أمام الكاميرا", "low");

    if (noFaceCounter >= 3) {
      stopAnalysis();
      showAlert("تم إيقاف التحليل – الشخص غادر الكادر", "medium");
    }
    return;
  }

  if (noFaceCounter >= 3) {
    showAlert("تم استئناف التحليل – تم اكتشاف شخص", "low");
    startAutoAnalysis();
  }

  noFaceCounter = 0;

  neutralSpan.textContent = data.neutral;
  stressSpan.textContent = data.stress_score;
  levelSpan.textContent = data.level;
  dominantSpan.textContent = data.dominant_emotion;

  if (genderSpan) {
    genderSpan.textContent = data.gender || "—";
  }

  if (data.details?.region) {
    const r = data.details.region;
    faceBox.style.display = "block";
    faceBox.style.left = r.x + "px";
    faceBox.style.top = r.y + "px";
    faceBox.style.width = r.w + "px";
    faceBox.style.height = r.h + "px";
  } else {
    faceBox.style.display = "none";
  }


  stressBar.style.width = `${Math.min(data.stress_score, 100)}%`;

  showAlert(
    data.level === "high" ? "⚠️ مستوى توتر مرتفع جداً!" :
    data.level === "medium" ? "تنبيه: مستوى توتر متوسط" :
    "الوضع مستقر",
    data.level
  );

  addActivityLog(data.dominant_emotion, data.level, data.gender);
}

// ----------------------------
// إيقاف / تشغيل التحليل
// ----------------------------
function stopAnalysis() {
  if (intervalID) {
    clearInterval(intervalID);
    intervalID = null;
  }
}

function startAutoAnalysis() {
  if (intervalID) return;
  analyzeFrame();
  intervalID = setInterval(analyzeFrame, ANALYSIS_INTERVAL);
}

// ----------------------------
// سجل النشاط
// ----------------------------
function addActivityLog(emotion, level, gender) {
  const item = document.createElement("div");
  const t = new Date().toLocaleTimeString("ar-SA");

  item.innerHTML = `
    <div class="activity-item">
      <strong>العاطفة:</strong> ${emotion} —
      <strong>الجنس:</strong> ${gender || "—"} —
      <strong>المستوى:</strong> ${level}
      <div class="activity-timestamp">${t}</div>
    </div>
  `;

  activityLog.prepend(item);

  while (activityLog.children.length > 10)
    activityLog.removeChild(activityLog.lastChild);
}

// ----------------------------
// التنبيهات
// ----------------------------
function showAlert(msg, level) {
  alertBox.style.display = "block";
  alertBox.className =
    "alert-box " +
    (level === "high" ? "alert-high" :
     level === "medium" ? "alert-medium" :
     "alert-low");

  alertBox.textContent = msg;
  setTimeout(() => alertBox.style.display = "none", 4500);
}

// زر التحليل اليدوي
if (analyzeBtn) analyzeBtn.addEventListener("click", analyzeFrame);
