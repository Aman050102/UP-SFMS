document.addEventListener("DOMContentLoaded", () => {
  const bar = document.querySelector(".modebar");
  const slider = bar?.querySelector(".mode-slider");
  const active = bar?.querySelector(".mode.active");

  function moveSlider(el) {
    if (!slider || !el) return;
    const rect = el.getBoundingClientRect();
    const parentRect = bar.getBoundingClientRect();
    slider.style.left = rect.left - parentRect.left + "px";
    slider.style.width = rect.width + "px";
  }

  // เริ่มต้น
  if (active) moveSlider(active);

  // อัปเดตตอน resize
  window.addEventListener("resize", () => {
    const current = bar.querySelector(".mode.active");
    if (current) moveSlider(current);
  });

  // เผื่ออนาคตถ้าเปลี่ยน active โดย JS
  bar?.addEventListener("click", (e) => {
    const link = e.target.closest(".mode");
    if (!link) return;
    bar.querySelectorAll(".mode").forEach((m) => m.classList.remove("active"));
    link.classList.add("active");
    moveSlider(link);
  });
});
