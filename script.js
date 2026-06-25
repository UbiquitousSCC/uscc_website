// USCC Lab — UI interactions (heritage tea-house redesign)
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
});
