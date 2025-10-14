from __future__ import annotations

from datetime import date
from typing import Any, Dict, List
import json
import re  # ✅ เพิ่มเพื่อใช้เช็กรูปแบบรหัสนิสิต

from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import (
    HttpRequest,
    HttpResponse,
    HttpResponseBadRequest,
    JsonResponse,
)
from django.shortcuts import redirect, render, get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_http_methods, require_GET

from .models import CheckinEvent, BorrowRecord, Equipment

User = get_user_model()

# =============================================================================
# Constants
# =============================================================================
FACULTIES: List[str] = [
    "คณะเกษตรศาสตร์และทรัพยากรธรรมชาติ",
    "คณะพลังงานและสิ่งแวดล้อม",
    "คณะเทคโนโลยีสารสนเทศและการสื่อสาร",
    "คณะพยาบาลศาสตร์",
    "คณะแพทยศาสตร์",
    "คณะทันตแพทยศาสตร์",
    "คณะสาธารณสุขศาสตร์",
    "คณะเภสัชศาสตร์",
    "คณะสหเวชศาสตร์",
    "คณะวิศวกรรมศาสตร์",
    "คณะวิทยาศาสตร์",
    "คณะวิทยาศาสตร์การแพทย์",
    "คณะรัฐศาสตร์และสังคมศาสตร์",
    "คณะนิติศาสตร์",
    "คณะบริหารธุรกิจและนิเทศศาสตร์",
    "คณะศิลปศาสตร์",
    "คณะสถาปัตยกรรมศาสตร์และศิลปกรรมศาสตร์",
    "วิทยาลัยการศึกษา",
]

# จำผู้ยืมล่าสุดไว้ เพื่อให้หน้าคืนดึงอัตโนมัติ
SESSION_LAST_SID = "last_student_id"
SESSION_LAST_FAC = "last_faculty"

# =============================================================================
# Helpers / Session flag (สระว่ายน้ำ)
# =============================================================================
POOL_LOCK_KEY = "pool_locked"

def _lock_pool(request: HttpRequest) -> None:
    request.session[POOL_LOCK_KEY] = True
    request.session.modified = True

def _unlock_pool(request: HttpRequest) -> None:
    request.session[POOL_LOCK_KEY] = False
    request.session.modified = True

def _is_pool_locked(request: HttpRequest) -> bool:
    return bool(request.session.get(POOL_LOCK_KEY, False))

def _is_staff(user: Any) -> bool:
    return bool(user and (user.is_staff or user.is_superuser))

def _json_bad(msg: str, code: int = 400) -> JsonResponse:
    return JsonResponse({"ok": False, "message": msg}, status=code)

# =============================================================================
# Login / Logout / Consoles
# =============================================================================
def login_page(request: HttpRequest) -> HttpResponse:
    return render(request, "registration/login.html")

@login_required
def staff_console(request: HttpRequest) -> HttpResponse:
    if not _is_staff(request.user):
        return HttpResponse("Forbidden", status=403)
    display_name = request.user.get_full_name() or request.user.username or "เจ้าหน้าที่"
    return render(request, "staff_console.html", {"display_name": display_name})

@login_required
def user_menu(request: HttpRequest) -> HttpResponse:
    display_name = request.user.get_full_name() or request.user.username or "ผู้ใช้งาน"
    return render(
        request,
        "user_menu.html",
        {"display_name": display_name, "pool_locked": _is_pool_locked(request)},
    )

def mock_login(request: HttpRequest) -> HttpResponse:
    """เดโม่ลอกอิน: /auth/?role=staff หรือ /auth/?role=user"""
    role = (request.GET.get("role") or "staff").strip()
    email = "b6500001@up.ac.th"
    user, _ = User.objects.get_or_create(
        username=email,
        defaults={"email": email, "first_name": "Student", "last_name": "One"},
    )
    user.is_staff = role == "staff"
    user.save(update_fields=["is_staff"])
    login(request, user)
    _unlock_pool(request)
    return redirect("staff_console" if role == "staff" else "user_menu")

