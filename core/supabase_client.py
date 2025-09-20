# core/supabase_client.py
import os
from typing import Optional

try:
    # โหลด .env ถ้ามี (ไม่บังคับ)
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL") or ""
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or ""
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

IS_SUPABASE_CONFIGURED = bool(SUPABASE_URL and SUPABASE_ANON_KEY)

# ถ้ายังไม่ได้ตั้งค่า ให้ supabase เป็น None เพื่อไม่ให้ระบบล้มตั้งแต่ import
supabase: Optional[object] = None
supabase_service: Optional[object] = None

if IS_SUPABASE_CONFIGURED:
    # ใช้ไลบรารี supabase อย่างปลอดภัยเมื่อมีค่า env ครบ
    try:
        from supabase import create_client, Client  # type: ignore

        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

        # บางงานต้องใช้ service role (ถ้าไม่มีก็ปล่อยเป็น None)
        if SUPABASE_SERVICE_ROLE_KEY:
            supabase_service = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)  # type: ignore
    except Exception as e:
        # ถ้า import/สร้าง client ผิดพลาด ให้ไม่ล้มทั้งโปรเจ็กต์
        print(f"[supabase_client] Failed to init Supabase: {e}")
        supabase = None
        supabase_service = None
        IS_SUPABASE_CONFIGURED = False
else:
    # เตือนในคอนโซลเฉย ๆ แต่ไม่ raise
    print("[supabase_client] Supabase is not configured. "
          "Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env")