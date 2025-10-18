# core/management/commands/inventory_menu.py
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
from django.core.management.base import BaseCommand
from core.models import Equipment


# =============== Domain ===============
@dataclass(eq=True, frozen=True)
class Item:
    code: str  # map -> Equipment.name
    name: str
    qty: int = 0  # map -> Equipment.stock
    total: int = 0  # map -> Equipment.total

    def with_qty(self, qty: int) -> "Item":
        return Item(self.code, self.name, qty, self.total)

    def with_total(self, total: int) -> "Item":
        return Item(self.code, self.name, self.qty, total)


# ============ Repository (ORM) ============
class EquipRepository:

    def get(self, code: str) -> Optional[Item]:
        try:
            e = Equipment.objects.get(name=code)
            return Item(code=e.name, name=e.name, qty=e.stock, total=e.total)
        except Equipment.DoesNotExist:
            return None

    def add_or_update(self, item: Item) -> Item:
        eq, created = Equipment.objects.get_or_create(
            name=item.code,
            defaults={"total": max(item.total, item.qty), "stock": item.qty},
        )
        if not created:
            # รวมจำนวน/อัปเดตค่า คล้ายอินพุตจากเมนู
            eq.total = max(eq.total, item.total)
            eq.stock = item.qty
            # กัน stock > total
            if eq.stock > eq.total:
                eq.total = eq.stock
        eq.save()
        return Item(code=eq.name, name=eq.name, qty=eq.stock, total=eq.total)

    def delete(self, code: str) -> bool:
        try:
            Equipment.objects.get(name=code).delete()
            return True
        except Equipment.DoesNotExist:
            return False

    def search(self, keyword: str) -> List[Item]:
        qs = Equipment.objects.filter(name__icontains=keyword).order_by("name")[:200]
        return [Item(code=e.name, name=e.name, qty=e.stock, total=e.total) for e in qs]

    def all(self) -> List[Item]:
        qs = Equipment.objects.order_by("name")
        return [Item(code=e.name, name=e.name, qty=e.stock, total=e.total) for e in qs]


# ============ Service (ธุรกิจ) ============
class InventoryService:
    """รวมลอจิกธุรกิจเบา ๆ ให้ชั้น UI เรียกใช้"""

    def __init__(self, repo: EquipRepository) -> None:
        self.repo = repo

    def add_item(self, code: str, qty: int, total: Optional[int] = None) -> Item:
        code = code.strip()
        if not code:
            raise ValueError("รหัส/ชื่ออุปกรณ์ห้ามว่าง")
        qty = max(0, int(qty))
        current = self.repo.get(code)
        if current:
            # ถ้ามีอยู่แล้ว อัปเดตสต็อกและเพดานรวม
            new_total = (
                current.total if total is None else max(current.total, int(total))
            )
            new = Item(code=code, name=code, qty=qty, total=new_total)
        else:
            new_total = max(qty, int(total) if total is not None else qty)
            new = Item(code=code, name=code, qty=qty, total=new_total)
        return self.repo.add_or_update(new)

    def delete_item(self, code: str) -> bool:
        return self.repo.delete(code.strip())

    def search_item(self, keyword: str) -> List[Item]:
        return self.repo.search(keyword.strip())

    def list_items(self) -> List[Item]:
        return self.repo.all()


# ============ Presentation (เมนู CLI) ============
class MenuApp:
    def __init__(self, service: InventoryService) -> None:
        self.svc = service

    @staticmethod
    def _int_input(prompt: str, default: Optional[int] = None) -> int:
        while True:
            s = input(prompt).strip()
            if s == "" and default is not None:
                return default
            try:
                return int(s)
            except ValueError:
                print("** ใส่ตัวเลขเท่านั้น **")

    @staticmethod
    def _print(items: List[Item]) -> None:
        if not items:
            print("(ไม่พบรายการ)\n")
            return
        print("-" * 60)
        print(f"{'NAME':<30} {'STOCK':>8} {'TOTAL':>8}")
        print("-" * 60)
        for it in items:
            print(f"{it.name:<30} {it.qty:>8} {it.total:>8}")
        print("-" * 60 + "\n")

    def run(self) -> None:
        print("=== Equipment Inventory (OOP via Django ORM) ===\n")
        MENU = """\
1) Add item (สร้าง/อัปเดต)
2) Delete item (ลบ)
3) Search item (ค้นหา)
4) List items (ทั้งหมด)
0) Exit
เลือกเมนู: """
        while True:
            choice = input(MENU).strip()
            if choice == "1":
                code = input("ชื่ออุปกรณ์ (ใช้เป็นรหัสด้วย): ").strip()
                qty = self._int_input("สต็อก (stock): ", 0)
                total = self._int_input("เพดานรวม (total) [ว่าง=ไม่เปลี่ยน]: ", None)
                try:
                    item = self.svc.add_item(code, qty, total)
                    print(
                        f"✅ บันทึกแล้ว: {item.name} stock={item.qty} total={item.total}\n"
                    )
                except Exception as e:
                    print(f"❌ {e}\n")
            elif choice == "2":
                code = input("ชื่อ/รหัสที่จะลบ: ").strip()
                ok = self.svc.delete_item(code)
                print("✅ ลบแล้ว\n" if ok else "❌ ไม่พบรายการ\n")
            elif choice == "3":
                kw = input("คำค้น: ").strip()
                self._print(self.svc.search_item(kw))
            elif choice == "4":
                self._print(self.svc.list_items())
            elif choice == "0":
                print("ลาก่อน 👋")
                break
            else:
                print("** เมนูไม่ถูกต้อง **\n")


# ============ Django entry ============
class Command(BaseCommand):
    help = "Interactive OOP menu for Equipment inventory (no code changes to existing app)."

    def handle(self, *args, **options):
        repo = EquipRepository()
        svc = InventoryService(repo)
        MenuApp(svc).run()