def logout_view(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect("login")

# =============================================================================
# หน้าเลือกสนาม/เช็คอิน (ผู้ใช้)
# =============================================================================
@login_required
def choose(request: HttpRequest) -> HttpResponse:
    if _is_pool_locked(request):
        return render(
            request,
            "locked.html",
            {"reason": "คุณยังไม่ได้เช็คเอาต์ออกจากสระว่ายน้ำ กรุณาเช็คเอาต์ก่อนใช้งานสนามอื่น"},
            status=403,
        )
    return render(request, "choose.html")

def _create_event(request: HttpRequest, facility: str, action: str, sub: str = "") -> CheckinEvent:
    return CheckinEvent.objects.create(
        user=request.user if request.user.is_authenticated else None,
        facility=facility,          # outdoor|badminton|pool|track
        action=action,              # in|out
        sub_facility=sub or "",     # เก็บสนามย่อย
        occurred_at=timezone.now(),
    )

def _get_post_param(request: HttpRequest, key: str) -> str:
    val = request.POST.get(key)
    if val is not None:
        return val
    try:
        body = json.loads(request.body or b"{}")
        return (body.get(key) or "").strip()
    except Exception:
        return ""

@require_POST
@login_required
def api_check_event(request: HttpRequest) -> JsonResponse | HttpResponseBadRequest:
    facility = (_get_post_param(request, "facility") or "").strip()
    action   = (_get_post_param(request, "action") or "").strip()
    sub      = (_get_post_param(request, "sub") or "").strip()   # รับ sub จาก frontend

    if facility not in {"outdoor", "badminton", "pool", "track"}:
        return HttpResponseBadRequest("invalid facility")
    if action not in {"in", "out"}:
        return HttpResponseBadRequest("invalid action")

    if facility == "pool":
        if action == "in":
            _lock_pool(request)
        else:  # out
            if not _is_pool_locked(request):
                return JsonResponse(
                    {"ok": False, "error": "not_checked_in", "locked": False}
                )
            _unlock_pool(request)

    evt = _create_event(request, facility, action, sub=sub)
    local_dt = timezone.localtime(evt.occurred_at)
    session_date = local_dt.date().isoformat()

    role = "staff" if (evt.user and evt.user.is_staff) else "student"

    return JsonResponse(
        {
            "ok": True,
            "id": evt.id,
            "facility": evt.facility,
            "sub_facility": evt.sub_facility,
            "action": evt.action,
            "role": role,
            "ts": local_dt.isoformat(),
            "session_date": session_date,
        }
    )

# Quick pool API (เดโม่)
@login_required
@csrf_exempt
def pool_checkin(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "Invalid method"}, status=405)
    _lock_pool(request)
    return JsonResponse({"status": "ok", "locked": True})

@login_required
@csrf_exempt
def pool_checkout(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "Invalid method"}, status=405)
    if not _is_pool_locked(request):
        return JsonResponse({"status": "noop", "locked": False, "message": "Not checked in"})
    _unlock_pool(request)
    request.session["pool_last_checkout_at"] = timezone.now().isoformat()
    request.session.modified = True
    return JsonResponse({"status": "ok", "locked": False, "message": "Checked out"})

# =============================================================================
# รายงานเช็คอิน (แสดงผล + API)
# =============================================================================
@login_required
def checkin_report(request: HttpRequest) -> HttpResponse:
    return render(request, "checkin_report.html")

