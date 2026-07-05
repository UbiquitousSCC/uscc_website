// USCC Lab — UI interactions (heritage tea-house redesign)

// The `js-reveal` flag is set by a tiny inline <script> in each page's <head>,
// BEFORE first paint, so reveal-on-scroll hiding only applies when JS is present
// to later un-hide it. This file is deferred (it runs after parse), so it must
// not be relied on to set that flag pre-paint — the inline head script owns it.
// If this file fails to load, .reveal elements simply stay visible — no blank sections.

document.addEventListener('DOMContentLoaded', () => {
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

    // ---- Hover-to-play BGM on member cards with data-hover-bgm ----
    // Hovering a card for 0.5s starts its clip; leaving it — or leaving before the
    // 0.5s elapses — cancels the pending start and stops playback. Slides also carry
    // data-hover-bgm, but the slideshow owns those (image swap + its own timing), so
    // exclude .slide here. preload='none' means each mp3 is fetched only on the first
    // hover (never on touch devices, which can't hover) — saves ~690 KB on the members page.
    document.querySelectorAll('[data-hover-bgm]:not(.slide)').forEach(card => {
        const audio = new Audio(card.dataset.hoverBgm);
        audio.preload = 'none';
        let t = null;
        const stop = () => { clearTimeout(t); t = null; audio.pause(); audio.currentTime = 0; };
        card.addEventListener('mouseenter', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                audio.currentTime = 0;
                audio.play().catch(() => { /* autoplay may be blocked until first user gesture */ });
            }, 500);
        });
        card.addEventListener('mouseleave', stop);
    });

    // ---- Lazy-load YouTube: swap the lightweight facade for the real iframe on click ----
    document.querySelectorAll('.yt-facade').forEach(facade => {
        facade.addEventListener('click', (e) => {
            e.preventDefault();   // with JS: load inline. Without JS: the href opens YouTube.
            const id = facade.dataset.yt;
            if (!id) return;
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
            iframe.title = 'YouTube video player';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            iframe.allowFullscreen = true;
            iframe.style.cssText = 'width:100%;aspect-ratio:16/9;border:1px solid var(--border);border-radius:12px;display:block';
            facade.replaceWith(iframe);
        });
    });

    // ---- Slideshow: cross-fade between Lab Moments ----
    // Arrows / dots / keyboard arrows / touch-swipe all jump to a slide; it also
    // auto-advances every 5s by default (data-interval overrides, ms), pausing on hover, focus, and while off-screen.
    // The fade itself is CSS.
    document.querySelectorAll('.slideshow').forEach(box => {
        const slides = Array.from(box.querySelectorAll('.slide'));
        if (slides.length < 2) return;

        // Blurred backdrop fill: expose each slide's own image as --slide-bg so CSS can
        // soften + scale it behind the (object-fit:contain) photo, filling the letterbox
        // without cropping. JS-off falls back to the frame colour — no blank/broken box.
        slides.forEach(slide => {
            const img = slide.querySelector('img');
            const src = img && img.getAttribute('src');
            if (src) slide.style.setProperty('--slide-bg', `url("${src}")`);
        });

        const prevBtn = box.querySelector('.slide-btn.prev');
        const nextBtn = box.querySelector('.slide-btn.next');
        const dotWrap = box.querySelector('.slide-dots');

        let i = slides.findIndex(s => s.classList.contains('is-active'));
        if (i < 0) i = 0;

        // Build one dot per slide so the markup stays count-agnostic.
        const dots = slides.map((_, n) => {
            const d = document.createElement('button');
            d.type = 'button';
            d.setAttribute('role', 'tab');
            d.setAttribute('aria-label', String(n + 1));
            d.addEventListener('click', () => go(n, true));
            if (dotWrap) dotWrap.appendChild(d);
            return d;
        });

        // Per-slide hover swap: hovering an eligible slide (data-hover-src) for 2s
        // swaps in an alternate image and, if data-hover-bgm is set, plays it.
        // Leaving the slide — or navigating away — reverts the image and stops the clip.
        // Only the active slide receives hover events (others are visibility:hidden).
        const hovers = slides.map(slide => {
            const altSrc = slide.dataset.hoverSrc;
            if (!altSrc) return null;
            const img = slide.querySelector('img');
            if (!img) return null;
            const baseSrc = img.getAttribute('src');
            const audio = slide.dataset.hoverBgm ? new Audio(slide.dataset.hoverBgm) : null;
            if (audio) audio.preload = 'none';
            new Image().src = altSrc;   // warm the cache so the 2s swap is instant
            let t = null;
            const reset = () => {
                clearTimeout(t); t = null;
                img.setAttribute('src', baseSrc);
                if (audio) { audio.pause(); audio.currentTime = 0; }
            };
            slide.addEventListener('mouseenter', () => {
                clearTimeout(t);
                t = setTimeout(() => {
                    img.setAttribute('src', altSrc);
                    if (audio) { audio.currentTime = 0; audio.play().catch(() => { /* gesture may be required */ }); }
                }, 2000);
            });
            slide.addEventListener('mouseleave', reset);
            return reset;
        }).filter(Boolean);
        const resetHovers = () => hovers.forEach(reset => reset());

        const AUTO = Number(box.dataset.interval) || 5000;   // per-slideshow override via data-interval (ms)
        let timer = null;
        const play = () => { clearInterval(timer); timer = setInterval(() => go(i + 1, false), AUTO); };
        const pause = () => { clearInterval(timer); timer = null; };

        function go(n, user) {
            resetHovers();   // never leave a swapped image / playing clip behind when the slide changes
            i = (n + slides.length) % slides.length;
            slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
            dots.forEach((d, k) => {
                d.classList.toggle('is-active', k === i);
                d.setAttribute('aria-selected', k === i ? 'true' : 'false');
            });
            if (user) play();   // a manual jump resets the auto-advance timer
        }

        if (prevBtn) prevBtn.addEventListener('click', () => go(i - 1, true));
        if (nextBtn) nextBtn.addEventListener('click', () => go(i + 1, true));

        // Arrow keys when the slideshow (or anything inside it) holds focus.
        box.tabIndex = 0;
        box.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') { go(i - 1, true); e.preventDefault(); }
            else if (e.key === 'ArrowRight') { go(i + 1, true); e.preventDefault(); }
        });

        box.addEventListener('mouseenter', pause);
        box.addEventListener('mouseleave', play);
        box.addEventListener('focusin', pause);
        box.addEventListener('focusout', play);

        // Touch swipe (left = next, right = prev).
        let x0 = null;
        box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
        box.addEventListener('touchend', (e) => {
            if (x0 === null) return;
            const dx = e.changedTouches[0].clientX - x0;
            if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1), true);
            x0 = null;
        }, { passive: true });

        go(i, false);
        // Only auto-advance while the slideshow is on-screen.
        new IntersectionObserver((entries) => {
            entries.forEach(e => e.isIntersecting ? play() : pause());
        }, { threshold: 0.25 }).observe(box);
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
        const countLabel = en ? 'Total visits' : '訪客造訪次數';

        // Paint a number across the digit tiles; flip any tile whose value changed.
        const renderDigits = (value, flip) => {
            const str = String(Math.max(0, Math.round(value))).padStart(slots, '0').slice(-slots);
            countEl.setAttribute('aria-label', countLabel + ' ' + Number(str));   // keep SR label in sync with the tiles
            digitEls.forEach((el, i) => {
                const ch = str[i];
                if (el.textContent === ch) return;
                el.textContent = ch;
                el.dataset.digit = ch;
                if (flip) {
                    el.classList.remove('flip');
                    void el.offsetWidth;                // restart the CSS flip animation
                    el.classList.add('flip');
                }
            });
        };

        // Odometer-style count-up to the total, then a staggered flip flourish.
        const revealTo = (total) => {
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
        fetch(url, { signal: ctrl.signal, cache: 'no-store', referrerPolicy: 'no-referrer' })
            .then(r => { clearTimeout(timer); return r.ok ? r.json() : Promise.reject(r.status); })
            .then(data => {
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
            if (running) return;
            if (!nodes.length || !w) build();
            if (!nodes.length) return;
            running = true;
            raf = requestAnimationFrame(frame);
        };
        const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = null; };

        build();
        // Only animate while the section is on-screen.
        new IntersectionObserver((entries) => {
            entries.forEach(e => e.isIntersecting ? start() : stop());
        }, { threshold: 0 }).observe(canvas);

        let rt;
        window.addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => {
                const wasRunning = running;
                stop(); build();
                if (wasRunning) start();
            }, 200);
        }, { passive: true });
    }
 
    const eggCodeLower = 'uscc';
    const eggCodeUpper = 'USCC';
    const eggCodeTwice = 'twice';
    const eggMaxLen = Math.max(eggCodeUpper.length, eggCodeLower.length, eggCodeTwice.length);
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
        // Keep buffer trimmed to the longest code so every code can still be matched.
        if (eggBufRaw.length > eggMaxLen) eggBufRaw = eggBufRaw.slice(-eggMaxLen);

        if (eggBufRaw.toLowerCase().endsWith(eggCodeTwice)) {
            eggBufRaw = '';
            eggActive = true;
            showTwiceEgg();
        }
        // "USCC" (uppercase only) → hyperspace jump
        else if (eggBufRaw.endsWith(eggCodeUpper)) {
            eggBufRaw = '';
            eggActive = true;
            showHyperspaceJump();
        }
        // "uscc" (any case) → cinematic overlay
        else if (eggBufRaw.toLowerCase().endsWith(eggCodeLower)) {
            eggBufRaw = '';
            eggActive = true;
            showEasterEgg();
        }
    });

    function showTwiceEgg() {
        const overlay = document.createElement('div');
        overlay.id = 'uscc-egg';
        overlay.className = 'twice-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'TWICE — What is Love?');
        overlay.tabIndex = -1;
        overlay.innerHTML = `
            <div class="twice-welcome">歡迎 <span>ONCE</span> 的加入</div>
            <div class="twice-text">
                <span class="twice-word">WHAT</span>
                <span class="twice-word">IS</span>
                <span class="twice-word">LOVE</span>
            </div>
            <svg viewBox="0 0 100 150" class="twice-qm" aria-hidden="true">
                <path class="twice-qm-curve" d="M 30 50 C 30 10, 80 10, 80 50 C 80 80, 50 90, 50 115" />
                <circle class="twice-qm-dot" cx="50" cy="135" r="7" />
            </svg>
            <div class="twice-photo-stage">
                <img class="twice-photo" src="material/members/twice_answer.png" alt="" width="1920" height="1005" decoding="async" />
            </div>
            <div class="egg-hint twice-hint">Press <kbd>ESC</kbd> or click to close</div>
        `;
        document.body.appendChild(overlay);
        overlay.focus();
        overlay.addEventListener('click', dismissEgg);

        // Prime the SVG "air question mark" draw: hide the stroke by its own length,
        // then the .twice-show class animates strokeDashoffset back to 0.
        const curve = overlay.querySelector('.twice-qm-curve');
        const len = curve.getTotalLength();
        curve.style.strokeDasharray = len;
        curve.style.strokeDashoffset = len;

        // Kick off all child animations on the next frame (lets the initial state paint first).
        requestAnimationFrame(() => overlay.classList.add('twice-show'));

        // Play the easter-egg track; loops while the overlay stays open.
        const audio = new Audio('material/members/easter.mp3');
        audio.loop = false;
        audio.play().catch(() => { /* file missing or gesture required — fail silently */ });

        audio.addEventListener('ended', dismissEgg); 
    }

    function showEasterEgg() {
        // Build overlay
        const overlay = document.createElement('div');
        overlay.id = 'uscc-egg';
        overlay.className = 'egg-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'USCC Lab');
        overlay.tabIndex = -1;
        overlay.innerHTML = `
            <canvas class="egg-particles"></canvas>
            <div class="egg-content">
                <div class="egg-seal">U</div>
                <div class="egg-title">USCC Lab</div>
                <div class="egg-subtitle">Ubiquitous Sensing &amp; Cloud Computing</div>
                <div class="egg-divider"></div>
                <p class="egg-motto">「 以技術淬鍊智慧，用程式書寫未來 」</p>
                <p class="egg-motto-en">Forging intelligence through technology,<br>writing the future in code.</p>
                <div class="egg-hint">Press <kbd>ESC</kbd> or click to close</div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.focus();

        // Click to dismiss
        overlay.addEventListener('click', dismissEgg);

        // ---- Particle canvas animation ----
        const canvas = overlay.querySelector('.egg-particles');
        const ctx = canvas.getContext('2d');
        if (!ctx) { dismissEgg(); return; }
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
 
        const audio = new Audio('material/members/traverse.mp3');
        audio.play().catch(() => { /* file missing or gesture required — fail silently */ });
        const audioMo = new MutationObserver(() => {
            if (!document.getElementById('uscc-egg')) { audio.pause(); audioMo.disconnect(); }
        });
        audioMo.observe(document.body, { childList: true });

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
        const totalDuration = 6000; // ms total before redirect

        const startTime = performance.now();

        const draw = (now) => {
            // If the overlay was dismissed (Escape), stop the loop, drop the
            // resize listener, and skip the redirect — don't jump after a cancel.
            if (!document.getElementById('uscc-egg')) {
                cancelAnimationFrame(raf);
                window.removeEventListener('resize', resize);
                return;
            }
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

// ---- News page: show only competition awards from the last 3 years ----
// Progressive enhancement: with JS off, all awards stay visible (no blank section).
// No-ops on pages without a [data-awards] list.
document.addEventListener('DOMContentLoaded', () => {
    const list = document.querySelector('[data-awards]');
    if (!list) return;
    const YEARS_BACK = 3;                                   // keep this year + the 3 prior years
    const cutoff = new Date().getFullYear() - YEARS_BACK;   // e.g. 2026 - 3 = 2023 -> show year >= 2023
    let shown = 0;
    list.querySelectorAll('li[data-year]').forEach(li => {
        const y = parseInt(li.dataset.year, 10);
        const keep = !Number.isFinite(y) || y >= cutoff;
        li.classList.toggle('is-hidden', !keep);
        if (keep) shown++;
    });
    const empty = list.querySelector('[data-awards-empty]');
    if (empty) empty.classList.toggle('is-hidden', shown !== 0);
});

// ---- Graduate page: year tabs, rendered entirely from graduateData ----
// No-ops on pages without the tab/panel containers.
document.addEventListener('DOMContentLoaded', () => {
    const tabsEl = document.querySelector('[data-grad-tabs]');
    const panelEl = document.querySelector('[data-grad-panel]');
    if (!tabsEl || !panelEl) return;

    const graduateDataZh = {

        // '115級': [
        //     { name: '張耕齊', job: '台積電' },
        //     { name: '簡劭宸', job: '群聯電子' },
        //     { name: '徐振傑', job: '光寶科技' },
        //     { name: '王文耀', job: '群聯電子' },
        //     { name: '劉俊廷', job: '台積電' },
        // ],
        '114級': [
            { name: '傅信豪', job: '華碩', photo: 'fuxinhao.webp' },
            { name: '林俊廷', job: '君帆工業' },
            { name: '鄒佳昌', job: '台積電' },
            { name: '陳韶均', job: '' },
            { name: '邱子珆', job: '台積電' },
            { name: '蔡宇柔', job: '美光科技' },
            { name: '朱宇淵', job: '台積電' },
        ],
        '113級': [
            { name: '廖柏棠', job: '玩美移動' },
            { name: '張嘉進', job: '' },
            { name: '張庭瑜', job: '和碩聯合科技' },
            { name: '鄧晴', job: '玩美移動' },
            { name: '林溢泓', job: '聯發科技' },
            { name: '張晏榕', job: '台積電' },
            { name: '廖偉佑', job: '玩美移動' },
            { name: '林晨鈞', job: '台積電' },
        ],
        '112級': [
            { name: '鄭郁霖', job: '' },
            { name: '葉濬偉', job: '' },
            { name: '高德龍', job: '' },
            { name: '楊宗翰', job: '' },
            { name: '曾凰嘉', job: '台積電' },
            { name: '劉佳泓', job: 'Synology' },
        ],
        '111級': [
            { name: '王登立', job: '' },
            { name: '徐偉峰', job: '' },
            { name: '何昌祐', job: '' },
            { name: '王子源', job: '' },
            { name: '徐郁淞', job: '' },
        ],
        '110級': [
            { name: '潘崇智', job: '' },
            { name: '田亦心', job: '' },
            { name: '李昀陽', job: '' },
            { name: '黃威智', job: '' },
            { name: '林佳萱', job: '' },
        ],
    };

    // English mirror of graduateDataZh — names in Hanyu Pinyin, companies in their English names.
    // Keep both objects in sync: any addition/edit above must be mirrored below.
    const graduateDataEn = {

        // 'Class of 115': [
        //     { name: 'Keng Chi Zhang', job: 'TSMC' },
        //     { name: 'Shao Chen Jian', job: 'Plextor' },
        //     { name: 'Zhen Jie Xu', job: 'Lite-On' },
        //     { name: 'Wen Yao Wang', job: 'Plextor' },
        //     { name: 'Jun Ting Liu', job: 'TSMC' },
        // ],
        'Class of 114': [
            { name: 'Xin Hao Fu', job: 'ASUS', photo: 'fuxinhao.webp' },
            { name: 'Jun Ting Lin', job: 'Junfan Industrial' },
            { name: 'Jia Chang Zou', job: 'TSMC' },
            { name: 'Shao Jun Chen', job: '' },
            { name: 'Zi Tai Qiu', job: 'TSMC' },
            { name: 'Yu Rou Cai', job: 'Micron Technology' },
            { name: 'Yu Yuan Zhu', job: 'TSMC' },
        ],
        'Class of 113': [
            { name: 'Bo Tang Liao', job: 'Perfect Corp.' },
            { name: 'Jia Jin Zhang', job: '' },
            { name: 'Ting Yu Zhang', job: 'Pegatron' },
            { name: 'Qing Deng', job: 'Perfect Corp.' },
            { name: 'Yi Hong Lin', job: 'MediaTek' },
            { name: 'Yan Rong Zhang', job: 'TSMC' },
            { name: 'Wei You Liao', job: 'Perfect Corp.' },
            { name: 'Chen Jun Lin', job: 'TSMC' },
        ],
        'Class of 112': [
            { name: 'Yu Lin Zheng', job: '' },
            { name: 'Jun Wei Ye', job: '' },
            { name: 'De Long Gao', job: '' },
            { name: 'Zong Han Yang', job: '' },
            { name: 'Huang Jia Zeng', job: 'TSMC' },
            { name: 'Jia Hong Liu', job: 'Synology' },
        ],
        'Class of 111': [
            { name: 'Deng Li Wang', job: '' },
            { name: 'Wei Feng Xu', job: '' },
            { name: 'Chang You He', job: '' },
            { name: 'Zi Yuan Wang', job: '' },
            { name: 'Yu Song Xu', job: '' },
        ],
        'Class of 110': [
            { name: 'Chong Zhi Pan', job: '' },
            { name: 'Yi Xin Tian', job: '' },
            { name: 'Yun Yang Li', job: '' },
            { name: 'Wei Zhi Huang', job: '' },
            { name: 'Jia Xuan Lin', job: '' },
        ],
    };

    const isEnglish = document.documentElement.lang.toLowerCase().startsWith('en');
    const graduateData = isEnglish ? graduateDataEn : graduateDataZh;
    const emptyPanelText = isEnglish ? 'No graduate data for this class yet.' : '此屆暫無畢業生資料。';

    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

    const years = Object.keys(graduateData);
    panelEl.id = panelEl.id || 'gradPanel';
    panelEl.setAttribute('role', 'tabpanel');

    const renderPanel = (year) => {
        const students = graduateData[year] || [];
        panelEl.innerHTML = students.length ? students.map(s => {
            const job = (s.job || '').trim();
            const photo = s.photo
                ? `<img src="material/graduate/${encodeURIComponent(s.photo)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" />`
                : '';
            return `
                <div class="grad-card">
                    <div class="grad-avatar" aria-hidden="true"><span class="grad-avatar-init">${escapeHtml(s.name.charAt(0))}</span>${photo}</div>
                    <div class="grad-name">${escapeHtml(s.name)}</div>
                    <div class="grad-job ${job ? 'has-job' : 'no-job'}">${job ? escapeHtml(job) : '—'}</div>
                </div>`;
        }).join('') : `<p class="grad-empty">${emptyPanelText}</p>`;
        panelEl.classList.remove('grad-fade');
        void panelEl.offsetWidth;   // restart the fade-in animation
        panelEl.classList.add('grad-fade');
    };

    const selectYear = (year) => {
        buttons.forEach(btn => {
            const active = btn.dataset.year === year;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
        });
        panelEl.setAttribute('aria-labelledby', `grad-tab-${year}`);
        renderPanel(year);
    };

    const buttons = years.map(year => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'grad-tab';
        btn.textContent = year;
        btn.id = `grad-tab-${year}`;
        btn.dataset.year = year;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-controls', panelEl.id);
        btn.addEventListener('click', () => selectYear(year));
        tabsEl.appendChild(btn);
        return btn;
    });

    // Roving tabindex: arrow keys move focus + selection between tabs (WAI-ARIA tabs pattern).
    tabsEl.addEventListener('keydown', (e) => {
        const i = buttons.indexOf(document.activeElement);
        if (i < 0) return;
        let n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % buttons.length;
        else if (e.key === 'ArrowLeft') n = (i - 1 + buttons.length) % buttons.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = buttons.length - 1;
        if (n === null) return;
        e.preventDefault();
        buttons[n].focus();
        selectYear(buttons[n].dataset.year);
    });

    selectYear(years[0]);
});
