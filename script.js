document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar');
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const themeToggle = document.getElementById('theme-toggle');

    const savedTheme = localStorage.getItem('lbc-theme') || 'dark';
    document.body.dataset.theme = savedTheme;
    themeToggle?.addEventListener('click', () => {
        const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        document.body.dataset.theme = nextTheme;
        localStorage.setItem('lbc-theme', nextTheme);
    });

    // 1. Navbar Scroll Effect & Mobile Shrinking Pill
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        // General background
        if (currentScrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Mobile specific: Shrinking pill based on direction
        if (window.innerWidth <= 768) {
            if (currentScrollY > 150 && currentScrollY > lastScrollY) {
                // Scrolling Down -> Shrink
                if (!navbar.classList.contains('mobile-collapsed')) {
                    navbar.classList.add('mobile-collapsed');
                    menuToggle.innerHTML = `<i data-lucide="arrow-up"></i>`;
                    if (window.lucide) lucide.createIcons();
                }
            } else if (currentScrollY < lastScrollY || currentScrollY <= 150) {
                // Scrolling Up -> Expand back
                if (navbar.classList.contains('mobile-collapsed')) {
                    navbar.classList.remove('mobile-collapsed');
                    // Retain correct icon if menu is active or not
                    const iconName = navLinks.classList.contains('active') ? 'x' : 'menu';
                    menuToggle.innerHTML = `<i data-lucide="${iconName}"></i>`;
                    if (window.lucide) lucide.createIcons();
                }
            }
        }
        lastScrollY = currentScrollY;
    });

    // 1.5 Mobile Menu Toggle
    menuToggle.addEventListener('click', (e) => {
        // Intercept if it's the "Scroll to top" icon
        if (navbar.classList.contains('mobile-collapsed')) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        navLinks.classList.toggle('active');
        const iconName = navLinks.classList.contains('active') ? 'x' : 'menu';
        menuToggle.innerHTML = `<i data-lucide="${iconName}"></i>`;
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        if (window.lucide) lucide.createIcons();
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            menuToggle.innerHTML = `<i data-lucide="menu"></i>`;
            document.body.style.overflow = '';
            if (window.lucide) lucide.createIcons();
        });
    });

    // 2. Intersection Observer for Fade-In-Up Animations
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                const delay = entry.target.getAttribute('data-delay');
                if (delay) entry.target.style.transitionDelay = `${delay}ms`;
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));

    // 3. Catalogue Loader (Supabase Integration)
    const SUPABASE_URL = 'https://pnnuqntyhvrbzikaktuu.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBubnVxbnR5aHZyYnppa2FrdHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDU5MDksImV4cCI6MjA5Mjk4MTkwOX0.7k4RbANKhf95bw9y63qyVXWoiX8Op8Tx0uC37oVeanQ';

    // Initialize Supabase client
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    let pcData = [];

    const formatEUR = (value) => new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
    }).format(Number(value || 0));

    const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));

    /**
     * Mapper : Convertit les données relationnelles de Supabase vers l'interface attendue par la vue (UI).
     */
    function mapSupabaseToPC(build) {
        const c = build.components || [];

        // Aplatir le tableau de composants
        let compObj = {};
        if (Array.isArray(c)) {
            c.forEach(comp => {
                if (comp.category && comp.exact_name) {
                    compObj[comp.category.toLowerCase()] = comp.exact_name;
                }
            });
        }

        // Construire les URLs d'images complètes
        const bucketName = 'build-images';
        let imageUrls = [];
        if (Array.isArray(build.image_paths) && build.image_paths.length > 0) {
            imageUrls = build.image_paths.map(path => {
                return supabase.storage.from(bucketName).getPublicUrl(path).data.publicUrl;
            });
        }

        return {
            id: build.id,
            statusRaw: build.status,
            Nom: build.name || 'PC Inconnu',
            Prix: build.public_price ? `${build.public_price} €` : 'N/A',
            PrixRaw: build.public_price,
            Statut: build.status === 'en_ligne' ? 'Disponible' : build.status === 'vendu' ? 'Vendu' : build.status,
            ImageURL: imageUrls.join(';') || '',
            VintedURL: build.vinted_url || '',

            // Composants mappés selon la "category"
            CPU: compObj.cpu || '-',
            GPU: compObj.gpu || '-',
            RAM: compObj.ram || '-',
            Stockage: compObj.stockage || '-',
            "Carte mère": compObj.cm || '-',
            Refroidissement: compObj.refroidissement || '-',
            Alimentation: compObj.alim || '-',
            "OS installé": compObj.os || '-'
        };
    }

    async function loadCatalogue() {
        const grid = document.getElementById('pc-grid');
        try {
            const { data, error } = await supabase
                .from('builds')
                .select('*, components(*)')
                .in('status', ['en_ligne', 'vendu']);

            if (error) throw error;

            pcData = (data || []).map(mapSupabaseToPC);

            renderCatalogue(pcData);
        } catch (error) {
            console.error('Erreur Supabase:', error);
            if (error.code === '42501') {
                console.warn('Problème de permissions détecté : Assurez-vous d\'avoir exécuté "GRANT SELECT ON public.builds TO anon;" dans Supabase.');
            }
            grid.innerHTML = '<div class="loader-container"><p class="text-secondary">Impossible de charger le catalogue. Réessayez plus tard.</p></div>';
        }
    }

    function formatDescription(desc) {
        if (!desc) return '';
        const firstDotIndex = desc.indexOf('.');
        if (firstDotIndex === -1) return escapeHTML(desc);
        const firstSentence = desc.substring(0, firstDotIndex + 1);
        const restOfDescription = desc.substring(firstDotIndex + 1).trim();
        if (!restOfDescription) return `<strong>${escapeHTML(firstSentence)}</strong>`;
        return `<strong>${escapeHTML(firstSentence)}</strong><br><br>${escapeHTML(restOfDescription)}`;
    }

    async function loadSemiMeasureTemplates() {
        const grid = document.getElementById('semi-measure-grid');
        if (!grid) return;

        try {
            const { data, error } = await supabase
                .from('config_templates')
                .select('id,name,description,image_url,base_sell_price')
                .order('base_sell_price', { ascending: true })
                .limit(3);

            if (error) throw error;

            const templates = data || [];
            if (!templates.length) {
                grid.innerHTML = `
                    <div class="semi-loader glass">
                        <p>Aucune base semi-mesure disponible pour le moment.</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = templates.map((template, index) => {
                const isFeatured = index === 1;
                const image = template.image_url
                    ? `<img src="${escapeHTML(template.image_url)}" alt="${escapeHTML(template.name)}" class="semi-card-img" loading="lazy">`
                    : '<div class="semi-card-placeholder"></div>';

                return `
                    <a class="semi-card ${isFeatured ? 'semi-card-featured' : ''} fade-in-up visible" href="configurateur.html?base=${encodeURIComponent(template.id)}" style="animation-delay:${index * 100}ms">
                        <div class="semi-card-inner">
                            <div class="semi-card-media">
                                ${image}
                                ${isFeatured ? '<span class="semi-card-badge-overlay">Le plus vendu</span>' : ''}
                            </div>
                            <div class="semi-card-content">
                                <h3 class="semi-card-title">${escapeHTML(template.name)}</h3>
                                <p class="semi-card-description">${formatDescription(template.description || 'Une base équilibrée, prête à personnaliser selon ton usage.')}</p>
                                <span class="btn btn-cyan semi-card-cta">${isFeatured ? 'Choisir le plus vendu' : 'Personnaliser'} à partir de ${formatEUR(template.base_sell_price)}</span>
                            </div>
                        </div>
                    </a>
                `;
            }).join('');
        } catch (error) {
            console.error('Erreur chargement semi-mesure:', error);
            grid.innerHTML = `
                <div class="semi-loader glass">
                    <p>Impossible de charger les bases semi-mesure. Réessayez plus tard.</p>
                </div>
            `;
        }
    }

    function renderCatalogue(data) {
        const grid = document.getElementById('pc-grid');
        grid.innerHTML = '';

        data.forEach((pc, index) => {
            const imageField = pc['Toutes les Images'] || pc['ImageURL (3 max)'] || pc.ImageURL;
            const imageUrls = imageField ? imageField.split(/[,;]/).map(u => u.trim()).filter(u => u) : ['https://via.placeholder.com/400x300?text=No+Image'];
            const mainImage = imageUrls[0] || 'https://via.placeholder.com/400x300?text=No+Image';

            const card = document.createElement('div');
            card.className = 'pc-card glass fade-in-up visible';
            card.style.animationDelay = `${index * 100}ms`;

            const isVendu = pc.Statut && pc.Statut.toLowerCase() === 'vendu';
            const statusClass = isVendu ? 'vendu' : 'disponible';
            card.innerHTML = `
                <div class="pc-card-img-wrapper">
                    <img src="${mainImage}" alt="${pc.Nom}" class="pc-card-img" loading="lazy">
                    <span class="pc-status ${statusClass}">${pc.Statut || 'Disponible'}</span>
                </div>
                <div class="pc-card-content">
                    <div class="pc-header-row">
                        <h3 class="pc-name">${pc.Nom || 'La Belle Config'}</h3>
                        <div class="pc-price">${pc.Prix || 'N/A'}</div>
                    </div>
                    <ul class="pc-specs-mini">
                        <li><i data-lucide="cpu"></i> ${pc.CPU || '-'}</li>
                        <li><i data-lucide="monitor"></i> ${pc.GPU || '-'}</li>
                        <li><i data-lucide="database"></i> ${pc.RAM || '-'}</li>
                    </ul>
                    <button class="btn btn-outline btn-block btn-card">Voir</button>
                </div>
            `;
            card.addEventListener('click', () => openModal(pc));
            grid.appendChild(card);
        });
        if (window.lucide) lucide.createIcons();
    }

    // 4. Modal Logic
    const modal = document.getElementById('pc-modal');
    const modalCloseBtn = modal.querySelector('.modal-close');
    const modalBody = document.getElementById('modal-body-content');

    function openModal(pc) {
        const imageField = pc['Toutes les Images'] || pc['ImageURL (3 max)'] || pc.ImageURL;
        const imageUrls = imageField ? imageField.split(/[,;]/).map(u => u.trim()).filter(u => u) : ['https://via.placeholder.com/800x600?text=No+Image'];

        const displayUrls = imageUrls.slice(0, 3);
        const extraUrls = imageUrls.slice(3);

        let imagesHtml = '';
        let layoutClass = 'layout-1';

        if (displayUrls.length === 1) {
            layoutClass = 'layout-1';
            imagesHtml = `<img src="${displayUrls[0]}" class="modal-img img-0 main-img" alt="${pc.Nom}">`;
        } else if (displayUrls.length === 2) {
            layoutClass = 'layout-2';
            imagesHtml = `<img src="${displayUrls[0]}" class="modal-img img-0 main-img" alt="${pc.Nom}"><img src="${displayUrls[1]}" class="modal-img img-1" alt="${pc.Nom}">`;
        } else if (displayUrls.length >= 3) {
            layoutClass = 'layout-3';
            imagesHtml = `<img src="${displayUrls[0]}" class="modal-img img-0 main-img" alt="${pc.Nom}"><img src="${displayUrls[1]}" class="modal-img img-1" alt="${pc.Nom}"><img src="${displayUrls[2]}" class="modal-img img-2" alt="${pc.Nom}">`;
        }

        let thumbsHtml = '';
        if (extraUrls.length > 0) {
            const allThumbImages = imageUrls.map((url, i) => `<img src="${url}" class="thumb-img ${i === 0 ? 'active' : ''}" data-index="${i}" alt="Thumb">`).join('');
            thumbsHtml = `<div class="modal-thumbs-container">${allThumbImages}</div>`;
        }

        // Achat / Acheter directement (chantier 5)
        const isAvailable = pc.statusRaw === 'en_ligne';
        const hasVinted = !!pc.VintedURL;
        const buyDirectUrl = pc.id ? `/acheter?id=${encodeURIComponent(pc.id)}` : '';

        let buyBlockHtml = '';
        if (isAvailable && buyDirectUrl) {
            buyBlockHtml = `
                <a href="${buyDirectUrl}" class="btn btn-cyan btn-block btn-lg tech-btn">
                    Acheter directement <i data-lucide="credit-card"></i>
                </a>
                ${hasVinted ? `
                    <a href="${escapeHTML(pc.VintedURL)}" target="_blank" rel="noreferrer"
                       class="btn btn-outline btn-block" style="margin-top:.5rem;">
                        Ou voir sur Vinted <i data-lucide="external-link"></i>
                    </a>
                ` : ''}
            `;
        } else if (hasVinted) {
            buyBlockHtml = `
                <a href="${escapeHTML(pc.VintedURL)}" target="_blank" rel="noreferrer"
                   class="btn btn-cyan btn-block btn-lg tech-btn">
                    Voir sur Vinted <i data-lucide="external-link"></i>
                </a>
            `;
        } else {
            buyBlockHtml = `
                <button class="btn btn-outline btn-block btn-lg tech-btn" disabled>
                    Non disponible
                </button>
            `;
        }

        modalBody.innerHTML = `
            <div class="modal-gallery-wrapper">
                <div class="modal-images ${layoutClass}">
                    ${imagesHtml}
                </div>
                ${thumbsHtml}
            </div>
            <div class="modal-details">
                <h2 class="modal-title">${pc.Nom || 'La Belle Config'}</h2>
                <div class="modal-price">${pc.Prix || 'N/A'}</div>

                <div class="specs-grid">
                    <div class="spec-item"><i data-lucide="cpu"></i><div class="spec-content"><h4>Processeur</h4><p>${pc.CPU || '-'}</p></div></div>
                    <div class="spec-item"><i data-lucide="monitor"></i><div class="spec-content"><h4>Carte Graphique</h4><p>${pc.GPU || '-'}</p></div></div>
                    <div class="spec-item"><i data-lucide="server"></i><div class="spec-content"><h4>Mémoire RAM</h4><p>${pc.RAM || '-'}</p></div></div>
                    <div class="spec-item"><i data-lucide="hard-drive"></i><div class="spec-content"><h4>Stockage</h4><p>${pc.Stockage || '-'}</p></div></div>
                    <div class="spec-item"><i data-lucide="layout"></i><div class="spec-content"><h4>Carte Mère</h4><p>${pc["Carte mère"] || '-'}</p></div></div>
                    <div class="spec-item"><i data-lucide="thermometer-snowflake"></i><div class="spec-content"><h4>Refroidissement</h4><p>${pc.Refroidissement || '-'}</p></div></div>
                    <div class="spec-item"><i data-lucide="zap"></i><div class="spec-content"><h4>Alimentation</h4><p>${pc.Alimentation || '-'}</p></div></div>
                    <div class="spec-item"><i data-lucide="monitor-play"></i><div class="spec-content"><h4>Système d'exploitation</h4><p>${pc["OS installé"] || '-'}</p></div></div>
                </div>

                ${buyBlockHtml}
            </div>
        `;

        const mainImg = modalBody.querySelector('.main-img');
        const thumbs = modalBody.querySelectorAll('.thumb-img');
        if (mainImg && thumbs.length > 0) {
            thumbs.forEach(thumb => {
                thumb.addEventListener('click', () => {
                    mainImg.src = thumb.src;
                    thumbs.forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
            });
        }

        if (window.lucide) lucide.createIcons();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
            closeModal();
        }
    });

    // 5. Form Submission (Make Webhook)
    const form = document.getElementById('custom-pc-form');
    const submitBtn = document.getElementById('submit-btn');
    const formMsg = document.getElementById('form-msg');
    const WEBHOOK_URL = 'https://hook.eu1.make.com/6lbt0oiir44rvuz64gb8pcpew1q4p1y1';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnText = submitBtn.querySelector('.btn-text');
        const spinner = submitBtn.querySelector('.btn-spinner');

        submitBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'inline-block';
        formMsg.style.display = 'none';
        formMsg.className = 'form-message';

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                mode: 'no-cors'
            });

            // En mode no-cors on estime que sans erreur réseau, la requête part.
            Array.from(form.children).forEach(child => {
                if (!child.classList.contains('form-footer')) {
                    child.style.display = 'none';
                }
            });
            submitBtn.style.display = 'none';
            formMsg.textContent = 'Demande envoyée avec succès ! Nous revenons vers vous très vite. 🚀';
            formMsg.className = 'form-message success';
            formMsg.style.display = 'block';

        } catch (error) {
            console.error('Erreur submission webhook:', error);
            formMsg.textContent = 'Une erreur est survenue lors de l\'envoi. Veuillez réessayer plus tard.';
            formMsg.className = 'form-message error';
            formMsg.style.display = 'block';

            submitBtn.disabled = false;
            btnText.style.display = 'inline-block';
            spinner.style.display = 'none';
        }
    });

    // 6. Smooth Scroll to Top (Logo Click)
    document.querySelectorAll('.logo').forEach(logo => {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', (e) => {
            e.preventDefault();
            const startY = window.scrollY;
            if (startY <= 0) return;

            const html = document.documentElement;
            html.style.scrollBehavior = 'auto';

            const duration = 1200;
            const startTime = performance.now();

            function easeInOutQuart(t) {
                return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
            }

            function step(currentTime) {
                const timeElapsed = currentTime - startTime;
                let progress = timeElapsed / duration;
                if (progress > 1) progress = 1;

                window.scrollTo(0, startY * (1 - easeInOutQuart(progress)));

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    html.style.scrollBehavior = '';
                }
            }
            requestAnimationFrame(step);
        });
    });

    // Init
    loadCatalogue();
    loadSemiMeasureTemplates();
});
