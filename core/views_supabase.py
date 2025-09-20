# core/views_supabase.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
import json
from .supabase_client import supabase, supabase_service

def _json(req):
    try:
        return json.loads(req.body.decode("utf-8"))
    except Exception:
        return {}

@csrf_exempt
@require_POST
def api_check_in(request):
    body = _json(request)
    email = body.get("email")
    pin = body.get("pin")
    facility = body.get("facility")
    if not (email and pin and facility):
        return JsonResponse({"ok": False, "error": "MISSING_FIELDS"}, status=400)
    try:
        res = supabase.rpc("rpc_scan_check_in", {
            "p_email": email,
            "p_plain_code": pin,
            "p_facility_name": facility
        }).execute()
        return JsonResponse({"ok": True, "data": res.data}, status=200)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)

@csrf_exempt
@require_POST
def api_check_out(request):
    body = _json(request)
    email = body.get("email")
    pin = body.get("pin")
    facility = body.get("facility")
    if not (email and pin and facility):
        return JsonResponse({"ok": False, "error": "MISSING_FIELDS"}, status=400)
    try:
        res = supabase.rpc("rpc_scan_check_out", {
            "p_email": email,
            "p_plain_code": pin,
            "p_facility_name": facility
        }).execute()
        return JsonResponse({"ok": True, "data": res.data}, status=200)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)

@csrf_exempt
@require_POST
def api_admin_set_pin(request):
    if supabase_service is None:
        return JsonResponse({"ok": False, "error": "SERVICE_KEY_NOT_CONFIGURED"}, status=500)
    body = _json(request)
    email = body.get("email")
    pin = body.get("pin")
    if not (email and pin):
        return JsonResponse({"ok": False, "error": "MISSING_FIELDS"}, status=400)
    try:
        res = supabase_service.rpc("admin_set_scan_code", {
            "p_email": email,
            "p_plain_code": pin
        }).execute()
        return JsonResponse({"ok": True, "data": res.data}, status=200)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)

@require_GET
def api_current_presence(request):
    """
    Optional helper to show who is currently checked-in.
    GET /api/current_presence?facility=Fitness%20Room
    """
    facility = request.GET.get("facility")
    try:
        query = supabase.table("vw_current_facility_presence").select("*")
        if facility:
            query = query.eq("facility_name", facility)
        res = query.execute()
        return JsonResponse({"ok": True, "data": res.data}, status=200, safe=False)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)
