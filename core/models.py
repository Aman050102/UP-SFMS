from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class Equipment(models.Model):
    name = models.CharField(max_length=255, unique=True)
    total = models.PositiveIntegerField(default=0)
    stock = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return f"{self.name} ({self.stock}/{self.total})"


class BorrowRecord(models.Model):
    ACTIONS = (("borrow", "Borrow"), ("return", "Return"))

    equipment = models.ForeignKey(
        Equipment, on_delete=models.CASCADE, related_name="records"
    )
    qty = models.PositiveIntegerField(default=1)
    action = models.CharField(max_length=10, choices=ACTIONS)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)

    # สำหรับรายงานว่าใครยืม (ไม่มีได้)
    student_id = models.CharField(max_length=64, blank=True, default="")

    # ✅ เพิ่มฟิลด์คณะ
    faculty = models.CharField(max_length=255, blank=True, default="")  # <- ใส่บรรทัดนี้

    def __str__(self) -> str:
        sid = self.student_id or "-"
        fac = self.faculty or "-"
        return f"{sid} ({fac}) {self.action} {self.equipment.name} x{self.qty}"


class CheckinEvent(models.Model):
    FACILITIES = (
        ("outdoor", "Outdoor"),
        ("badminton", "Badminton"),
        ("pool", "Pool"),
        ("track", "Track"),
    )
    ACTIONS = (("in", "In"), ("out", "Out"))

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    facility = models.CharField(max_length=20, choices=FACILITIES)
    sub_facility = models.CharField(max_length=64, blank=True, default="")
    action = models.CharField(max_length=5, choices=ACTIONS)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)

    # ใหม่: เก็บจำนวนผู้ใช้จริง (นิสิต/บุคลากร)
    students = models.PositiveIntegerField(default=0)
    staff = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["facility", "occurred_at"]),
        ]

    def __str__(self) -> str:
        u = self.user.get_username() if self.user else "anon"
        sub = f"/{self.sub_facility}" if self.sub_facility else ""
        return (
            f"{u} {self.facility}{sub} {self.action} "
            f"@ {self.occurred_at:%Y-%m-%d %H:%M} "
            f"(S:{self.students} T:{self.staff})"
        )
