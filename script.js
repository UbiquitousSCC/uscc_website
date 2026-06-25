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

    // ---- AI Visitor Counter ----
    // Shows a real, shared visit total via counterapi.dev (free, no auth, CORS-open).
    // If the service is unreachable it falls back to the last value cached in
    // localStorage (or a baseline), so the display never looks broken.
    (function aiVisitorCounter() {
        const canvas = document.getElementById('neuralCanvas');
        if (canvas) initNeural(canvas);

        const countEl = document.getElementById('visitorCount');
        const statusEl = document.getElementById('aiStatus');
        if (!countEl) return;

        const digitEls = Array.from(countEl.querySelectorAll('.ai-digit'));
        const slots = digitEls.length;                 // 5 tiles → shows last 5 digits
        const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

        // Status text follows the page language (<html lang>); labels live in the markup.
        const en = (document.documentElement.lang || '').toLowerCase().startsWith('en');
        const TXT = {
            synced:  en ? 'live analysis · synced' : '即時分析 · 已同步',
            offline: en ? 'Offline · local cache'     : '離線統計 · 本機快取',
        };

        // Paint a number across the digit tiles; flip any tile whose value changed.
        const renderDigits = (value, flip) => {
            const str = String(Math.max(0, Math.round(value))).padStart(slots, '0').slice(-slots);
            digitEls.forEach((el, i) => {
                const ch = str[i];
                if (el.textContent === ch) return;
                el.textContent = ch;
                el.dataset.digit = ch;
                if (flip && !reduceMotion) {
                    el.classList.remove('flip');
                    void el.offsetWidth;                // restart the CSS flip animation
                    el.classList.add('flip');
                }
            });
        };

        // Odometer-style count-up to the total, then a staggered flip flourish.
        const revealTo = (total) => {
            if (reduceMotion) { renderDigits(total, false); return; }
            const dur = 1600, start = performance.now();
            const tick = (now) => {
                const p = Math.min((now - start) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                renderDigits(total * eased, false);
                if (p < 1) { requestAnimationFrame(tick); return; }
                renderDigits(total, false);
                digitEls.forEach((el, i) => setTimeout(() => {
                    el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
                }, i * 90));
            };
            requestAnimationFrame(tick);
        };

        // counterapi.dev: `/up` increments + returns the total; trailing `/` reads it.
        const NS = 'usccncku', KEY = 'site-visits';
        const BASE = 'https://api.counterapi.dev/v1/' + NS + '/' + KEY;
        const CACHE = 'uscc_visits_cache';
        const firstThisSession = !sessionStorage.getItem('uscc_visit_counted');
        const url = firstThisSession ? BASE + '/up' : BASE + '/';

        const fallback = () => {
            const cached = parseInt(localStorage.getItem(CACHE) || '', 10);
            setStatus(TXT.offline);
            revealTo(Number.isFinite(cached) ? cached : 1000);   // baseline if never synced
        };

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        fetch(url, { signal: ctrl.signal, cache: 'no-store' })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                clearTimeout(timer);
                const total = parseInt(data.count, 10);
                if (!Number.isFinite(total)) return fallback();
                sessionStorage.setItem('uscc_visit_counted', '1');
                localStorage.setItem(CACHE, String(total));
                setStatus(TXT.synced);
                revealTo(total);
            })
            .catch(() => { clearTimeout(timer); fallback(); });
    })();

    // Neural-network background for the visitor counter: drifting nodes, proximity
    // links, and the occasional "signal" pulse travelling along an edge.
    function initNeural(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const LINE = '111, 125, 78';   // sage green (links)
        const NODE = '169, 128, 60';   // antique gold (nodes / pulses)
        const LINK = 150;              // px: max distance to draw a connection
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let w = 0, h = 0, nodes = [], pulses = [], raf = null, running = false;

        const build = () => {
            const rect = canvas.getBoundingClientRect();
            w = rect.width; h = rect.height;
            if (!w || !h) return;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.max(14, Math.min(46, Math.round(w * h / 18000)));
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
                r: Math.random() * 1.6 + 1.1,
            }));
            pulses = [];
        };

        const spawnPulse = () => {
            if (nodes.length < 2 || pulses.length > 5) return;
            const a = Math.floor(Math.random() * nodes.length);
            let b = Math.floor(Math.random() * nodes.length);
            if (a === b) b = (b + 1) % nodes.length;
            pulses.push({ a, b, t: 0, speed: Math.random() * 0.012 + 0.006 });
        };

        const drawLinks = (maxAlpha) => {
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = nodes[i], b = nodes[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d > LINK) continue;
                    ctx.strokeStyle = `rgba(${LINE}, ${(1 - d / LINK) * maxAlpha})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                }
            }
        };

        const drawNodes = () => {
            ctx.fillStyle = `rgba(${NODE}, 0.75)`;
            for (const n of nodes) {
                ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
            }
        };

        const frame = () => {
            ctx.clearRect(0, 0, w, h);
            for (const n of nodes) {
                n.x += n.vx; n.y += n.vy;
                if (n.x < 0 || n.x > w) n.vx *= -1;
                if (n.y < 0 || n.y > h) n.vy *= -1;
                n.x = Math.max(0, Math.min(w, n.x));
                n.y = Math.max(0, Math.min(h, n.y));
            }
            drawLinks(0.5);
            for (let k = pulses.length - 1; k >= 0; k--) {
                const p = pulses[k];
                p.t += p.speed;
                const a = nodes[p.a], b = nodes[p.b];
                if (p.t >= 1 || !a || !b) { pulses.splice(k, 1); continue; }
                const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
                const glow = Math.sin(p.t * Math.PI);
                ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${NODE}, ${0.9 * glow})`;
                ctx.shadowBlur = 8; ctx.shadowColor = `rgba(${NODE}, ${glow})`;
                ctx.fill(); ctx.shadowBlur = 0;
            }
            drawNodes();
            if (Math.random() < 0.03) spawnPulse();
            raf = requestAnimationFrame(frame);
        };

        const start = () => {
            if (running || reduceMotion) return;
            if (!nodes.length || !w) build();
            if (!nodes.length) return;
            running = true;
            raf = requestAnimationFrame(frame);
        };
        const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = null; };

        build();
        if (reduceMotion) {
            ctx.clearRect(0, 0, w, h); drawLinks(0.45); drawNodes();   // single static frame
        } else {
            // Only animate while the section is on-screen.
            new IntersectionObserver((entries) => {
                entries.forEach(e => e.isIntersecting ? start() : stop());
            }, { threshold: 0 }).observe(canvas);
        }

        let rt;
        window.addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => {
                const wasRunning = running;
                stop(); build();
                if (reduceMotion) { ctx.clearRect(0, 0, w, h); drawLinks(0.45); drawNodes(); }
                else if (wasRunning) start();
            }, 200);
        }, { passive: true });
    }

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
