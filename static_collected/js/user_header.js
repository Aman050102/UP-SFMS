document.addEventListener("click", (e) => {
  const trigger = e.target.closest(".has-sub > .toplink");
  const menus = document.querySelectorAll(".has-sub");
  // คลิกที่ปุ่มเมนู -> toggle เฉพาะตัวที่คลิก
  if (trigger) {
    e.preventDefault();
    const host = trigger.parentElement;
    const isOpen = host.classList.contains("open");
    menus.forEach((m) => m.classList.remove("open"));
    if (!isOpen) host.classList.add("open");
    return;
  }
  // คลิกนอกเมนู -> ปิดทั้งหมด
  if (!e.target.closest(".has-sub")) {
    menus.forEach((m) => m.classList.remove("open"));
  }
});
