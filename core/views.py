from __future__ import annotations

import os
import calendar
import json
import re
from datetime import date, datetime
from typing import Any, Dict, List

# -------------------------------------------------------------------
# pdfkit (optional) + wkhtmltopdf path detection (macOS ready)
# -------------------------------------------------------------------
PDFKIT_AVAILABLE = False
PDFKIT_CONFIG = None
try:
    import pdfkit  # type: ignore

    _CANDIDATES = [
        os.environ.get("WKHTMLTOPDF_BIN"),
        "/opt/homebrew/bin/wkhtmltopdf",
        "/usr/local/bin/wkhtmltopdf",
        "/usr/bin/wkhtmltopdf",
    ]
    _BIN = next((p for p in _CANDIDATES if p and os.path.exists(p)), None)
    if _BIN:
        PDFKIT_CONFIG = pdfkit.configuration(wkhtmltopdf=_BIN)
        PDFKIT_AVAILABLE = True
    else:
        PDFKIT_AVAILABLE = False
        PDFKIT_CONFIG = None
except Exception:
    PDFKIT_AVAILABLE = False
    PDFKIT_CONFIG = None

# -------------------------------------------------------------------
# Django imports
# -------------------------------------------------------------------
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import (
    FileResponse,
    Http404,
    HttpRequest,
    HttpResponse,
    HttpResponseBadRequest,
    JsonResponse,
    HttpResponseForbidden,
)
from django.shortcuts import redirect, render, get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.templatetags.static import static
from django.contrib.staticfiles import finders
from django.views.decorators.clickjacking import xframe_options_sameorigin

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

SESSION_LAST_SID = "last_student_id"
SESSION_LAST_FAC = "last_faculty"

THAI_MONTHS = [
    "",
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
]

VENUE_LABELS = {
    "pool": "สระว่ายน้ำ",
    "track": "ลู่ - ลาน",
    "outdoor": "สนามกีฬากลางแจ้ง",
    "badminton": "สนามแบดมินตัน",
}
VENUE_ORDER = ["pool", "track", "outdoor", "badminton"]

# =============================================================================
# Helpers
# =============================================================================


def _get_pending_returns() -> List[Dict[str, Any]]:
    """
    คำนวณหารายการอุปกรณ์ที่ถูกยืมและยังค้างคืนอยู่ทั้งหมด
    """
    pending_items_agg = {}
    records = BorrowRecord.objects.select_related("equipment").order_by("occurred_at")

    for r in records:
        if not r.student_id:
            continue
        key = (r.student_id, r.equipment.name)

        # **** START: EDITED SECTION ****
        # ใช้ getattr เพื่อตรวจสอบอย่างปลอดภัยว่ามี 'faculty' หรือไม่
        current_faculty = getattr(r, "faculty", "-") or "-"
        # **** END: EDITED SECTION ****

        if key not in pending_items_agg:
            pending_items_agg[key] = {
                "borrowed": 0,
                "returned": 0,
                "student_id": r.student_id,
                "faculty": current_faculty,  # <-- ใช้ตัวแปรที่ปลอดภัย
                "equipment_name": r.equipment.name,
                "borrow_date": r.occurred_at.date(),
            }

        agg_item = pending_items_agg[key]

        if r.action == "borrow":
            agg_item["borrowed"] += r.qty
        elif r.action == "return":
            agg_item["returned"] += r.qty

        # **** START: EDITED SECTION ****
        # อัปเดต faculty อย่างปลอดภัย
        if hasattr(r, "faculty") and r.faculty:
            agg_item["faculty"] = r.faculty
        # **** END: EDITED SECTION ****

    pending_items = []
    for key, agg in pending_items_agg.items():
        remaining = agg["borrowed"] - agg["returned"]
        if remaining > 0:
            pending_items.append(
                {
                    "student_id": agg["student_id"],
                    "faculty": agg["faculty"],
                    "equipment_name": agg["equipment_name"],
                    "quantity_borrowed": agg["borrowed"],
                    "quantity_pending": remaining,
                    "borrow_date": agg["borrow_date"],
                }
            )

    pending_items.sort(key=lambda x: x["student_id"])
    return pending_items


