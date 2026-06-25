// USCC Lab — UI interactions (heritage tea-house redesign)

// Flag JS as available *before* first paint (this script is render-blocking in <head>),
// so reveal-on-scroll hiding only applies when JS is present to un-hide it.
// If this file fails to load/parse, .reveal elements stay visible — no blank sections.
document.documentElement.classList.add('js-reveal');

document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Scroll reveal with stagger ----
    // Stagger is derived from each element's index among its .reveal siblings,
    // so cards in a grid animate in one after another.
    document.querySelectorAll('.reveal').forEach(el => {
        const sibs = Array.from(el.parentElement.children).filter(c => c.classList.contains('reveal'));
        const idx = sibs.indexOf(el);
        el.style.setProperty('--rd', (Math.min(idx, 6) * 0.09) + 's');
    });

    const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('in');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));

    // ---- Animated counters ----
    const animate = (el) => {
        const target = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const dur = 1400;
        const start = performance.now();
        const step = (now) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const val = target * eased;
            el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(1)) + suffix;
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };
    const co = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) { animate(e.target); co.unobserve(e.target); }
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => co.observe(el));

    // ---- Hover-to-play BGM on member cards with data-bgm ----
    document.querySelectorAll('[data-bgm]').forEach(card => {
        const audio = new Audio(card.dataset.bgm);
        audio.preload = 'auto';
        card.addEventListener('mouseenter', () => {
            audio.currentTime = 0;
            audio.play().catch(() => { /* autoplay may be blocked until first user gesture */ });
        });
        const stop = () => { audio.pause(); audio.currentTime = 0; };
        card.addEventListener('mouseleave', stop);
    });

    // ---- Lazy-load YouTube: swap the lightweight facade for the real iframe on click ----
    document.querySelectorAll('.yt-facade').forEach(facade => {
        facade.addEventListener('click', (e) => {
            e.preventDefault();   // with JS: load inline. Without JS: the href opens YouTube.
            const id = facade.dataset.yt;
            if (!id) return;
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
            iframe.title = 'YouTube video player';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            iframe.allowFullscreen = true;
            iframe.style.cssText = 'width:100%;aspect-ratio:16/9;border:1px solid var(--border);border-radius:12px;display:block';
            facade.replaceWith(iframe);
        });
    });

    // ---- Sticky-nav shrink + reading-progress bar + back-to-top ----
    const nav = document.querySelector('.nav');

    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    document.body.appendChild(progress);

    const toTop = document.createElement('button');
    toTop.className = 'to-top';
    toTop.type = 'button';
    toTop.setAttribute('aria-label', 'Back to top');
    toTop.innerHTML = '↑';
    toTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    document.body.appendChild(toTop);

    let ticking = false;
    const onScroll = () => {
        const y = window.scrollY || document.documentElement.scrollTop;
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docH > 0 ? (y / docH) * 100 : 0;

        progress.style.width = pct + '%';
        if (nav) nav.classList.toggle('scrolled', y > 24);
        toTop.classList.toggle('show', y > 600);

        ticking = false;
    };
    window.addEventListener('scroll', () => {
        if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();

    // ---- Easter Eggs ----
    // "uscc" (lowercase) → cinematic overlay
    // "USCC" (uppercase) → hyperspace jump to Facebook
    const eggCodeLower = 'uscc';
    const eggCodeUpper = 'USCC';
    let eggBufRaw = '';   // preserves case
    let eggActive = false;

    const dismissEgg = () => {
        const overlay = document.getElementById('uscc-egg');
        if (!overlay) return;
        overlay.classList.add('egg-out');
        setTimeout(() => { overlay.remove(); eggActive = false; }, 700);
    };

    document.addEventListener('keydown', (e) => {
        // If egg is showing, Escape dismisses it
        if (eggActive) {
            if (e.key === 'Escape') dismissEgg();
            return;
        }
        // Ignore if user is typing in an input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        // Ignore modifier keys themselves
        if (e.key.length > 1) return;

        eggBufRaw += e.key;
        // Keep buffer trimmed
        if (eggBufRaw.length > eggCodeUpper.length) eggBufRaw = eggBufRaw.slice(-eggCodeUpper.length);

        // Check uppercase first (USCC → hyperspace jump)
        if (eggBufRaw === eggCodeUpper) {
            eggBufRaw = '';
            eggActive = true;
            showHyperspaceJump();
        }
        // Then check lowercase (uscc → cinematic overlay)
        else if (eggBufRaw.toLowerCase() === eggCodeLower) {
            eggBufRaw = '';
            eggActive = true;
            showEasterEgg();
        }
    });

    function showEasterEgg() {
        // Build overlay
        const overlay = document.createElement('div');
        overlay.id = 'uscc-egg';
        overlay.className = 'egg-overlay';
        overlay.innerHTML = `
            <canvas class="egg-particles"></canvas>
            <div class="egg-content">
                <div class="egg-seal">U</div>
                <h1 class="egg-title">USCC Lab</h1>
                <div class="egg-subtitle">Ubiquitous Sensing &amp; Cloud Computing</div>
                <div class="egg-divider"></div>
                <p class="egg-motto">「 以技術淬鍊智慧，用程式碼書寫未來 」</p>
                <p class="egg-motto-en">Forging intelligence through technology,<br>writing the future in code.</p>
                <div class="egg-hint">Press <kbd>ESC</kbd> or click to close</div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Click to dismiss
        overlay.addEventListener('click', dismissEgg);

        // ---- Particle canvas animation ----
        const canvas = overlay.querySelector('.egg-particles');
        const ctx = canvas.getContext('2d');
        let raf;

        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);

        // Generate particles (tea-leaf greens, golds, warm tones)
        const colors = [
            'rgba(111,125,78,.6)', 'rgba(169,128,60,.5)', 'rgba(156,79,44,.4)',
            'rgba(246,241,231,.35)', 'rgba(111,125,78,.3)', 'rgba(169,128,60,.3)'
        ];
        const particles = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 3 + 1,
            dx: (Math.random() - 0.5) * 0.6,
            dy: -(Math.random() * 0.8 + 0.2),
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: Math.random() * 0.6 + 0.2,
            pulse: Math.random() * Math.PI * 2
        }));

        const drawParticles = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.dx;
                p.y += p.dy;
                p.pulse += 0.025;
                const glow = 0.5 + Math.sin(p.pulse) * 0.5;

                // Wrap around
                if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
                if (p.x < -10) p.x = canvas.width + 10;
                if (p.x > canvas.width + 10) p.x = -10;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * (0.8 + glow * 0.4), 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha * glow;
                ctx.fill();

                // Glow effect
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha * glow * 0.15;
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            if (eggActive) raf = requestAnimationFrame(drawParticles);
        };
        raf = requestAnimationFrame(drawParticles);

        // Cleanup when removed
        const mo = new MutationObserver(() => {
            if (!document.getElementById('uscc-egg')) {
                cancelAnimationFrame(raf);
                window.removeEventListener('resize', resize);
                mo.disconnect();
            }
        });
        mo.observe(document.body, { childList: true });
    }

    // ---- Hyperspace Jump (uppercase USCC) ----
    function showHyperspaceJump() {
        const overlay = document.createElement('div');
        overlay.id = 'uscc-egg';
        overlay.className = 'hyper-overlay';
        overlay.innerHTML = '<canvas class="hyper-canvas"></canvas><div class="hyper-flash"></div>';
        document.body.appendChild(overlay);

        const canvas = overlay.querySelector('.hyper-canvas');
        const ctx = canvas.getContext('2d');
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);

        const cx = () => canvas.width / 2;
        const cy = () => canvas.height / 2;

        // Generate star particles
        const stars = Array.from({ length: 300 }, () => {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 0.4 + 0.05; // 5%–45% from center
            return {
                angle,
                dist,
                speed: Math.random() * 0.003 + 0.001,
                len: 1,
                brightness: Math.random() * 0.5 + 0.5,
                hue: Math.random() < 0.3 ? 200 + Math.random() * 40 : 0, // some bluish
                white: Math.random() > 0.3
            };
        });

        let phase = 0; // 0 = stars idle, 1 = accelerating, 2 = streaking, 3 = flash
        let t = 0;
        let raf;
        const totalDuration = 2800; // ms total before redirect

        const startTime = performance.now();

        const draw = (now) => {
            const elapsed = now - startTime;
            t = elapsed / totalDuration;

            ctx.fillStyle = 'rgba(0, 0, 0, 1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerX = cx();
            const centerY = cy();
            const maxR = Math.sqrt(centerX * centerX + centerY * centerY);

            // Phase transitions
            if (t < 0.15) phase = 0;       // idle twinkling stars
            else if (t < 0.55) phase = 1;  // accelerating
            else if (t < 0.85) phase = 2;  // full hyperspace streaks
            else phase = 3;                // white flash + redirect

            stars.forEach(s => {
                const x1 = centerX + Math.cos(s.angle) * s.dist * maxR;
                const y1 = centerY + Math.sin(s.angle) * s.dist * maxR;

                if (phase === 0) {
                    // Twinkling dots
                    const twinkle = 0.5 + Math.sin(now * 0.003 + s.angle * 10) * 0.5;
                    ctx.beginPath();
                    ctx.arc(x1, y1, 1.2 * s.brightness, 0, Math.PI * 2);
                    ctx.fillStyle = s.white
                        ? `rgba(255,255,255,${s.brightness * twinkle})`
                        : `hsla(${s.hue},70%,75%,${s.brightness * twinkle})`;
                    ctx.fill();
                } else {
                    // Streaking phase
                    let accel;
                    if (phase === 1) {
                        const pt = (t - 0.15) / 0.4;
                        accel = pt * pt * pt; // cubic ease-in
                    } else {
                        accel = 1;
                    }

                    const streakLen = s.dist * maxR * accel * 0.6 + 2;
                    const x2 = centerX + Math.cos(s.angle) * (s.dist * maxR + streakLen);
                    const y2 = centerY + Math.sin(s.angle) * (s.dist * maxR + streakLen);

                    const lineWidth = (phase === 2) ? 2.5 * s.brightness : 1.5 * s.brightness * (0.5 + accel * 0.5);

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = s.white
                        ? `rgba(255,255,255,${s.brightness * (0.4 + accel * 0.6)})`
                        : `hsla(${s.hue},80%,80%,${s.brightness * (0.4 + accel * 0.6)})`;
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();
                }

                // Move stars outward during streaking
                if (phase >= 1) {
                    const speedMult = phase === 2 ? 8 : (1 + ((t - 0.15) / 0.4) * 7);
                    s.dist += s.speed * speedMult;
                    if (s.dist > 1.5) {
                        s.dist = 0.01;
                        s.angle = Math.random() * Math.PI * 2;
                    }
                }
            });

            // Central glow
            if (phase >= 1) {
                const glowIntensity = phase === 2 ? 0.35 : Math.min((t - 0.15) / 0.4, 1) * 0.2;
                const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxR * 0.3);
                grad.addColorStop(0, `rgba(200, 220, 255, ${glowIntensity})`);
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Flash phase
            if (phase === 3) {
                const flashT = (t - 0.85) / 0.15;
                overlay.querySelector('.hyper-flash').style.opacity = flashT;
            }

            if (t < 1) {
                raf = requestAnimationFrame(draw);
            } else {
                // Redirect!
                cancelAnimationFrame(raf);
                window.removeEventListener('resize', resize);
                window.location.href = 'https://www.facebook.com/cheng.steve.58/?locale=zh_TW';
            }
        };

        raf = requestAnimationFrame(draw);
    }
});
