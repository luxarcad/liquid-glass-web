(() => {
    "use strict";

    /* =====================================================
       AETHER STUDIO
       Interfaz, accesibilidad y animaciones
       ===================================================== */

    const root = document.documentElement;
    const body = document.body;

    const THEME_STORAGE_KEY = "aether-theme";
    const MOBILE_BREAKPOINT = 900;
    const MINIMUM_LOADER_TIME = 2400;

    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    const prefersDarkTheme = window.matchMedia(
        "(prefers-color-scheme: dark)"
    );

    const supportsFinePointer = window.matchMedia(
        "(hover: hover) and (pointer: fine)"
    );

    const select = (selector, parent = document) => {
        return parent.querySelector(selector);
    };

    const selectAll = (selector, parent = document) => {
        return [...parent.querySelectorAll(selector)];
    };

    root.classList.add("js");

    /* =====================================================
       UTILIDADES
       ===================================================== */

    function clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), maximum);
    }

    function isValidTheme(theme) {
        return theme === "light" || theme === "dark";
    }

    function getStoredTheme() {
        try {
            const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

            return isValidTheme(storedTheme)
                ? storedTheme
                : null;
        } catch {
            return null;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            /*
             * Algunos modos privados pueden impedir el uso
             * de localStorage. El cambio visual seguirá funcionando.
             */
        }
    }

    function runMediaQueryListener(mediaQuery, callback) {
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", callback);
            return;
        }

        /*
         * Compatibilidad con versiones anteriores de Safari.
         */
        if (typeof mediaQuery.addListener === "function") {
            mediaQuery.addListener(callback);
        }
    }

    /* =====================================================
       PANTALLA DE CARGA
       ===================================================== */

    function initializeLoader() {
        const loader = select("#page-loader");

        if (!loader) {
            return;
        }

        const removeLoader = () => {
            const elapsedTime = performance.now();

            const remainingTime = Math.max(
                0,
                MINIMUM_LOADER_TIME - elapsedTime
            );

            window.setTimeout(() => {
                loader.remove();
                root.classList.add("page-ready");

                window.dispatchEvent(
                    new CustomEvent("aether:pageready")
                );
            }, remainingTime);
        };

        if (document.readyState === "complete") {
            removeLoader();
        } else {
            window.addEventListener("load", removeLoader, {
                once: true
            });
        }

        /*
         * Si la página regresa desde el caché del navegador,
         * evitamos volver a mostrar el loader.
         */
        window.addEventListener("pageshow", (event) => {
            if (event.persisted) {
                loader.remove();
                root.classList.add("page-ready");
            }
        });
    }

    /* =====================================================
       CAMBIO DE TEMA
       ===================================================== */

    function initializeTheme() {
        const themeButton = select("#theme-toggle");
        const themeColorMeta = select("#theme-color");

        let hasManualTheme = Boolean(getStoredTheme());

        const themeColors = {
            light: "#edf2ff",
            dark: "#060712"
        };

        function updateThemeInterface(theme) {
            const isDark = theme === "dark";
            const nextThemeName = isDark ? "claro" : "oscuro";

            if (themeButton) {
                themeButton.setAttribute(
                    "aria-label",
                    `Cambiar al modo ${nextThemeName}`
                );

                themeButton.setAttribute(
                    "title",
                    `Cambiar al modo ${nextThemeName}`
                );

                themeButton.setAttribute(
                    "aria-pressed",
                    String(isDark)
                );
            }

            if (themeColorMeta) {
                themeColorMeta.setAttribute(
                    "content",
                    themeColors[theme]
                );
            }
        }

        function applyTheme(theme, options = {}) {
            const {
                save = false,
                notify = true
            } = options;

            if (!isValidTheme(theme)) {
                return;
            }

            root.dataset.theme = theme;

            updateThemeInterface(theme);

            if (save) {
                saveTheme(theme);
                hasManualTheme = true;
            }

            if (notify) {
                window.dispatchEvent(
                    new CustomEvent("aether:themechange", {
                        detail: {
                            theme
                        }
                    })
                );
            }
        }

        function changeTheme(theme) {
            const canUseViewTransition =
                typeof document.startViewTransition === "function" &&
                !prefersReducedMotion.matches;

            if (canUseViewTransition) {
                document.startViewTransition(() => {
                    applyTheme(theme, {
                        save: true
                    });
                });

                return;
            }

            applyTheme(theme, {
                save: true
            });
        }

        const initialTheme = isValidTheme(root.dataset.theme)
            ? root.dataset.theme
            : prefersDarkTheme.matches
                ? "dark"
                : "light";

        applyTheme(initialTheme, {
            notify: false
        });

        themeButton?.addEventListener("click", () => {
            const currentTheme = root.dataset.theme;

            const nextTheme =
                currentTheme === "dark"
                    ? "light"
                    : "dark";

            changeTheme(nextTheme);
        });

        runMediaQueryListener(prefersDarkTheme, (event) => {
            if (hasManualTheme) {
                return;
            }

            applyTheme(event.matches ? "dark" : "light");
        });

        /*
         * Sincroniza el tema entre diferentes pestañas.
         */
        window.addEventListener("storage", (event) => {
            if (event.key !== THEME_STORAGE_KEY) {
                return;
            }

            if (isValidTheme(event.newValue)) {
                hasManualTheme = true;

                applyTheme(event.newValue, {
                    save: false
                });

                return;
            }

            hasManualTheme = false;

            applyTheme(
                prefersDarkTheme.matches ? "dark" : "light",
                {
                    save: false
                }
            );
        });
    }

    /* =====================================================
       MENÚ MÓVIL
       ===================================================== */

    function initializeMobileMenu() {
        const header = select("#site-header");
        const menuButton = select("#menu-toggle");
        const navigation = select("#primary-nav");

        if (!header || !menuButton || !navigation) {
            return;
        }

        const navigationLinks = selectAll(
            ".primary-nav__link",
            navigation
        );

        function setMenuState(isOpen, restoreFocus = false) {
            navigation.classList.toggle("is-open", isOpen);

            menuButton.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            menuButton.setAttribute(
                "aria-label",
                isOpen ? "Cerrar menú" : "Abrir menú"
            );

            if (!isOpen && restoreFocus) {
                menuButton.focus();
            }
        }

        function isMenuOpen() {
            return menuButton.getAttribute("aria-expanded") === "true";
        }

        menuButton.addEventListener("click", () => {
            setMenuState(!isMenuOpen());
        });

        navigationLinks.forEach((link) => {
            link.addEventListener("click", () => {
                setMenuState(false);
            });
        });

        document.addEventListener("pointerdown", (event) => {
            if (
                isMenuOpen() &&
                !header.contains(event.target)
            ) {
                setMenuState(false);
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || !isMenuOpen()) {
                return;
            }

            setMenuState(false, true);
        });

        window.addEventListener(
            "resize",
            () => {
                if (
                    window.innerWidth > MOBILE_BREAKPOINT &&
                    isMenuOpen()
                ) {
                    setMenuState(false);
                }
            },
            {
                passive: true
            }
        );
    }

    /* =====================================================
       HEADER AL HACER SCROLL
       ===================================================== */

    function initializeHeaderScroll() {
        const header = select("#site-header");

        if (!header) {
            return;
        }

        let ticking = false;

        function updateHeader() {
            header.classList.toggle(
                "is-scrolled",
                window.scrollY > 24
            );

            ticking = false;
        }

        function handleScroll() {
            if (ticking) {
                return;
            }

            ticking = true;
            requestAnimationFrame(updateHeader);
        }

        updateHeader();

        window.addEventListener("scroll", handleScroll, {
            passive: true
        });
    }

    /* =====================================================
       NAVEGACIÓN ACTIVA
       ===================================================== */

    function initializeActiveNavigation() {
        const navigationLinks = selectAll(
            ".primary-nav__link[href^='#']"
        );

        if (navigationLinks.length === 0) {
            return;
        }

        const sectionMap = new Map();

        navigationLinks.forEach((link) => {
            const sectionId = link.getAttribute("href");

            if (!sectionId || sectionId === "#") {
                return;
            }

            const section = select(sectionId);

            if (section) {
                sectionMap.set(section, link);
            }
        });

        function setActiveLink(activeLink) {
            navigationLinks.forEach((link) => {
                const isActive = link === activeLink;

                link.classList.toggle("is-active", isActive);

                if (isActive) {
                    link.setAttribute("aria-current", "page");
                } else {
                    link.removeAttribute("aria-current");
                }
            });
        }

        if (!("IntersectionObserver" in window)) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleSections = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (first, second) =>
                            second.intersectionRatio -
                            first.intersectionRatio
                    );

                const mostVisible = visibleSections[0];

                if (!mostVisible) {
                    return;
                }

                const activeLink = sectionMap.get(
                    mostVisible.target
                );

                if (activeLink) {
                    setActiveLink(activeLink);
                }
            },
            {
                root: null,
                rootMargin: "-32% 0px -52% 0px",
                threshold: [0, 0.15, 0.3, 0.55]
            }
        );

        sectionMap.forEach((_link, section) => {
            observer.observe(section);
        });
    }

    /* =====================================================
       APARICIONES POR SCROLL
       ===================================================== */

    function initializeScrollReveals() {
        const revealElements = selectAll("[data-reveal]");

        if (revealElements.length === 0) {
            return;
        }

        if (
            prefersReducedMotion.matches ||
            !("IntersectionObserver" in window)
        ) {
            revealElements.forEach((element) => {
                element.classList.add("is-visible");
            });

            return;
        }

        /*
         * Numeramos los elementos dentro de cada sección para
         * conseguir apariciones escalonadas.
         */
        selectAll("section").forEach((section) => {
            const sectionElements = selectAll(
                "[data-reveal]",
                section
            );

            sectionElements.forEach((element, index) => {
                element.dataset.revealOrder = String(
                    Math.min(index, 4)
                );
            });
        });

        root.classList.add("reveal-ready");

        const observer = new IntersectionObserver(
            (entries, currentObserver) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    const element = entry.target;
                    const order = Number(
                        element.dataset.revealOrder ?? 0
                    );

                    const delay = clamp(order * 85, 0, 340);

                    window.setTimeout(() => {
                        element.classList.add("is-visible");
                    }, delay);

                    currentObserver.unobserve(element);
                });
            },
            {
                root: null,
                rootMargin: "0px 0px -8% 0px",
                threshold: 0.14
            }
        );

        /*
         * Coordinamos la primera aparición con la salida
         * de la pantalla de carga.
         */
        const revealDelay = Math.max(
            0,
            1450 - performance.now()
        );

        window.setTimeout(() => {
            revealElements.forEach((element) => {
                observer.observe(element);
            });
        }, revealDelay);
    }

    /* =====================================================
       EFECTO TILT 3D
       ===================================================== */

    function initializeTiltCards() {
        if (
            prefersReducedMotion.matches ||
            !supportsFinePointer.matches
        ) {
            return;
        }

        const tiltElements = selectAll("[data-tilt]");

        tiltElements.forEach((element) => {
            let animationFrame = null;

            function updateTilt(event) {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }

                animationFrame = requestAnimationFrame(() => {
                    const bounds = element.getBoundingClientRect();

                    const relativeX =
                        (event.clientX - bounds.left) /
                        bounds.width;

                    const relativeY =
                        (event.clientY - bounds.top) /
                        bounds.height;

                    const normalizedX = relativeX - 0.5;
                    const normalizedY = relativeY - 0.5;

                    const rotateY = clamp(
                        normalizedX * 11,
                        -6,
                        6
                    );

                    const rotateX = clamp(
                        normalizedY * -9,
                        -5,
                        5
                    );

                    element.style.setProperty(
                        "--tilt-x",
                        `${rotateX.toFixed(2)}deg`
                    );

                    element.style.setProperty(
                        "--tilt-y",
                        `${rotateY.toFixed(2)}deg`
                    );

                    element.style.setProperty(
                        "--pointer-x",
                        `${(relativeX * 100).toFixed(2)}%`
                    );

                    element.style.setProperty(
                        "--pointer-y",
                        `${(relativeY * 100).toFixed(2)}%`
                    );
                });
            }

            function resetTilt() {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }

                element.style.setProperty("--tilt-x", "0deg");
                element.style.setProperty("--tilt-y", "0deg");
                element.style.setProperty("--pointer-x", "50%");
                element.style.setProperty("--pointer-y", "50%");
            }

            element.addEventListener(
                "pointermove",
                updateTilt,
                {
                    passive: true
                }
            );

            element.addEventListener(
                "pointerleave",
                resetTilt,
                {
                    passive: true
                }
            );
        });
    }

    /* =====================================================
       BOTONES MAGNÉTICOS
       ===================================================== */

    function initializeMagneticButtons() {
        if (
            prefersReducedMotion.matches ||
            !supportsFinePointer.matches
        ) {
            return;
        }

        const magneticElements = selectAll("[data-magnetic]");

        magneticElements.forEach((element) => {
            let animationFrame = null;

            function moveElement(event) {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }

                animationFrame = requestAnimationFrame(() => {
                    const bounds = element.getBoundingClientRect();

                    const centerX =
                        bounds.left + bounds.width / 2;

                    const centerY =
                        bounds.top + bounds.height / 2;

                    const distanceX =
                        event.clientX - centerX;

                    const distanceY =
                        event.clientY - centerY;

                    const movementX = clamp(
                        distanceX * 0.14,
                        -8,
                        8
                    );

                    const movementY = clamp(
                        distanceY * 0.18,
                        -6,
                        6
                    );

                    element.style.transform =
                        `translate3d(${movementX}px, ${movementY}px, 0)`;
                });
            }

            function resetElement() {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }

                element.style.transform =
                    "translate3d(0, 0, 0)";
            }

            element.addEventListener(
                "pointermove",
                moveElement,
                {
                    passive: true
                }
            );

            element.addEventListener(
                "pointerleave",
                resetElement,
                {
                    passive: true
                }
            );
        });
    }

    /* =====================================================
       PARALAJE DE LUCES
       ===================================================== */

    function initializePointerParallax() {
        if (
            prefersReducedMotion.matches ||
            !supportsFinePointer.matches
        ) {
            return;
        }

        const parallaxElements = selectAll("[data-parallax]");

        if (parallaxElements.length === 0) {
            return;
        }

        let animationFrame = null;
        let pointerX = window.innerWidth / 2;
        let pointerY = window.innerHeight / 2;

        function updateParallax() {
            const normalizedX =
                pointerX / window.innerWidth - 0.5;

            const normalizedY =
                pointerY / window.innerHeight - 0.5;

            parallaxElements.forEach((element) => {
                const depth = Number(
                    element.dataset.parallax ?? 0
                );

                const movementX =
                    normalizedX * 220 * depth;

                const movementY =
                    normalizedY * 180 * depth;

                /*
                 * La propiedad individual translate puede
                 * convivir con las animaciones transform del CSS.
                 */
                element.style.setProperty(
                    "translate",
                    `${movementX.toFixed(2)}px ${movementY.toFixed(2)}px`
                );
            });

            animationFrame = null;
        }

        function handlePointerMove(event) {
            pointerX = event.clientX;
            pointerY = event.clientY;

            if (animationFrame) {
                return;
            }

            animationFrame = requestAnimationFrame(
                updateParallax
            );
        }

        function resetParallax() {
            parallaxElements.forEach((element) => {
                element.style.setProperty(
                    "translate",
                    "0px 0px"
                );
            });
        }

        window.addEventListener(
            "pointermove",
            handlePointerMove,
            {
                passive: true
            }
        );

        document.documentElement.addEventListener(
            "pointerleave",
            resetParallax,
            {
                passive: true
            }
        );
    }

    /* =====================================================
       CONTADORES ANIMADOS
       ===================================================== */

    function initializeCounters() {
        const counters = selectAll("[data-counter]");

        if (counters.length === 0) {
            return;
        }

        const numberFormatter = new Intl.NumberFormat("es-MX");

        function setFinalValue(counter) {
            const target = Number(
                counter.dataset.counter ?? 0
            );

            counter.textContent = numberFormatter.format(target);
        }

        function animateCounter(counter) {
            if (counter.dataset.counted === "true") {
                return;
            }

            counter.dataset.counted = "true";

            const target = Number(
                counter.dataset.counter ?? 0
            );

            if (
                !Number.isFinite(target) ||
                prefersReducedMotion.matches
            ) {
                setFinalValue(counter);
                return;
            }

            const duration = 1600;
            const startingTime = performance.now();

            function updateCounter(currentTime) {
                const elapsedTime =
                    currentTime - startingTime;

                const progress = clamp(
                    elapsedTime / duration,
                    0,
                    1
                );

                /*
                 * Curva ease-out-quart.
                 */
                const easedProgress =
                    1 - Math.pow(1 - progress, 4);

                const currentValue = Math.round(
                    target * easedProgress
                );

                counter.textContent =
                    numberFormatter.format(currentValue);

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    setFinalValue(counter);
                }
            }

            requestAnimationFrame(updateCounter);
        }

        if (!("IntersectionObserver" in window)) {
            counters.forEach(animateCounter);
            return;
        }

        const observer = new IntersectionObserver(
            (entries, currentObserver) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    animateCounter(entry.target);
                    currentObserver.unobserve(entry.target);
                });
            },
            {
                threshold: 0.55
            }
        );

        counters.forEach((counter) => {
            observer.observe(counter);
        });
    }

    /* =====================================================
       AÑO ACTUAL
       ===================================================== */

    function initializeCurrentYear() {
        const yearElement = select("#current-year");

        if (!yearElement) {
            return;
        }

        yearElement.textContent = String(
            new Date().getFullYear()
        );
    }

    /* =====================================================
       REACCIÓN A CAMBIOS DE ACCESIBILIDAD
       ===================================================== */

    function initializeMotionPreference() {
        runMediaQueryListener(
            prefersReducedMotion,
            (event) => {
                if (!event.matches) {
                    return;
                }

                selectAll("[data-reveal]").forEach(
                    (element) => {
                        element.classList.add("is-visible");
                    }
                );

                selectAll("[data-tilt]").forEach(
                    (element) => {
                        element.style.setProperty(
                            "--tilt-x",
                            "0deg"
                        );

                        element.style.setProperty(
                            "--tilt-y",
                            "0deg"
                        );
                    }
                );
            }
        );
    }

    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    function initializeApplication() {
        initializeLoader();
        initializeTheme();
        initializeMobileMenu();
        initializeHeaderScroll();
        initializeActiveNavigation();
        initializeScrollReveals();
        initializeTiltCards();
        initializeMagneticButtons();
        initializePointerParallax();
        initializeCounters();
        initializeCurrentYear();
        initializeMotionPreference();
    }

    initializeApplication();
})();