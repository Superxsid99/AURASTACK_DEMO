(() => {
  const cards = Array.from(document.querySelectorAll(".tilt-card"));
  const reveals = Array.from(document.querySelectorAll(".reveal"));
  const orbs = Array.from(document.querySelectorAll(".bg-orb"));

  if (reveals.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08 }
    );
    for (const el of reveals) io.observe(el);
  }

  const setCardTilt = (card, event) => {
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * 6;
    const ry = (px - 0.5) * 8;
    card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`;
  };

  for (const card of cards) {
    card.addEventListener("mousemove", (event) => setCardTilt(card, event));
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  }

  if (orbs.length) {
    let raf = 0;
    let tx = 0;
    let ty = 0;
    window.addEventListener("mousemove", (event) => {
      tx = (event.clientX / window.innerWidth - 0.5) * 18;
      ty = (event.clientY / window.innerHeight - 0.5) * 18;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        if (orbs[0]) orbs[0].style.transform = `translate(${tx * 0.35}px, ${ty * 0.35}px)`;
        if (orbs[1]) orbs[1].style.transform = `translate(${tx * -0.32}px, ${ty * -0.32}px)`;
        if (orbs[2]) orbs[2].style.transform = `translate(${tx * 0.2}px, ${ty * -0.2}px)`;
        raf = 0;
      });
    });
  }
})();