@login_required
def api_checkins(request: HttpRequest) -> JsonResponse:
    date_from_str = (request.GET.get("from") or "").strip()
    date_to_str   = (request.GET.get("to") or "").strip()
    facility      = (request.GET.get("facility") or "").strip()

    today = timezone.localdate()
    try:
        date_from = timezone.datetime.fromisoformat(date_from_str).date() if date_from_str else today
    except Exception:
        date_from = today
    try:
        date_to = timezone.datetime.fromisoformat(date_to_str).date() if date_to_str else today
    except Exception:
        date_to = today

    qs = CheckinEvent.objects.select_related("user").all()
    if facility in {"outdoor", "badminton", "pool", "track"}:
        qs = qs.filter(facility=facility)

    start_dt = timezone.make_aware(
        timezone.datetime.combine(date_from, timezone.datetime.min.time())
    )
    end_dt = timezone.make_aware(
        timezone.datetime.combine(date_to, timezone.datetime.max.time())
    )
    qs = qs.filter(occurred_at__range=(start_dt, end_dt)).order_by("occurred_at")

    rows: List[Dict[str, Any]] = []
    for evt in qs:
        local_dt = timezone.localtime(evt.occurred_at)
        role = "staff" if (evt.user and evt.user.is_staff) else "student"
        rows.append(
            {
                "ts": local_dt.isoformat(),
                "session_date": local_dt.date().isoformat(),
                "facility": evt.facility,
                "sub_facility": evt.sub_facility or "",
                "action": evt.action,
                "role": role,
            }
        )
    return JsonResponse(rows, safe=False)

# =============================================================================
# ยืม–คืนอุปกรณ์ (หน้า + API + สถิติ)
# =============================================================================
@login_required
def user_equipment(request: HttpRequest) -> HttpResponse:
    items = Equipment.objects.order_by("name")
    return render(
        request,
        "user_equipment.html",
        {
            "equipments": items,
            "display_name": request.user.get_username(),
            "faculties": FACULTIES,
        },
    )

@login_required
def equipment_return_page(request: HttpRequest) -> HttpResponse:
    items = Equipment.objects.order_by("name")
    return render(
        request,
        "equipment_return.html",
        {
            "equipments": items,
            "display_name": request.user.get_username(),
        },
    )

