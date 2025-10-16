from django.contrib import admin
from .models import Equipment, BorrowRecord, CheckinEvent
from django.contrib.admin.sites import AlreadyRegistered

@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ("name", "total", "stock")
    search_fields = ("name",)
    list_editable = ("total", "stock")

@admin.register(BorrowRecord)
class BorrowRecordAdmin(admin.ModelAdmin):
    list_display = ("occurred_at", "equipment", "action", "qty", "student_id")
    list_filter = ("action", "occurred_at")
    search_fields = ("equipment__name", "student_id")
    date_hierarchy = "occurred_at"
    ordering = ("-occurred_at",)

try:
    @admin.register(CheckinEvent)
    class CheckinEventAdmin(admin.ModelAdmin):
        list_display = ("occurred_at", "user", "facility", "sub_facility", "action", "students", "staff")
        list_filter = ("facility", "action", "occurred_at")
        search_fields = ("sub_facility", "user__username")
        date_hierarchy = "occurred_at"
        ordering = ("-occurred_at",)
except AlreadyRegistered:
    pass