// script.js - Final Dribbble Logic with Clean Code

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. MOBILE MENU LOGIC ---
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    const body = document.body;

    const iconHamburger = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>`;
    const iconClose = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;

    let isMenuOpen = false;

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
        
        if (isMenuOpen) {
            mobileMenu.classList.remove('hidden');
            body.classList.add('overflow-hidden');
            mobileBtn.innerHTML = iconClose;
            
            setTimeout(() => {
                mobileMenu.classList.remove('opacity-0', 'scale-95');
                mobileMenu.classList.add('opacity-100', 'scale-100');
            }, 10);
        } else {
            mobileMenu.classList.remove('opacity-100', 'scale-100');
            mobileMenu.classList.add('opacity-0', 'scale-95');
            body.classList.remove('overflow-hidden');
            mobileBtn.innerHTML = iconHamburger;
            
            setTimeout(() => {
                mobileMenu.classList.add('hidden');
            }, 300);
        }
    }

    mobileBtn.addEventListener('click', toggleMenu);

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (isMenuOpen) toggleMenu();
        });
    });

    // --- 2. NAVBAR SCROLL EFFECT ---
    const navbar = document.getElementById('navbar');
    // Mencari inner container navbar (div dengan ID 'navbar-inner' yang baru kita tambah)
    const navbarContainer = document.getElementById('navbar-inner');

    window.addEventListener('scroll', () => {
        if (navbarContainer) {
            if (window.scrollY > 20) {
                // Efek saat scroll (Putih bersih)
                if(window.innerWidth >= 768) {
                   navbarContainer.classList.add('navbar-scrolled');
                   // Hilangkan transparansi default
                   navbarContainer.classList.remove('md:bg-white/80', 'border-white/40'); 
                } else {
                   navbarContainer.classList.add('bg-white', 'shadow-md');
                   navbarContainer.classList.remove('bg-white/90');
                }
            } else {
                // Efek saat di atas (Transparan/Glassmorphism)
                if(window.innerWidth >= 768) {
                   navbarContainer.classList.remove('navbar-scrolled');
                   navbarContainer.classList.add('md:bg-white/80', 'border-white/40');
                } else {
                   navbarContainer.classList.remove('bg-white', 'shadow-md');
                   navbarContainer.classList.add('bg-white/90');
                }
            }
        }
    });

    // --- 3. SCROLL REVEAL ANIMATION ---
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

    // --- 4. DYNAMIC WHATSAPP GREETING ---
    const waLinks = document.querySelectorAll('a[href^="https://wa.me"]');
    const jam = new Date().getHours();
    let sapaan = "Halo";

    if (jam >= 4 && jam < 10) sapaan = "Selamat Pagi";
    else if (jam >= 10 && jam < 15) sapaan = "Selamat Siang";
    else if (jam >= 15 && jam < 19) sapaan = "Selamat Sore";
    else sapaan = "Selamat Malam";

    waLinks.forEach(link => {
        let originalHref = link.getAttribute('href');
        if (originalHref.includes("Halo")) {
             let newHref = originalHref.replace("Halo", encodeURIComponent(sapaan)); 
             link.setAttribute('href', newHref);
        }
    });

    // --- 5. HANDLE TOMBOL PROMO TAS (Pemisahan JS dari HTML) ---
    const btnKlaimTas = document.getElementById('btn-klaim-tas');
    if (btnKlaimTas) {
        btnKlaimTas.addEventListener('click', () => {
            window.open('https://wa.me/6282313359989?text=Halo%20MJL,%20cara%20dapat%20tas%20member%20gimana?', '_blank');
        });
    }
});
