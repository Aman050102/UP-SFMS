from __future__ import annotations

from django.urls import path
from . import views

# บางโปรเจกต์อาจไม่มี views_supabase.py → ทำให้ import ได้แบบไม่พัง
try:
    from . import views_supabase as sup
    SUPABASE_ENABLED = True
except Exception:
    SUPABASE_ENABLED = False

urlpatterns = [
    # ================= Auth =================
    path("", views.login_page, name="login"),
    path("login/", views.login_page, name="login_alias"),
    path("auth/", views.mock_login, name="auth_redirect"),
    path("logout/", views.logout_view, name="logout"),

    # ================ Staff pages ================
    path("staff/", views.staff_console, name="staff_console"),
    path("staff/equipment/", views.staff_equipment, name="staff_equipment"),
    path("staff/borrow-ledger/", views.staff_borrow_ledger, name="staff_borrow_ledger"),
    path("staff/borrow-stats/", views.staff_borrow_stats, name="staff_borrow_stats"),
    path("staff/badminton/", views.staff_badminton_booking, name="staff_badminton_booking"),

    # ================ Staff APIs ================
    path("api/staff/equipments/", views.api_staff_equipments, name="api_staff_equipments"),
    path("api/staff/equipments/<int:pk>/", views.api_staff_equipment_detail, name="api_staff_equipment_detail"),
    path("api/staff/borrow-records/", views.api_staff_borrow_records, name="api_staff_borrow_records"),

    # ================= User pages =================
    path("user/", views.user_menu, name="user_menu"),
    path("choose/", views.choose, name="choose"),
    path("user/equipment/", views.user_equipment, name="user_equipment"),
    path("user/equipment/return/", views.equipment_return_page, name="user_equipment_return"),
    path("user/borrow-stats/", views.user_borrow_stats, name="user_borrow_stats"),
    # ชั่วคราว: ใช้หน้า staff ของแบดมินตันแทนหน้า user
    path("badminton/", views.staff_badminton_booking, name="badminton_booking"),

    # ================ Reports / misc ================
    # ใช้ชื่อนี้ใน template: {% url 'checkin_report' %}
    path("staff/report/", views.checkin_report, name="checkin_report"),
    path("api/checkins/", views.api_checkins, name="api_checkins"),
    path("api/check-event/", views.api_check_event, name="api_check_event"),
    path("pool/checkin/", views.pool_checkin, name="pool_checkin_api"),
    path("pool/checkout/", views.pool_checkout, name="pool_checkout_api"),
    path("api/borrow-stats/", views.api_borrow_stats, name="api_borrow_stats"),
    path("export/borrow-stats.csv", views.export_borrow_stats_csv, name="export_borrow_stats_csv"),

    # ================ Equipment API (user) ================
    # ให้ทั้งสอง path เผื่อโค้ดหน้าเว็บเรียกแบบใดแบบหนึ่งอยู่แล้ว
    path("api/equipment/borrow/", views.equip_borrow_api, name="equip_borrow_api"),
    path("api/equipment/return/", views.equip_return_api, name="equip_return_api"),
    path("api/equip/borrow/", views.equip_borrow_api, name="equip_borrow_api_alias"),
    path("api/equip/return/", views.equip_return_api, name="equip_return_api_alias"),

    # ================ Healthcheck ================
    path("health/", views.health, name="health"),
]

# ============== Supabase endpoints (ถ้ามีไฟล์จริง) ==============
if SUPABASE_ENABLED:
    urlpatterns += [
        path("api/checkin",          sup.api_check_in,        name="api_checkin"),
        path("api/checkout",         sup.api_check_out,       name="api_checkout"),
        path("api/admin/set-pin",    sup.api_admin_set_pin,   name="api_admin_set_pin"),
        path("api/current_presence", sup.api_current_presence, name="api_current_presence"),
    ]