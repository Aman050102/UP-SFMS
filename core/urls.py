from django.urls import path
from . import views

urlpatterns = [
    # --- Auth ---
    path("", views.login_page, name="login"),
    path("login/", views.login_page, name="login_alias"),
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

    # --- APIs (general) ---
    path("api/check-event/", views.api_check_event, name="api_check_event"),
    path("api/checkins/", views.api_checkins, name="api_checkins"),
    path("api/borrow-stats/", views.api_borrow_stats, name="api_borrow_stats"),
    path("api/equipment/borrow/", views.equip_borrow_api, name="equip_borrow_api"),
    path("api/equipment/return/", views.equip_return_api, name="equip_return_api"),
    path("api/user/pending-returns/", views.api_user_pending_returns, name="api_user_pending_returns"),
    path("pool/checkin/", views.pool_checkin, name="pool_checkin_api"),
    path("pool/checkout/", views.pool_checkout, name="pool_checkout_api"),
    path("export/borrow-stats.csv", views.export_borrow_stats_csv, name="export_borrow_stats_csv"),

    # --- Monthly Report (HTML + JSON + PDF + Meta) ---
    path("reports/monthly/<int:year>/<int:month>/", views.monthly_report_page, name="monthly_report"),
    path("api/reports/monthly/<int:year>/<int:month>.json", views.api_monthly_report, name="api_monthly_report"),
    path("reports/monthly/<int:year>/<int:month>/source.pdf", views.monthly_report_source_pdf, name="monthly_report_source_pdf"),
    path("api/reports/monthly/<int:year>/<int:month>/pdf-info.json", views.api_monthly_pdf_info, name="api_monthly_pdf_info"),

    # --- Misc ---
    path("health/", views.health, name="health"),
]