@require_POST
@login_required
def equip_borrow_api(request: HttpRequest) -> JsonResponse:
    """
    รับ JSON: { "equipment": "<ชื่อ>", "qty": <int>, "student_id": "<str?>", "faculty": "<str?>" }
    ลด stock และคืนค่า stock ล่าสุด + บันทึก BorrowRecord
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
        name = (payload.get("equipment") or "").strip()
        qty = int(payload.get("qty", 1))
        student_id = (payload.get("student_id") or "").strip()
        fac = (payload.get("faculty") or "").strip()
    except Exception:
        return JsonResponse({"message": "รูปแบบข้อมูลไม่ถูกต้อง"}, status=400)

    if not name:
        return JsonResponse({"message": "กรุณาระบุอุปกรณ์"}, status=400)
    if qty < 1:
        return JsonResponse({"message": "จำนวนไม่ถูกต้อง"}, status=400)

    # ✅ เช็ครหัสนิสิต: ต้องขึ้นต้นด้วย 6 และมี 8 หลัก
    if not re.fullmatch(r"6\d{7}", student_id):
        return JsonResponse(
            {"message": "รหัสนิสิตต้องขึ้นต้นด้วยเลข 6 และมีทั้งหมด 8 หลักเท่านั้น"},
            status=400
        )

    eq = get_object_or_404(Equipment, name=name)
    if qty > eq.stock:
        return JsonResponse({"message": f"สต็อก {eq.name} คงเหลือ {eq.stock} ไม่พอ"}, status=400)

    # หักสต็อก
    eq.stock -= qty
    eq.save(update_fields=["stock"])

    # เก็บประวัติ
    create_kwargs = dict(
        equipment=eq, qty=qty, action="borrow", occurred_at=timezone.now()
    )
    if hasattr(BorrowRecord, "student_id"):
        create_kwargs["student_id"] = student_id
    BorrowRecord.objects.create(**create_kwargs)

    # จำค่าไว้ใน session
    if student_id:
        request.session[SESSION_LAST_SID] = student_id
        request.session.modified = True
    if fac:
        request.session[SESSION_LAST_FAC] = fac
        request.session.modified = True

    return JsonResponse({"ok": True, "equipment": eq.name, "stock": eq.stock})

@require_POST
@login_required
def equip_return_api(request: HttpRequest) -> JsonResponse:
    """
    รับ JSON: { "equipment": "<ชื่อ>", "qty": <int>, "student_id": "<str?>" }
    เพิ่ม stock กลับ + บันทึก BorrowRecord
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
        name = (payload.get("equipment") or "").strip()
        qty = int(payload.get("qty", 1))
        student_id = (payload.get("student_id") or "").strip()
    except Exception:
        return JsonResponse({"message": "รูปแบบข้อมูลไม่ถูกต้อง"}, status=400)

    if not name:
        return JsonResponse({"message": "กรุณาระบุอุปกรณ์"}, status=400)
    if qty < 1:
        return JsonResponse({"message": "จำนวนไม่ถูกต้อง"}, status=400)

    eq = get_object_or_404(Equipment, name=name)

    max_total = eq.total if isinstance(eq.total, int) else None
    if max_total is not None:
        eq.stock = min(max_total, eq.stock + qty)
    else:
        eq.stock = eq.stock + qty
    eq.save(update_fields=["stock"])

    create_kwargs = dict(
        equipment=eq, qty=qty, action="return", occurred_at=timezone.now()
    )
    if hasattr(BorrowRecord, "student_id"):
        create_kwargs["student_id"] = student_id
    BorrowRecord.objects.create(**create_kwargs)

    # อัปเดต session ล่าสุด (รองรับกรณีพิมพ์ SID ในหน้าคืน)
    if student_id:
        request.session[SESSION_LAST_SID] = student_id
        request.session.modified = True

    return JsonResponse({"ok": True, "equipment": eq.name, "stock": eq.stock})

# --- สถิติการยืม-คืน ---
def _parse_date(s: str | None) -> date:
    if not s:
        return timezone.localdate()
    try:
        return date.fromisoformat(s)
    except Exception:
        return timezone.localdate()

@login_required
def user_borrow_stats(request: HttpRequest) -> HttpResponse:
    today = timezone.localdate().isoformat()
    return render(
        request,
        "borrow_stats.html",
        {
            "today": today,
            "can_export": False,
            "display_name": request.user.get_full_name()
            or request.user.username
            or "ผู้ใช้งาน",
        },
    )

@login_required
def staff_borrow_stats(request: HttpRequest) -> HttpResponse:
    if not _is_staff(request.user):
        return HttpResponse("Forbidden", status=403)
    today = timezone.localdate().isoformat()
    return render(
        request,
        "staff_borrow_stats.html",
        {
            "today": today,
            "can_export": True,
            "display_name": request.user.get_full_name()
            or request.user.username
            or "เจ้าหน้าที่",
        },
    )

@login_required
def api_borrow_stats(request: HttpRequest) -> JsonResponse:
    dfrom = _parse_date(request.GET.get("from"))
    dto = _parse_date(request.GET.get("to"))
    action = (request.GET.get("action") or "borrow").strip()

    qs = BorrowRecord.objects.all().filter(occurred_at__date__range=(dfrom, dto))
    if action in {"borrow", "return"}:
        qs = qs.filter(action=action)

    rows_qs = qs.values("equipment__name").annotate(qty=Sum("qty")).order_by("-qty")
    rows = [
        {"equipment": r["equipment__name"] or "ไม่ระบุ", "qty": r["qty"] or 0}
        for r in rows_qs
    ]
    total = sum(r["qty"] for r in rows)
    return JsonResponse(
        {
            "from": dfrom.isoformat(),
            "to": dto.isoformat(),
            "action": action,
            "rows": rows,
            "total": total,
        }
    )

