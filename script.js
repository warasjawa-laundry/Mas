document.addEventListener('DOMContentLoaded', () => {
    
    // 1. MOBILE MENU LOGIC
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
            setTimeout(() => {
                mobileMenu.classList.remove('opacity-0', 'scale-95');
                mobileMenu.classList.add('opacity-100', 'scale-100');
            }, 10);
        } else {
            mobileMenu.classList.remove('opacity-100', 'scale-100');
            mobileMenu.classList.add('opacity-0', 'scale-95');
            mobileBtn.innerHTML = iconHamburger;
            setTimeout(() => {
                mobileMenu.classList.add('hidden');
            }, 300);
        }
    }

    if (mobileBtn) {
        mobileBtn.addEventListener('click', toggleMenu);
    }

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => { if (isMenuOpen) toggleMenu(); });
    });

    // 2. NAVBAR SCROLL EFFECT (Blurry Glass)
    const navbarContainer = document.getElementById('navbar-inner');
    window.addEventListener('scroll', () => {
        if (!navbarContainer) return;
        
        if (window.scrollY > 20) {
            navbarContainer.classList.add('bg-white/90', 'backdrop-blur-md', 'shadow-md');
            navbarContainer.classList.remove('glass');
        } else {
            navbarContainer.classList.remove('bg-white/90', 'backdrop-blur-md', 'shadow-md');
            navbarContainer.classList.add('glass');
        }
    });

    // 3. SCROLL REVEAL ANIMATION (Smooth Up)
    const reveals = document.querySelectorAll('.reveal');
    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 100;
        reveals.forEach((reveal) => {
            const elementTop = reveal.getBoundingClientRect().top;
            if (elementTop < windowHeight - elementVisible) {
                reveal.classList.add('active');
            }
        });
    };
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll();

    // 4. DYNAMIC WHATSAPP GREETING
    const waLinks = document.querySelectorAll('a[href^="https://wa.me"]');
    const jam = new Date().getHours();
    let sapaan = "Halo";
    if (jam >= 4 && jam < 10) sapaan = "Selamat Pagi";
    else if (jam >= 10 && jam < 15) sapaan = "Selamat Siang";
    else if (jam >= 15 && jam < 19) sapaan = "Selamat Sore";
    else sapaan = "Selamat Malam";

    waLinks.forEach(link => {
        let originalHref = link.getAttribute('href');
        if (originalHref && originalHref.includes("Halo")) {
             let newHref = originalHref.replace("Halo", encodeURIComponent(sapaan)); 
             link.setAttribute('href', newHref);
        }
    });

    // 5. PROMO BUTTON HANDLER
    const btnKlaimTas = document.getElementById('btn-klaim-tas');
    if (btnKlaimTas) {
        btnKlaimTas.addEventListener('click', () => {
            window.open(`https://wa.me/6282313359989?text=${encodeURIComponent(sapaan)}%20MJL,%20cara%20dapat%20tas%20member%20gimana?`, '_blank');
        });
    }
});
