document.addEventListener('DOMContentLoaded', () => {
    
    // --- 0. INIT LENIS (SMOOTH SCROLL) ---
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false, // Touch native biar responsif di HP
        touchMultiplier: 2,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // --- 1. INIT GSAP ---
    gsap.registerPlugin(ScrollTrigger);
    document.body.classList.remove('invisible');
    gsap.defaults({ ease: "power3.out", duration: 1, force3D: true });

    // --- 2. HERO ANIMATION ---
    const tl = gsap.timeline();
    tl.from("#hero-badge", { y: -20, opacity: 0, duration: 0.8, delay: 0.2 })
      .from("#hero-title", { y: 50, opacity: 0, skewY: 2 }, "-=0.6")
      .from("#hero-desc", { y: 30, opacity: 0, duration: 0.8 }, "-=0.6")
      .from("#hero-cta a", { scale: 0.8, opacity: 0, duration: 0.5, stagger: 0.1, ease: "back.out(1.7)" }, "-=0.4");

    // --- 3. SCROLL REVEAL (BATCH) ---
    ScrollTrigger.batch(".gsap-card, .gsap-testi", {
        interval: 0.1,
        batchMax: 3,
        onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.15, overwrite: true })
    });

    gsap.utils.toArray('.gsap-reveal').forEach(elem => {
        gsap.fromTo(elem, 
            { y: 50, opacity: 0 },
            { scrollTrigger: { trigger: elem, start: "top 85%", toggleActions: "play none none reverse" }, y: 0, opacity: 1 }
        );
    });

    // --- 4. MICRO INTERACTIONS ---
    
    // Levitating Bag
    gsap.to("#promo img", { y: -15, duration: 2.5, repeat: -1, yoyo: true, ease: "sine.inOut", force3D: true });

    // Parallax Gallery
    gsap.utils.toArray(".gsap-image").forEach(container => {
        let img = container.querySelector("img");
        gsap.to(container, { opacity: 1, duration: 0.5, scrollTrigger: { trigger: container, start: "top 85%" } });
        gsap.to(img, {
            y: "15%", ease: "none", force3D: true,
            scrollTrigger: { trigger: container, start: "top bottom", end: "bottom top", scrub: 0 }
        });
    });

    // Pulse Icon
    const pricingIcon = document.querySelector("#pricing-icon");
    if(pricingIcon) { gsap.to(pricingIcon, { scale: 1.15, duration: 0.5, repeat: -1, repeatDelay: 2, yoyo: true }); }

    // Fix Refresh
    window.addEventListener("load", () => ScrollTrigger.refresh());

    // --- 5. LOGIC (NAV & WA) ---
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    const iconHamburger = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>`;
    const iconClose = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
    let isMenuOpen = false;

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
        if (isMenuOpen) {
            mobileMenu.classList.remove('hidden');
            mobileBtn.innerHTML = iconClose;
            gsap.fromTo(mobileMenu, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.3 });
        } else {
            gsap.to(mobileMenu, { opacity: 0, scale: 0.95, duration: 0.2, onComplete: () => mobileMenu.classList.add('hidden') });
            mobileBtn.innerHTML = iconHamburger;
        }
    }

    if (mobileBtn) mobileBtn.addEventListener('click', toggleMenu);
    mobileLinks.forEach(link => link.addEventListener('click', () => { if (isMenuOpen) toggleMenu(); }));

    const navbarContainer = document.getElementById('navbar-inner');
    const stickyNav = document.getElementById('sticky-nav');
    window.addEventListener('scroll', () => {
        if (!navbarContainer) return;
        if (window.scrollY > 20) {
            navbarContainer.classList.add('bg-white/90', 'backdrop-blur-md', 'shadow-md');
            navbarContainer.classList.remove('glass');
            if(stickyNav) stickyNav.classList.remove('translate-y-full');
        } else {
            navbarContainer.classList.remove('bg-white/90', 'backdrop-blur-md', 'shadow-md');
            navbarContainer.classList.add('glass');
            if(stickyNav) stickyNav.classList.add('translate-y-full');
        }
    });

    const waLinks = document.querySelectorAll('a[href^="https://wa.me"]');
    const jam = new Date().getHours();
    let sapaan = (jam >= 4 && jam < 10) ? "Selamat Pagi" : (jam >= 10 && jam < 15) ? "Selamat Siang" : (jam >= 15 && jam < 19) ? "Selamat Sore" : "Selamat Malam";
    waLinks.forEach(link => {
        let originalHref = link.getAttribute('href');
        if (originalHref && originalHref.includes("Halo")) link.setAttribute('href', originalHref.replace("Halo", encodeURIComponent(sapaan)));
    });
    const btnKlaimTas = document.getElementById('btn-klaim-tas');
    if (btnKlaimTas) btnKlaimTas.addEventListener('click', () => window.open(`https://wa.me/6282313359989?text=${encodeURIComponent(sapaan)}%20MJL,%20cara%20dapat%20tas%20member%20gimana?`, '_blank'));
});