# ... (โค้ดส่วนที่เหลือเหมือนเดิมทั้งหมด ไม่มีการเปลี่ยนแปลง) ...

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


def _thai_date_label(d: date) -> str:
    return f"{d.day} {THAI_MONTHS[d.month]} {d.year + 543}"


def _thai_month_label(y: int, m: int) -> str:
    return f"{THAI_MONTHS[m]} {y + 543}"


def _monthly_pdf_path(year: int, month: int) -> str:
    return os.path.join(
        settings.MEDIA_ROOT, "reports", f"{year}", f"{month:02d}", "monthly.pdf"
    )


def _fmt_size(num: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB", "PB"]:
        if num < 1024.0:
            return f"{num:.1f} {unit}"
        num /= 1024.0
    return f"{num:.1f} EB"


def _to_thai_datetime_label(dt):
    local = timezone.localtime(dt)
    return f"{local.day} {THAI_MONTHS[local.month]} {local.year+543} {local:%H:%M}"


def _parse_date(s: str | None) -> date:
    if not s:
        return timezone.localdate()
    s = (s or "").strip()
    if s.lower() in ("undefined", "null"):
        return timezone.localdate()
    try:
        if "T" in s:
            return datetime.fromisoformat(s).date()
        return date.fromisoformat(s)
    except Exception:
        return timezone.localdate()


def _get_post_param(request: HttpRequest, key: str) -> str:
    val = request.POST.get(key)
    if val is not None:
        return val
    try:
        body = json.loads(request.body or b"{}")
        return (body.get(key) or "").strip()
    except Exception:
        return ""


def _create_event(
    request: HttpRequest, facility: str, action: str, sub: str = ""
) -> CheckinEvent:
    return CheckinEvent.objects.create(
        user=request.user if request.user.is_authenticated else None,
        facility=facility,
        action=action,
        sub_facility=sub or "",
        occurred_at=timezone.now(),
    )


# ... (The rest of the file is identical to your original, I'll include it for completeness)


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
    today = timezone.localdate()
    return render(
        request,
        "staff_console.html",
        {
            "display_name": display_name,
            "report_year": today.year,
            "report_month": today.month,
        },
    )


def mock_login(request: HttpRequest) -> HttpResponse:
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


def test_login(request: HttpRequest) -> HttpResponse:
    return mock_login(request)


@require_GET
def monthly_report_page_public(
    request: HttpRequest, year: int, month: int
) -> HttpResponse:
    token = (request.GET.get("token") or "").strip()
    expected = getattr(settings, "REPORT_RENDER_TOKEN", "")
    if not expected or token != expected:
        return HttpResponseForbidden("invalid token")

    context = {
        "org_name_th": "มหาวิทยาลัยพะเยา",
        "dept_name_th": "กองกิจการนิสิต มหาวิทยาลัยพะเยา 19 หมู่ ที่ 2 ต.แม่กา อ.เมือง จ.พะเยา 56000 โทร 0 5446 6666 ต่อ 6247-6248",
        "report_title": "ใบรายงานสถิติการเข้าใช้สนาม",
        "month_label": _thai_month_label(year, month),
        "issued_date_label": _thai_date_label(timezone.localdate()),
        "logo_url": request.build_absolute_uri(
            static("img/Logo_of_University_of_Phayao.svg.png")
        ),
        "data_url": request.build_absolute_uri(
            reverse("api_monthly_report", kwargs={"year": year, "month": month})
        ),
        "venues_th": [VENUE_LABELS[k] for k in VENUE_ORDER],
        "source_pdf_url": request.build_absolute_uri(
            reverse("monthly_report_source_pdf", kwargs={"year": year, "month": month})
        ),
        "source_pdf_info_url": request.build_absolute_uri(
            reverse("api_monthly_pdf_info", kwargs={"year": year, "month": month})
        ),
    }
    return render(request, "reports/monthly_report.html", context)


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


@require_POST
@login_required
def api_check_event(request: HttpRequest) -> JsonResponse | HttpResponseBadRequest:
    facility = (_get_post_param(request, "facility") or "").strip()
    action = (_get_post_param(request, "action") or "").strip()
    sub = (_get_post_param(request, "sub") or "").strip()

    if facility not in {"outdoor", "badminton", "pool", "track"}:
        return HttpResponseBadRequest("invalid facility")
    if action not in {"in", "out"}:
        return HttpResponseBadRequest("invalid action")

    if facility == "pool":
        if action == "in":
            _lock_pool(request)
        else:
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


@login_required
@csrf_exempt
def pool_checkin(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse(
            {"status": "error", "message": "Invalid method"}, status=405
        )
    _lock_pool(request)
    return JsonResponse({"status": "ok", "locked": True})


@login_required
@csrf_exempt
def pool_checkout(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse(
            {"status": "error", "message": "Invalid method"}, status=405
        )
    if not _is_pool_locked(request):
        return JsonResponse(
            {"status": "noop", "locked": False, "message": "Not checked in"}
        )
    _unlock_pool(request)
    request.session["pool_last_checkout_at"] = timezone.now().isoformat()
    request.session.modified = True
    return JsonResponse({"status": "ok", "locked": False, "message": "Checked out"})


# =============================================================================
# รายงานเช็คอิน (แสดงผล + API)
# =============================================================================
@login_required
def checkin_report(request: HttpRequest) -> HttpResponse:
    today = timezone.localdate()
    year = int(request.GET.get("y", today.year))
    month = int(request.GET.get("m", today.month))

    return render(
        request,
        "checkin_report.html",
        {
            "display_name": request.user.get_full_name()
            or request.user.username
            or "เจ้าหน้าที่",
            "api_checkins_url": request.build_absolute_uri(reverse("api_checkins")),
            "report_viewer_url": request.build_absolute_uri(
                reverse("monthly_report_viewer", kwargs={"year": year, "month": month})
            ),
        },
    )


@login_required
def api_checkins(request: HttpRequest) -> JsonResponse:
    date_from_str = (request.GET.get("from") or "").strip()
    date_to_str = (request.GET.get("to") or "").strip()
    facility = (request.GET.get("facility") or "").strip()

    today = timezone.localdate()
    try:
        date_from = (
            timezone.datetime.fromisoformat(date_from_str).date()
            if date_from_str
            else today
        )
    except Exception:
        date_from = today
    try:
        date_to = (
            timezone.datetime.fromisoformat(date_to_str).date()
            if date_to_str
            else today
        )
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
    pending_items = _get_pending_returns()

    return render(
        request,
        "user_equipment.html",
        {
            "equipments": items,
            "display_name": request.user.get_username(),
            "faculties": FACULTIES,
            "open_tab": "borrow",
            "pending_items": pending_items,
        },
    )


@login_required
def equipment_return_page(request: HttpRequest) -> HttpResponse:
    items = Equipment.objects.order_by("name")
    pending_items = _get_pending_returns()

    return render(
        request,
        "user_equipment.html",
        {
            "equipments": items,
            "display_name": request.user.get_username(),
            "faculties": FACULTIES,
            "open_tab": "return",
            "pending_items": pending_items,
        },
    )


@require_POST
@login_required
def equip_borrow_api(request: HttpRequest) -> JsonResponse:
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

    if not re.fullmatch(r"6\d{7}", student_id):
        return JsonResponse(
            {"message": "รหัสนิสิตต้องขึ้นต้นด้วยเลข 6 และมีทั้งหมด 8 หลักเท่านั้น"}, status=400
        )

    eq = get_object_or_404(Equipment, name=name)
    if qty > eq.stock:
        return JsonResponse(
            {"message": f"สต็อก {eq.name} คงเหลือ {eq.stock} ไม่พอ"}, status=400
        )

    eq.stock -= qty
    eq.save(update_fields=["stock"])

    create_kwargs = dict(
        equipment=eq, qty=qty, action="borrow", occurred_at=timezone.now()
    )
    if hasattr(BorrowRecord, "student_id"):
        create_kwargs["student_id"] = student_id
    if hasattr(BorrowRecord, "faculty") and fac:
        create_kwargs["faculty"] = fac

    BorrowRecord.objects.create(**create_kwargs)

    if student_id:
        request.session[SESSION_LAST_SID] = student_id
    if fac:
        request.session[SESSION_LAST_FAC] = fac
    request.session.modified = True

    return JsonResponse({"ok": True, "equipment": eq.name, "stock": eq.stock})


@require_POST
@login_required
def equip_return_api(request: HttpRequest) -> JsonResponse:
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
    eq.stock = (
        min(max_total, eq.stock + qty) if max_total is not None else eq.stock + qty
    )
    eq.save(update_fields=["stock"])

    fac_sess = (request.session.get(SESSION_LAST_FAC) or "").strip()

    create_kwargs = dict(
        equipment=eq, qty=qty, action="return", occurred_at=timezone.now()
    )
    if hasattr(BorrowRecord, "student_id"):
        create_kwargs["student_id"] = student_id
    if hasattr(BorrowRecord, "faculty") and fac_sess:
        create_kwargs["faculty"] = fac_sess

    BorrowRecord.objects.create(**create_kwargs)

    if student_id:
        request.session[SESSION_LAST_SID] = student_id
        request.session.modified = True

    return JsonResponse({"ok": True, "equipment": eq.name, "stock": eq.stock})


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
        {
            "equipment": (r.get("equipment__name") or "ไม่ระบุ"),
            "qty": int(r.get("qty") or 0),
        }
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
# Staff UIs
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
            or "เจ้าหน้าที่"
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
            or "เจ้าหน้าที่"
        },
    )


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
            eq.stock = min(max(eq.stock, stock), eq.total)
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

    eq.delete()
    return JsonResponse({"ok": True})


@login_required
@require_GET
def api_staff_borrow_records(request: HttpRequest) -> JsonResponse:
    if not _is_staff(request.user):
        return _json_bad("Forbidden", 403)

    student = (request.GET.get("student") or "").strip()
    qs = BorrowRecord.objects.select_related("equipment").order_by("-occurred_at")
    if student and hasattr(BorrowRecord, "student_id"):
        qs = qs.filter(student_id__icontains=student)

    fac_by_sid: Dict[str, str] = {}
    if hasattr(BorrowRecord, "student_id"):
        for r in qs:
            sid = getattr(r, "student_id", "") or ""
            if not sid or sid in fac_by_sid:
                continue
            fac_val = getattr(r, "faculty", "") if hasattr(r, "faculty") else ""
            if fac_val:
                fac_by_sid[sid] = fac_val
        sess_fac = (request.session.get(SESSION_LAST_FAC) or "").strip()
        sess_sid = (request.session.get(SESSION_LAST_SID) or "").strip()
        if sess_sid and sess_fac and sess_sid not in fac_by_sid:
            fac_by_sid[sess_sid] = sess_fac

    rows = []
    for r in qs[:500]:
        when_str = timezone.localtime(r.occurred_at).strftime("%d/%m/%Y %H:%M")
        sid = getattr(r, "student_id", "") or "-"
        fac = "-"
        if hasattr(r, "faculty") and getattr(r, "faculty", ""):
            fac = getattr(r, "faculty")
        elif sid in fac_by_sid:
            fac = fac_by_sid[sid]
        elif sid == (request.session.get(SESSION_LAST_SID) or ""):
            fac = request.session.get(SESSION_LAST_FAC) or "-"

        rows.append(
            {
                "student_id": sid,
                "faculty": fac,
                "equipment": r.equipment.name if r.equipment else "-",
                "qty": r.qty,
                "action": r.action,
                "when": when_str,
            }
        )
    return JsonResponse({"ok": True, "rows": rows})


# =============================================================================
# User Pending Returns
# =============================================================================
@login_required
@require_GET
def api_user_pending_returns(request: HttpRequest) -> JsonResponse:
    sid = (request.GET.get("student_id") or "").strip()
    if not sid:
        sid = (request.session.get(SESSION_LAST_SID) or "").strip()
    if not sid:
        sid = (request.user.username or "").strip()
    if not sid:
        return JsonResponse({"ok": True, "rows": [], "student_id": ""})

    qs = (
        BorrowRecord.objects.filter(student_id=sid)
        .select_related("equipment")
        .order_by("occurred_at")
    )

    # ✅ หา faculty ล่าสุดจากฐานข้อมูล
    fac = ""
    if hasattr(BorrowRecord, "faculty"):
        last_with_fac = (
            qs.exclude(faculty__isnull=True)
            .exclude(faculty="")
            .order_by("-occurred_at")
            .first()
        )
        if last_with_fac:
            fac = last_with_fac.faculty
    if not fac:
        # fallback (เผื่อกรณีเก่าที่ DB ยังไม่มีค่า)
        fac = request.session.get(SESSION_LAST_FAC) or ""

    # รวมยอดยืม/คืนต่ออุปกรณ์
    agg: Dict[str, Dict[str, int]] = {}
    for r in qs:
        name = r.equipment.name if r.equipment else "-"
        agg.setdefault(name, {"borrowed": 0, "returned": 0})
        if r.action == "borrow":
            agg[name]["borrowed"] += r.qty
        elif r.action == "return":
            agg[name]["returned"] += r.qty

    rows = []
    for name, v in agg.items():
        remaining = max(0, v["borrowed"] - v["returned"])
        if remaining > 0:
            rows.append(
                {
                    "equipment": name,
                    "borrowed": v["borrowed"],
                    "remaining": remaining,
                    "faculty": fac or "-",  # ✅ แสดงคณะล่าสุดจาก DB
                }
            )

    rows.sort(key=lambda x: x["equipment"])
    return JsonResponse({"ok": True, "rows": rows, "student_id": sid})


# -------------------------------
# API: บันทึกยืม–คืนรายวัน (ใช้ใน user_equipment.html)
# -------------------------------
@login_required
@require_GET
def equip_records_api(request: HttpRequest) -> JsonResponse:
    target_date = _parse_date(request.GET.get("date"))
    student_q = (request.GET.get("student") or "").strip()

    qs = (
        BorrowRecord.objects.select_related("equipment")
        .filter(occurred_at__date=target_date)
        .order_by("occurred_at")
    )

    if student_q and hasattr(BorrowRecord, "student_id"):
        qs = qs.filter(student_id__icontains=student_q)

    rows: List[Dict[str, Any]] = []
    for r in qs:
        local_dt = timezone.localtime(r.occurred_at)
        sid = getattr(r, "student_id", "") if hasattr(r, "student_id") else ""
        fac = getattr(r, "faculty", "") if hasattr(r, "faculty") else ""
        rows.append(
            {
                "when": local_dt.strftime("%H:%M"),
                "student_id": sid or "-",
                "faculty": fac or "-",
                "equipment": r.equipment.name if r.equipment else "-",
                "qty": int(r.qty or 1),
                "action": r.action,
            }
        )

    return JsonResponse(
        {
            "ok": True,
            "date": target_date.isoformat(),
            "rows": rows,
            "total": len(rows),
        }
    )


# =============================================================================
# Monthly Report (HTML + JSON + PDF + Meta + Viewer)
# =============================================================================
@login_required
def monthly_report_page(request: HttpRequest, year: int, month: int) -> HttpResponse:
    context = {
        "org_name_th": "มหาวิทยาลัยพะเยา",
        "dept_name_th": "กองกิจการนิสิต มหาวิทยาลัยพะเยา 19 หมู่ ที่ 2 ต.แม่กา อ.เมือง จ.พะเยา 56000 โทร 0 5446 6666 ต่อ 6247-6248",
        "report_title": "ใบรายงานสถิติการเข้าใช้สนาม",
        "month_label": _thai_month_label(year, month),
        "issued_date_label": _thai_date_label(timezone.localdate()),
        "logo_url": request.build_absolute_uri(
            static("img/Logo_of_University_of_Phayao.svg.png")
        ),
        "data_url": request.build_absolute_uri(
            reverse("api_monthly_report", kwargs={"year": year, "month": month})
        ),
        "venues_th": [VENUE_LABELS[k] for k in VENUE_ORDER],
        "source_pdf_url": request.build_absolute_uri(
            reverse("monthly_report_source_pdf", kwargs={"year": year, "month": month})
        ),
        "source_pdf_info_url": request.build_absolute_uri(
            reverse("api_monthly_pdf_info", kwargs={"year": year, "month": month})
        ),
    }
    return render(request, "reports/monthly_report.html", context)


@login_required
@require_GET
def monthly_report_build_pdf(
    request: HttpRequest, year: int, month: int
) -> JsonResponse:
    if not (PDFKIT_AVAILABLE and PDFKIT_CONFIG):
        return JsonResponse(
            {"ok": False, "message": "ยังไม่ได้ติดตั้ง wkhtmltopdf/pdfkit หรือไม่พบ binary"},
            status=500,
        )

    page_url = (
        request.build_absolute_uri(
            reverse("monthly_report", kwargs={"year": year, "month": month})
        )
        + "?print=1"
    )
    out_path = _monthly_pdf_path(year, month)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    options = {
        "javascript-delay": "1600",
        "enable-local-file-access": None,
        "no-stop-slow-scripts": None,
        "print-media-type": None,
        "page-size": "A4",
        "margin-top": "0mm",
        "margin-right": "0mm",
        "margin-bottom": "0mm",
        "margin-left": "0mm",
        "title": f"UP-FMS รายงานผู้เข้าใช้สนาม {month:02d}/{year}",
    }

    try:
        pdfkit.from_url(
            page_url, out_path, options=options, configuration=PDFKIT_CONFIG
        )
        return JsonResponse({"ok": True, "file_path": out_path})
    except Exception as e:
        return JsonResponse({"ok": False, "message": str(e)}, status=500)


@login_required
def monthly_report_viewer(request: HttpRequest, year: int, month: int) -> HttpResponse:
    fpath = _monthly_pdf_path(year, month)
    if not os.path.exists(fpath) and PDFKIT_AVAILABLE and PDFKIT_CONFIG:
        try:
            page_url = (
                request.build_absolute_uri(
                    reverse("monthly_report", kwargs={"year": year, "month": month})
                )
                + "?print=1"
            )
            os.makedirs(os.path.dirname(fpath), exist_ok=True)
            options = {
                "javascript-delay": "1600",
                "enable-local-file-access": None,
                "no-stop-slow-scripts": None,
                "print-media-type": None,
                "page-size": "A4",
                "margin-top": "0mm",
                "margin-right": "0mm",
                "margin-bottom": "0mm",
                "margin-left": "0mm",
                "title": f"UP-FMS รายงานผู้เข้าใช้สนาม {month:02d}/{year}",
            }
            pdfkit.from_url(
                page_url, fpath, options=options, configuration=PDFKIT_CONFIG
            )
        except Exception:
            pass

    ctx = {
        "year": year,
        "month": month,
        "month_label": _thai_month_label(year, month),
        "back_url": request.META.get("HTTP_REFERER", reverse("checkin_report")),
        "source_pdf_url": request.build_absolute_uri(
            reverse("monthly_report_source_pdf", kwargs={"year": year, "month": month})
        ),
        "build_url": request.build_absolute_uri(
            reverse("monthly_report_build_pdf", kwargs={"year": year, "month": month})
        ),
        "title": "รายงานประจำเดือน",
    }
    return render(request, "reports/pdf_viewer.html", ctx)


@login_required
def monthly_report_source_pdf(
    request: HttpRequest, year: int, month: int
) -> FileResponse:
    fpath = _monthly_pdf_path(year, month)
    if not os.path.exists(fpath):
        fallback = finders.find("pdf/sample_monthly.pdf")
        if not fallback or not os.path.exists(fallback):
            raise Http404("PDF not found")
        fpath = fallback

    disp = "attachment" if request.GET.get("dl") == "1" else "inline"
    resp = FileResponse(open(fpath, "rb"), content_type="application/pdf")
    resp["Content-Disposition"] = f'{disp}; filename="report_{year}_{month:02d}.pdf"'
    return resp


@login_required
def api_monthly_pdf_info(request: HttpRequest, year: int, month: int) -> JsonResponse:
    fpath = _monthly_pdf_path(year, month)
    exists = os.path.exists(fpath)
    size = os.path.getsize(fpath) if exists else 0
    mtime = (
        timezone.make_aware(datetime.fromtimestamp(os.path.getmtime(fpath)))
        if exists
        else None
    )
    ctime = (
        timezone.make_aware(datetime.fromtimestamp(os.path.getctime(fpath)))
        if exists
        else None
    )

    info = {
        "file_exists": exists,
        "file_path": fpath,
        "file_url": request.build_absolute_uri(
            reverse("monthly_report_source_pdf", kwargs={"year": year, "month": month})
        ),
        "file_size_label": _fmt_size(size) if exists else "0 B",
        "created_at": _to_thai_datetime_label(ctime) if exists else "",
        "modified_at": _to_thai_datetime_label(mtime) if exists else "",
        "report_scope": {
            "month_label": _thai_month_label(year, month),
            "venues": [VENUE_LABELS[k] for k in VENUE_ORDER],
        },
        "sections": [
            {
                "title": "รวมทุกสนาม",
                "widgets": [
                    "กราฟวงกลมแสดงสัดส่วนนิสิต/บุคลากร",
                    "กราฟแท่งเปรียบเทียบแต่ละสนาม",
                    "กราฟเส้นแสดงจำนวนผู้ใช้รายวัน",
                ],
            },
            {
                "title": "รายสนาม (สระว่ายน้ำ, ลู่-ลาน, กลางแจ้ง, แบดมินตัน)",
                "widgets": ["กราฟวงกลมสถานะผู้ใช้", "กราฟเส้นรายวัน"],
            },
            {
                "title": "ตารางรายวัน (รวมทุกสนาม)",
                "columns": [
                    "วันที่",
                    "สระว่ายน้ำ นิสิต/บุคลากร",
                    "ลู่-ลาน นิสิต/บุคลากร",
                    "กลางแจ้ง นิสิต/บุคลากร",
                    "แบดมินตัน นิสิต/บุคลากร",
                    "รวมต่อวัน",
                ],
            },
        ],
    }
    return JsonResponse(info)


@login_required
def api_monthly_report(request: HttpRequest, year: int, month: int) -> JsonResponse:
    last_day = calendar.monthrange(year, month)[1]
    tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(datetime(year, month, 1, 0, 0, 0), tz)
    end_dt = timezone.make_aware(datetime(year, month, last_day, 23, 59, 59), tz)

    day_rows = [
        {
            "day": d,
            "pool": {"student": 0, "staff": 0},
            "track": {"student": 0, "staff": 0},
            "outdoor": {"student": 0, "staff": 0},
            "badminton": {"student": 0, "staff": 0},
        }
        for d in range(1, last_day + 1)
    ]

    qs = CheckinEvent.objects.select_related("user").filter(
        occurred_at__range=(start_dt, end_dt), action="in"
    )

    for e in qs.iterator():
        local_dt = timezone.localtime(e.occurred_at, tz)
        day = local_dt.day
        fac = e.facility
        if fac not in VENUE_ORDER:
            continue
        role = "staff" if (e.user and e.user.is_staff) else "student"
        day_rows[day - 1][fac][role] += 1

    totals = []
    for key in VENUE_ORDER:
        s = sum(row[key]["student"] for row in day_rows)
        t = sum(row[key]["staff"] for row in day_rows)
        totals.append({"venue": VENUE_LABELS[key], "student": s, "staff": t})

    payload = {
        "meta": {
            "year": year,
            "month": month,
            "month_label": _thai_month_label(year, month),
            "issued_date": _thai_date_label(timezone.localdate()),
        },
        "totals_by_venue": totals,
        "day_rows": day_rows,
    }
    return JsonResponse(payload)


# ====== Misc ======
@login_required
def badminton_booking(request: HttpRequest) -> HttpResponse:
    return HttpResponse("หน้าจองสนามแบดมินตัน (ผู้ใช้) – กำลังพัฒนา")


@login_required
def staff_badminton_booking(request: HttpRequest) -> HttpResponse:
    if not _is_staff(request.user):
        return HttpResponse("Forbidden", status=403)
    return HttpResponse("หน้าจองสนามแบดมินตัน (เจ้าหน้าที่) – กำลังพัฒนา")


@login_required
def user_menu(request: HttpRequest) -> HttpResponse:
    display_name = request.user.get_full_name() or request.user.username or "ผู้ใช้งาน"
    return render(
        request,
        "user_menu.html",
        {"display_name": display_name, "pool_locked": _is_pool_locked(request)},
    )


def health(request: HttpRequest) -> HttpResponse:
    return HttpResponse("OK")