@staff_member_required
def export_borrow_stats_csv(request: HttpRequest) -> HttpResponse:
    api_resp: JsonResponse = api_borrow_stats(request)
    data = json.loads(api_resp.content.decode("utf-8"))
    import csv

    resp = HttpResponse(content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = 'attachment; filename="borrow-stats.csv"'
    w = csv.writer(resp)
    w.writerow(["ช่วงวันที่", f'{data["from"]} - {data["to"]}'])
    w.writerow(["ประเภท", "ยืม" if data["action"] == "borrow" else "คืน"])
    w.writerow([])
    w.writerow(["ลำดับ", "รายการ", "จำนวนครั้ง"])
    for i, r in enumerate(data["rows"], start=1):
        w.writerow([i, r["equipment"], r["qty"]])
    w.writerow([])
    w.writerow(["รวมทั้งหมด", "", data["total"]])
    return resp

# =============================================================================
# หน้าจัดการอุปกรณ์ / บันทึกยืม-คืน (Staff UI)
# =============================================================================
@login_required
def staff_equipment(request: HttpRequest) -> HttpResponse:
    if not _is_staff(request.user):
        return HttpResponse("Forbidden", status=403)
    return render(
        request,
        "staff_equipment.html",
        {
            "display_name": request.user.get_full_name()
            or request.user.username
            or "เจ้าหน้าที่",
        },
    )

@login_required
def staff_borrow_ledger(request: HttpRequest) -> HttpResponse:
    if not _is_staff(request.user):
        return HttpResponse("Forbidden", status=403)
    return render(
        request,
        "staff_borrow_ledger.html",
        {
            "display_name": request.user.get_full_name()
            or request.user.username
            or "เจ้าหน้าที่",
        },
    )

# เพิ่ม view ให้ตรงกับ urls
@login_required
def badminton_booking(request: HttpRequest) -> HttpResponse:
    return HttpResponse("หน้าจองสนามแบดมินตัน (ผู้ใช้) – กำลังพัฒนา")

@login_required
def staff_badminton_booking(request: HttpRequest) -> HttpResponse:
    if not _is_staff(request.user):
        return HttpResponse("Forbidden", status=403)
    return HttpResponse("หน้าจองสนามแบดมินตัน (เจ้าหน้าที่) – กำลังพัฒนา")

def health(request: HttpRequest) -> HttpResponse:
    return HttpResponse("OK")

# =============================================================================
# Staff Equipment CRUD APIs
# =============================================================================
@login_required
@require_GET
def api_staff_equipments(request: HttpRequest) -> JsonResponse:
    if not _is_staff(request.user):
        return _json_bad("Forbidden", 403)
    qs = Equipment.objects.order_by("name").values("id", "name", "total", "stock")
    return JsonResponse({"ok": True, "rows": list(qs)})

@login_required
@require_http_methods(["POST", "PATCH", "DELETE"])
def api_staff_equipment_detail(request: HttpRequest, pk: int) -> JsonResponse:
    if not _is_staff(request.user):
        return _json_bad("Forbidden", 403)

    if request.method == "POST":
        try:
            data = json.loads(request.body.decode("utf-8"))
        except Exception:
            return _json_bad("invalid json")

        name = (data.get("name") or "").strip()
        total = int(data.get("total", 10))
        stock = int(data.get("stock", total))
        if not name:
            return _json_bad("กรุณาระบุชื่ออุปกรณ์")

        eq, created = Equipment.objects.get_or_create(
            name=name, defaults={"total": total, "stock": stock}
        )
        if not created:
            eq.total = max(eq.total, total)
            eq.stock = max(eq.stock, stock)
            eq.save(update_fields=["total", "stock"])

        return JsonResponse(
            {
                "ok": True,
                "row": {
                    "id": eq.id,
                    "name": eq.name,
                    "total": eq.total,
                    "stock": eq.stock,
                },
            }
        )

    eq = get_object_or_404(Equipment, pk=pk)

    if request.method == "PATCH":
        try:
            data = json.loads(request.body.decode("utf-8"))
        except Exception:
            return _json_bad("invalid json")

        if "name" in data:
            new_name = (data["name"] or "").strip()
            if not new_name:
                return _json_bad("ชื่ออุปกรณ์ไม่ถูกต้อง")
            eq.name = new_name
        if "total" in data:
            t = int(data["total"])
            if t < 0:
                return _json_bad("total ต้อง ≥ 0")
            eq.total = t
            if eq.stock > t:
                eq.stock = t
        if "stock" in data:
            s = int(data["stock"])
            if s < 0:
                return _json_bad("stock ต้อง ≥ 0")
            eq.stock = min(s, eq.total if eq.total else s)

        eq.save()
        return JsonResponse(
            {
                "ok": True,
                "row": {
                    "id": eq.id,
                    "name": eq.name,
                    "total": eq.total,
                    "stock": eq.stock,
                },
            }
        )

    # DELETE
    eq.delete()
    return JsonResponse({"ok": True})

# =============================================================================
# Staff Borrow Ledger API
# =============================================================================
@login_required
@require_GET
def api_staff_borrow_records(request: HttpRequest) -> JsonResponse:
    if not _is_staff(request.user):
        return _json_bad("Forbidden", 403)

    student = (request.GET.get("student") or "").strip()
    qs = BorrowRecord.objects.select_related("equipment").order_by("-occurred_at")
    if student:
        if hasattr(BorrowRecord, "student_id"):
            qs = qs.filter(student_id__icontains=student)

    rows = []
    for r in qs[:300]:
        when_str = timezone.localtime(r.occurred_at).strftime("%-d/%-m/%Y %H:%M")
        rows.append(
            {
                "student_id": getattr(r, "student_id", "") or "-",
                "equipment": r.equipment.name if r.equipment else "-",
                "qty": r.qty,
                "action": r.action,  # "borrow" / "return"
                "when": when_str,
            }
        )
    return JsonResponse({"ok": True, "rows": rows})

# =============================================================================
# User Pending Returns (AUTO)
# =============================================================================
@login_required
@require_GET
def api_user_pending_returns(request: HttpRequest) -> JsonResponse:
    """
    คืนรายการค้างคืนเป็นกลุ่มต่ออุปกรณ์ของผู้ใช้
    แหล่งอ้างอิง student_id (ลำดับความสำคัญ):
      1) ?student_id=...
      2) session['last_student_id']
      3) request.user.username
    faculty จะมาจาก session['last_faculty']
    """
    sid = (request.GET.get("student_id") or "").strip()
    if not sid:
        sid = (request.session.get(SESSION_LAST_SID) or "").strip()
    if not sid:
        sid = (request.user.username or "").strip()

    if not sid:
        return JsonResponse({"ok": True, "rows": [], "student_id": ""})

    qs = BorrowRecord.objects.filter(student_id=sid).select_related("equipment")

    agg: Dict[str, Dict[str, int]] = {}
    for r in qs:
        name = r.equipment.name if r.equipment else "-"
        if name not in agg:
            agg[name] = {"borrowed": 0, "returned": 0}
        if r.action == "borrow":
            agg[name]["borrowed"] += r.qty
        elif r.action == "return":
            agg[name]["returned"] += r.qty

    rows = []
    fac = request.session.get(SESSION_LAST_FAC, "")
    for name, v in agg.items():
        remaining = max(0, v["borrowed"] - v["returned"])
        if remaining > 0:
            rows.append({
                "equipment": name,
                "borrowed": v["borrowed"],
                "remaining": remaining,
                "faculty": fac,
            })

    rows.sort(key=lambda x: x["equipment"])
    return JsonResponse({"ok": True, "rows": rows, "student_id": sid})
