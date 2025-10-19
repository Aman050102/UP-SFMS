from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpRequest



urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("core.urls")),  # ใช้ core เป็น root
]
# urls.py


urlpatterns = [
    # ... patterns เดิมของคุณ ...
]

# DEV static & media serving
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # ไม่จำเป็นต้องเสิร์ฟ STATIC_URL ใน DEBUG (django.contrib.staticfiles จัดการให้แล้ว)
    # แต่ถ้าอยากเสิร์ฟจาก STATIC_ROOT หลัง collectstatic ก็ทำได้:
    # urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect


# หน้าแรก: ส่งคนไปยังหน้าที่เหมาะสม
def root_redirect(request: HttpRequest):
    if request.user.is_authenticated:
        # เลือกไปหน้าสตาฟหรือเมนูผู้ใช้ตามสิทธิ์
        from core.views import _is_staff

        return redirect("staff_console" if _is_staff(request.user) else "user_menu")
    return redirect("login")


urlpatterns = [
    path("", root_redirect, name="root"),
    path("admin/", admin.site.urls),
    path("", include("core.urls")),  # << สำคัญ: รวมเส้นทางทั้งหมดของแอป
]

# เสิร์ฟ static/media ในโหมด DEBUG
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # ถ้าคุณใช้ collectstatic แล้ว ก็ไม่จำเป็นต้องเสิร์ฟ STATIC_URL ด้วย Django,
    # แต่เพื่อความสะดวกตอน dev สามารถใส่ไว้ได้:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

