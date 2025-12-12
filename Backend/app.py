from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from deepface import DeepFace
import cv2
import numpy as np
import logging

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "error", "message": "Invalid image"}

        # تحليل المشاعر + الجنس
        result = DeepFace.analyze(
            img,
            actions=["emotion", "gender"],
            enforce_detection=False
        )

        if isinstance(result, list):
            result = result[0]

        emotions_raw = result.get("emotion", {}) or {}
        emotions = {k: float(v) for k, v in emotions_raw.items()}

        # إذا ما فيه وجه
        if not emotions or sum(emotions.values()) == 0:
            return {
                "status": "no_face",
                "message": "No face detected"
            }

        # حساب التوتر
        fear = emotions.get("fear", 0)
        angry = emotions.get("angry", 0)
        stress_score = fear + angry

        if stress_score < 30:
            level = "low"
        elif stress_score < 60:
            level = "medium"
        else:
            level = "high"

        # تحديد الجنس
        gender = result.get("dominant_gender", "unknown")

        # إحداثيات الوجه
        region_raw = result.get("region", {})
        region = None
        if isinstance(region_raw, dict):
            region = {
                "x": int(region_raw.get("x", 0)),
                "y": int(region_raw.get("y", 0)),
                "w": int(region_raw.get("w", 0)),
                "h": int(region_raw.get("h", 0)),
            }

        return {
            "status": "ok",
            "neutral": emotions.get("neutral", 0),
            "stress_score": round(stress_score, 2),
            "dominant_emotion": result.get("dominant_emotion", "unknown"),
            "level": level,
            "gender": gender,
            "details": {
                "region": region
            }
        }

    except Exception as e:
        logger.exception("Analysis error")
        return {
            "status": "error",
            "message": str(e)
        }
