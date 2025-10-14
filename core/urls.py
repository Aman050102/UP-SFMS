# core/urls.py

from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect
from . import views

urlpatterns = [
    # --- Auth ---
    path("", lambda r: redirect("/login/")),  # หน้าแรก → /login/
    path("login/", views.login_page, name="login"),
    path("auth/", views.mock_login, name="auth_redirect"),
    path("logout/", views.logout_view, name="logout"),

    # --- Staff ---
    path("staff/", views.staff_console, name="staff_console"),
    path("staff/equipment/", views.staff_equipment, name="staff_equipment"),
    path("staff/borrow-ledger/", views.staff_borrow_ledger, name="staff_borrow_ledger"),
    path("staff/borrow-stats/", views.staff_borrow_stats, name="staff_borrow_stats"),
    path("staff/badminton/", views.staff_badminton_booking, name="staff_badminton_booking"),

    # --- User ---
    path("user/", views.user_menu, name="user_menu"),
    path("choose/", views.choose, name="choose"),
    path("user/equipment/", views.user_equipment, name="user_equipment"),
    path("user/equipment/return/", views.equipment_return_page, name="user_equipment_return"),
    path("user/borrow-stats/", views.user_borrow_stats, name="user_borrow_stats"),
    path("badminton/", views.badminton_booking, name="badminton_booking"),
    path("api/equipment/borrow/", views.equip_borrow_api, name="equip_borrow_api"),
    path("api/equipment/return/", views.equip_return_api, name="equip_return_api"),
    path("api/user/pending-returns/", views.api_user_pending_returns, name="api_user_pending_returns"),

    # --- Reports (Checkins page) ---
    path("reports/checkins/", views.checkin_report, name="checkin_report"),
    path("api/checkins/", views.api_checkins, name="api_checkins"),

    # --- Borrow stats API + export (อันที่หน้า staff ใช้) ---
    path("api/borrow-stats/", views.api_borrow_stats, name="api_borrow_stats"),
    path("export/borrow-stats.csv", views.export_borrow_stats_csv, name="export_borrow_stats_csv"),
    path("api/borrow-stats/", views.api_borrow_stats, name="api_borrow_stats"),

    # --- Monthly Report (HTML + JSON + PDF + Meta + Viewer + Builder) ---
    path("reports/monthly/<int:year>/<int:month>/", views.monthly_report_page, name="monthly_report"),
    path("api/reports/monthly/<int:year>/<int:month>.json", views.api_monthly_report, name="api_monthly_report"),
    path("reports/monthly/<int:year>/<int:month>/source.pdf", views.monthly_report_source_pdf, name="monthly_report_source_pdf"),
    path("api/reports/monthly/<int:year>/<int:month>/pdf-info.json", views.api_monthly_pdf_info, name="api_monthly_pdf_info"),
    path("reports/monthly/<int:year>/<int:month>/viewer/", views.monthly_report_viewer, name="monthly_report_viewer"),
    path("reports/monthly/<int:year>/<int:month>/build/", views.monthly_report_build_pdf, name="monthly_report_build_pdf"),
    path("reports/monthly/<int:year>/<int:month>/public/", views.monthly_report_page_public, name="monthly_report_public"),

    # --- Staff Equipment APIs ---
    path("api/staff/equipments/", views.api_staff_equipments, name="api_staff_equipments"),
    path("api/staff/equipment/<int:pk>/", views.api_staff_equipment_detail, name="api_staff_equipment_detail"),
    path("api/staff/borrow-records/", views.api_staff_borrow_records, name="api_staff_borrow_records"),

    # --- Misc ---
    path("health/", views.health, name="health"),
]

# เสิร์ฟไฟล์สื่อ (dev เท่านั้น)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)