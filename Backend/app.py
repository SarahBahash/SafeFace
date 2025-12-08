from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from deepface import DeepFace
import cv2
import numpy as np
import logging

app = FastAPI()

# السماح للفرونت إند بالدخول
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # ممكن تخصصينها لاحقًا
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    try:
        # تحويل الملف لصورة OpenCV
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "error", "message": "Invalid image data"}

        # استدعاء DeepFace
        result = DeepFace.analyze(
            img,
            actions=["emotion"],
            enforce_detection=False
        )

        # أحياناً DeepFace يرجع list
        if isinstance(result, list):
            result = result[0]

        emotions_raw = result.get("emotion", {}) or {}
        # نحول كل القيم إلى float Python عادي عشان ما يزعّل FastAPI
        emotions = {k: float(v) for k, v in emotions_raw.items()}

        neutral = float(emotions.get("neutral", 0.0))
        fear = float(emotions.get("fear", 0.0))
        angry = float(emotions.get("angry", 0.0))
        stress_score = fear + angry

        # مستوى الخطورة
        if stress_score < 30:
            level = "low"
        elif stress_score < 60:
            level = "medium"
        else:
            level = "high"

        # إحداثيات الوجه (region)
        region_raw = result.get("region") or result.get("face_region") or {}
        region = None
        if isinstance(region_raw, dict) and all(k in region_raw for k in ("x", "y", "w", "h")):
            region = {
                "x": int(region_raw["x"]),
                "y": int(region_raw["y"]),
                "w": int(region_raw["w"]),
                "h": int(region_raw["h"]),
            }

        dominant = result.get("dominant_emotion", "unknown")

        # حالة ما فيه وجه واضح
        if region is None and sum(emotions.values()) == 0:
            return {
                "status": "no_face",
                "message": "No face detected"
            }

        return {
            "status": "ok",
            "neutral": round(neutral, 2),
            "stress_score": round(stress_score, 2),
            "level": level,
            "dominant_emotion": dominant,
            "details": {
                "region": region,
                "emotions": emotions
            }
        }

    except Exception as e:
        logger.exception(f"Error analyzing image: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
