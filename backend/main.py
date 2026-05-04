from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timezone
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY"),
)


def determine_status(has_person: bool, has_items: bool) -> str:
    if has_person:
        return "occupied"
    if has_items:
        return "ghost"   # 물건만 있음 = 유령 좌석
    return "available"


def update_seat(seat_id: int, has_person: bool, has_items: bool):
    status = determine_status(has_person, has_items)
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("seats").update({
        "has_person": has_person,
        "has_items": has_items,
        "status": status,
        "last_updated": now,
    }).eq("id", seat_id).execute()

    supabase.table("OccupancyLogs").insert({
        "seat_id": seat_id,
        "event_type": status,
        "created_at": now,
    }).execute()

    return status


# ── 헬스체크 ──────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


# ── 좌석 전체 조회 ────────────────────────────────────
@app.get("/seats")
def get_seats():
    result = supabase.table("seats").select("*").order("id").execute()
    return result.data


# ── 좌석 상태 직접 업데이트 (YOLO 결과를 로컬에서 보낼 때) ──
class SeatUpdate(BaseModel):
    seat_id: int
    has_person: bool
    has_items: bool

@app.post("/update-seat")
def post_update_seat(payload: SeatUpdate):
    status = update_seat(payload.seat_id, payload.has_person, payload.has_items)
    return {"seat_id": payload.seat_id, "status": status}


# ── 이미지 받아서 EC2에서 직접 YOLO 추론 ─────────────
@app.post("/analyze")
async def analyze(seat_id: int, file: UploadFile = File(...)):
    try:
        from ultralytics import YOLO
        import numpy as np
        import cv2

        contents = await file.read()
        img_array = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        model = YOLO("yolov8n.pt")
        results = model(frame, verbose=False)[0]

        has_person = False
        has_items = False

        for box in results.boxes:
            cls = int(box.cls[0])
            label = model.names[cls]
            if label == "person":
                has_person = True
            elif label in ("backpack", "handbag", "suitcase", "laptop", "book", "cup", "bottle"):
                has_items = True

        status = update_seat(seat_id, has_person, has_items)
        return {"seat_id": seat_id, "has_person": has_person, "has_items": has_items, "status": status}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
