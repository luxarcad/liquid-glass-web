import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js";

/* =========================================================
   AETHER STUDIO
   Escena Liquid Glass con Three.js
   ========================================================= */

const canvas = document.querySelector("#webgl-canvas");
const heroVisual = document.querySelector("#hero-visual");
const modelAnchor = document.querySelector("#hero-model-anchor");
const root = document.documentElement;

if (canvas && heroVisual && modelAnchor) {
    initializeLiquidGlassScene();
}

/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

function initializeLiquidGlassScene() {
    const reducedMotionQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    const mobileQuery = window.matchMedia(
        "(max-width: 680px)"
    );

    const finePointerQuery = window.matchMedia(
        "(hover: hover) and (pointer: fine)"
    );

    const isMobile = mobileQuery.matches;
    const GLASS_RADIUS = 1.68;

    let renderer;

    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: !isMobile,
            powerPreference: "high-performance",
            premultipliedAlpha: true
        });
    } catch (error) {
        handleWebGLError(error);
        return;
    }

    /* =====================================================
       RENDERER
       ===================================================== */

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    renderer.shadowMap.enabled = false;

    /*
     * Reduce el coste de la transmisión en dispositivos
     * móviles sin perder demasiado detalle.
     */
    if ("transmissionResolutionScale" in renderer) {
        renderer.transmissionResolutionScale = isMobile
            ? 0.65
            : 0.9;
    }

    let currentPixelRatio = getTargetPixelRatio();

    renderer.setPixelRatio(currentPixelRatio);
    renderer.setSize(
        window.innerWidth,
        window.innerHeight,
        false
    );

    /* =====================================================
       ESCENA Y CÁMARA
       ===================================================== */

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        38,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );

    camera.position.set(0, 0, 8.5);

    const glassGroup = new THREE.Group();
    glassGroup.name = "LiquidGlassComposition";

    scene.add(glassGroup);

    const targetPosition = new THREE.Vector3();
    const pointerTarget = new THREE.Vector2();
    const pointerCurrent = new THREE.Vector2();

    let targetScale = 1;
    let layoutDirty = true;
    let firstLayout = true;
    let firstRender = true;
    let heroIsVisible = true;
    let documentIsVisible = !document.hidden;
    let animationFrame = null;
    let previousTime = performance.now();
    let elapsedTime = 0;
    let deformationFrame = 0;
    let sceneDisposed = false;

    /* =====================================================
       PALETAS DE ILUMINACIÓN
       ===================================================== */

    const palettes = {
        dark: {
            glass: "#d9e4ff",
            attenuation: "#806dff",
            core: "#7456f5",
            coreEmissive: "#d24fa7",
            particle: "#a9deff",
            ringPrimary: "#9e8cff",
            ringSecondary: "#43d8ed",
            lightPrimary: "#a994ff",
            lightSecondary: "#46dbf1",
            lightAccent: "#ff70bb",
            environmentTop: "#070816",
            environmentMiddle: "#29205d",
            environmentBottom: "#081a2d",
            environmentGlowOne: "#ac65ff",
            environmentGlowTwo: "#35d4ee",
            exposure: 1.18,
            environmentIntensity: 1.25
        },

        light: {
            glass: "#f2f8ff",
            attenuation: "#9d8cff",
            core: "#785cf0",
            coreEmissive: "#ef69ae",
            particle: "#5c83cf",
            ringPrimary: "#7561ec",
            ringSecondary: "#009fb9",
            lightPrimary: "#836df5",
            lightSecondary: "#21b8ce",
            lightAccent: "#e95ca5",
            environmentTop: "#e7efff",
            environmentMiddle: "#a99cff",
            environmentBottom: "#a5e5ee",
            environmentGlowOne: "#ffffff",
            environmentGlowTwo: "#84e9f4",
            exposure: 1.04,
            environmentIntensity: 0.9
        }
    };

    /* =====================================================
       ENTORNO DE REFLEXIÓN PROCEDURAL
       ===================================================== */

    const environmentCanvas = document.createElement("canvas");
    const environmentContext =
        environmentCanvas.getContext("2d");

    environmentCanvas.width = 512;
    environmentCanvas.height = 256;

    const environmentTexture = new THREE.CanvasTexture(
        environmentCanvas
    );

    environmentTexture.mapping =
        THREE.EquirectangularReflectionMapping;

    environmentTexture.colorSpace =
        THREE.SRGBColorSpace;

    environmentTexture.name =
        "ProceduralLiquidGlassEnvironment";

    scene.environment = environmentTexture;

    function paintEnvironment(palette) {
        if (!environmentContext) {
            return;
        }

        const width = environmentCanvas.width;
        const height = environmentCanvas.height;

        environmentContext.clearRect(
            0,
            0,
            width,
            height
        );

        const backgroundGradient =
            environmentContext.createLinearGradient(
                0,
                0,
                0,
                height
            );

        backgroundGradient.addColorStop(
            0,
            palette.environmentTop
        );

        backgroundGradient.addColorStop(
            0.48,
            palette.environmentMiddle
        );

        backgroundGradient.addColorStop(
            1,
            palette.environmentBottom
        );

        environmentContext.fillStyle =
            backgroundGradient;

        environmentContext.fillRect(
            0,
            0,
            width,
            height
        );

        drawEnvironmentGlow(
            width * 0.2,
            height * 0.3,
            width * 0.26,
            palette.environmentGlowOne,
            0.85
        );

        drawEnvironmentGlow(
            width * 0.78,
            height * 0.58,
            width * 0.31,
            palette.environmentGlowTwo,
            0.7
        );

        drawEnvironmentGlow(
            width * 0.55,
            height * 0.12,
            width * 0.16,
            "#ffffff",
            0.72
        );

        environmentTexture.needsUpdate = true;
    }

    function drawEnvironmentGlow(
        x,
        y,
        radius,
        color,
        opacity
    ) {
        const glow =
            environmentContext.createRadialGradient(
                x,
                y,
                0,
                x,
                y,
                radius
            );

        glow.addColorStop(
            0,
            hexToRgba(color, opacity)
        );

        glow.addColorStop(
            0.35,
            hexToRgba(color, opacity * 0.4)
        );

        glow.addColorStop(
            1,
            hexToRgba(color, 0)
        );

        environmentContext.fillStyle = glow;

        environmentContext.fillRect(
            x - radius,
            y - radius,
            radius * 2,
            radius * 2
        );
    }

    /* =====================================================
       GEOMETRÍA EXTERIOR DE VIDRIO
       ===================================================== */

    const widthSegments = isMobile ? 48 : 72;
    const heightSegments = isMobile ? 32 : 48;

    const glassGeometry = new THREE.SphereGeometry(
        GLASS_RADIUS,
        widthSegments,
        heightSegments
    );

    glassGeometry.name = "LiquidGlassGeometry";

    const glassPositions =
        glassGeometry.attributes.position;

    glassPositions.setUsage(
        THREE.DynamicDrawUsage
    );

    const originalGlassPositions =
        new Float32Array(glassPositions.array);

    const glassMaterial =
        new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#d9e4ff"),
            metalness: 0,
            roughness: 0.055,

            transmission: 0.97,
            thickness: 1.45,
            ior: 1.36,

            dispersion: isMobile ? 0.16 : 0.28,

            attenuationColor:
                new THREE.Color("#806dff"),

            attenuationDistance: 3.3,

            clearcoat: 1,
            clearcoatRoughness: 0.06,

            specularIntensity: 1,
            specularColor:
                new THREE.Color("#ffffff"),

            iridescence: isMobile ? 0.18 : 0.32,
            iridescenceIOR: 1.3,
            iridescenceThicknessRange: [
                100,
                420
            ],

            envMapIntensity: 1.45,
            side: THREE.FrontSide
        });

    glassMaterial.name = "LiquidGlassMaterial";

    const glassMesh = new THREE.Mesh(
        glassGeometry,
        glassMaterial
    );

    glassMesh.name = "LiquidGlassSurface";
    glassMesh.renderOrder = 4;

    glassGroup.add(glassMesh);

    /* =====================================================
       NÚCLEO INTERIOR
       ===================================================== */

    const coreGeometry =
        new THREE.IcosahedronGeometry(
            1.03,
            isMobile ? 3 : 4
        );

    const coreMaterial =
        new THREE.MeshStandardMaterial({
            color: new THREE.Color("#7456f5"),
            emissive: new THREE.Color("#d24fa7"),
            emissiveIntensity: 0.42,
            metalness: 0.12,
            roughness: 0.32
        });

    const coreMesh = new THREE.Mesh(
        coreGeometry,
        coreMaterial
    );

    coreMesh.name = "LiquidGlassCore";
    coreMesh.scale.set(1, 0.92, 1.04);

    glassGroup.add(coreMesh);

    /*
     * Segunda capa sutil para dar complejidad al núcleo.
     */
    const coreWireMaterial =
        new THREE.MeshBasicMaterial({
            color: new THREE.Color("#ffffff"),
            wireframe: true,
            transparent: true,
            opacity: 0.075,
            depthWrite: false
        });

    const coreWireMesh = new THREE.Mesh(
        coreGeometry,
        coreWireMaterial
    );

    coreWireMesh.name = "CoreWireLayer";
    coreWireMesh.scale.setScalar(1.025);

    glassGroup.add(coreWireMesh);

    /* =====================================================
       LUCES INTERNAS
       ===================================================== */

    const hemisphereLight =
        new THREE.HemisphereLight(
            0xcdd7ff,
            0x080a19,
            1.35
        );

    scene.add(hemisphereLight);

    const primaryLight = new THREE.PointLight(
        0xa994ff,
        isMobile ? 25 : 34,
        11,
        2
    );

    primaryLight.position.set(-2.7, 2.4, 3.6);

    const secondaryLight = new THREE.PointLight(
        0x46dbf1,
        isMobile ? 18 : 26,
        10,
        2
    );

    secondaryLight.position.set(2.9, -1.6, 2.7);

    const accentLight = new THREE.PointLight(
        0xff70bb,
        isMobile ? 15 : 22,
        9,
        2
    );

    accentLight.position.set(0.8, 2.8, -1.5);

    const internalLight = new THREE.PointLight(
        0xb98cff,
        isMobile ? 7 : 10,
        5,
        2
    );

    internalLight.position.set(0, 0, 0.4);

    glassGroup.add(
        primaryLight,
        secondaryLight,
        accentLight,
        internalLight
    );

    /* =====================================================
       ANILLOS ORBITALES
       ===================================================== */

    const orbitalGroup = new THREE.Group();
    orbitalGroup.name = "OrbitalRings";

    const firstRingMaterial =
        new THREE.MeshBasicMaterial({
            color: new THREE.Color("#9e8cff"),
            transparent: true,
            opacity: 0.32,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

    const secondRingMaterial =
        new THREE.MeshBasicMaterial({
            color: new THREE.Color("#43d8ed"),
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

    const firstRing = new THREE.Mesh(
        new THREE.TorusGeometry(
            2.18,
            0.012,
            8,
            isMobile ? 80 : 128
        ),
        firstRingMaterial
    );

    firstRing.rotation.set(
        Math.PI * 0.58,
        Math.PI * 0.08,
        Math.PI * 0.13
    );

    const secondRing = new THREE.Mesh(
        new THREE.TorusGeometry(
            2.42,
            0.008,
            8,
            isMobile ? 72 : 112
        ),
        secondRingMaterial
    );

    secondRing.rotation.set(
        Math.PI * 0.25,
        Math.PI * 0.58,
        Math.PI * 0.2
    );

    orbitalGroup.add(firstRing, secondRing);
    glassGroup.add(orbitalGroup);

    /* =====================================================
       BURBUJAS DE VIDRIO
       ===================================================== */

    const bubbleGroup = new THREE.Group();
    bubbleGroup.name = "GlassBubbles";

    const bubbleGeometry =
        new THREE.SphereGeometry(
            0.13,
            isMobile ? 16 : 24,
            isMobile ? 10 : 16
        );

    const bubbleMaterial =
        new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#e3ecff"),
            metalness: 0,
            roughness: 0.04,
            transmission: 0.92,
            thickness: 0.25,
            ior: 1.32,
            dispersion: isMobile ? 0.05 : 0.14,
            clearcoat: 1,
            clearcoatRoughness: 0.04,
            envMapIntensity: 1.25
        });

    const bubbleCount = isMobile ? 4 : 7;
    const bubbles = [];

    for (
        let index = 0;
        index < bubbleCount;
        index += 1
    ) {
        const bubble = new THREE.Mesh(
            bubbleGeometry,
            bubbleMaterial
        );

        const angle =
            (index / bubbleCount) *
            Math.PI *
            2;

        const radius =
            2.15 + (index % 2) * 0.34;

        bubble.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle * 1.25) * 1.65,
            Math.sin(angle) * 0.9
        );

        const bubbleScale =
            0.55 + Math.random() * 0.75;

        bubble.scale.setScalar(bubbleScale);
        bubble.userData.angle = angle;
        bubble.userData.radius = radius;
        bubble.userData.speed =
            0.12 + Math.random() * 0.08;
        bubble.userData.offset =
            Math.random() * Math.PI * 2;

        bubbles.push(bubble);
        bubbleGroup.add(bubble);
    }

    glassGroup.add(bubbleGroup);

    /* =====================================================
       PARTÍCULAS
       ===================================================== */

    const particleCount = isMobile ? 45 : 95;

    const particlePositions =
        new Float32Array(particleCount * 3);

    for (
        let index = 0;
        index < particleCount;
        index += 1
    ) {
        const positionIndex = index * 3;

        const radius =
            2.6 + Math.random() * 2.3;

        const theta =
            Math.random() * Math.PI * 2;

        const phi =
            Math.acos(2 * Math.random() - 1);

        particlePositions[positionIndex] =
            radius *
            Math.sin(phi) *
            Math.cos(theta);

        particlePositions[positionIndex + 1] =
            radius *
            Math.sin(phi) *
            Math.sin(theta);

        particlePositions[positionIndex + 2] =
            radius * Math.cos(phi);
    }

    const particleGeometry =
        new THREE.BufferGeometry();

    particleGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            particlePositions,
            3
        )
    );

    const particleMaterial =
        new THREE.PointsMaterial({
            color: new THREE.Color("#a9deff"),
            size: isMobile ? 0.025 : 0.032,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.68,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

    const particles = new THREE.Points(
        particleGeometry,
        particleMaterial
    );

    particles.name = "AtmosphericParticles";

    glassGroup.add(particles);

    /* =====================================================
       CAMBIO DE TEMA
       ===================================================== */

    function applySceneTheme(themeName) {
        const palette =
            palettes[themeName] ?? palettes.dark;

        glassMaterial.color.set(palette.glass);

        glassMaterial.attenuationColor.set(
            palette.attenuation
        );

        coreMaterial.color.set(palette.core);

        coreMaterial.emissive.set(
            palette.coreEmissive
        );

        particleMaterial.color.set(
            palette.particle
        );

        firstRingMaterial.color.set(
            palette.ringPrimary
        );

        secondRingMaterial.color.set(
            palette.ringSecondary
        );

        bubbleMaterial.color.set(
            palette.glass
        );

        primaryLight.color.set(
            palette.lightPrimary
        );

        secondaryLight.color.set(
            palette.lightSecondary
        );

        accentLight.color.set(
            palette.lightAccent
        );

        internalLight.color.set(
            palette.coreEmissive
        );

        renderer.toneMappingExposure =
            palette.exposure;

        glassMaterial.envMapIntensity =
            palette.environmentIntensity;

        bubbleMaterial.envMapIntensity =
            palette.environmentIntensity;

        if ("environmentIntensity" in scene) {
            scene.environmentIntensity =
                palette.environmentIntensity;
        }

        paintEnvironment(palette);

        glassMaterial.needsUpdate = true;
        bubbleMaterial.needsUpdate = true;

        requestSceneRender();
    }

    const initialTheme =
        root.dataset.theme === "light"
            ? "light"
            : "dark";

    applySceneTheme(initialTheme);

    window.addEventListener(
        "aether:themechange",
        (event) => {
            applySceneTheme(
                event.detail?.theme ?? "dark"
            );
        }
    );

    /* =====================================================
       POSICIONAMIENTO RESPONSIVE
       ===================================================== */

    function updateGroupAlignment(immediate = false) {
        const anchorBounds =
            modelAnchor.getBoundingClientRect();

        if (
            anchorBounds.width <= 0 ||
            anchorBounds.height <= 0
        ) {
            return;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const anchorCenterX =
            anchorBounds.left +
            anchorBounds.width / 2;

        const anchorCenterY =
            anchorBounds.top +
            anchorBounds.height / 2;

        const cameraDistance =
            camera.position.z;

        const verticalFieldOfView =
            THREE.MathUtils.degToRad(
                camera.fov
            );

        const visibleWorldHeight =
            2 *
            Math.tan(verticalFieldOfView / 2) *
            cameraDistance;

        const worldUnitsPerPixel =
            visibleWorldHeight /
            viewportHeight;

        const offsetX =
            anchorCenterX -
            viewportWidth / 2;

        const offsetY =
            anchorCenterY -
            viewportHeight / 2;

        targetPosition.set(
            offsetX * worldUnitsPerPixel,
            -offsetY * worldUnitsPerPixel,
            0
        );

        const desiredDiameterInPixels =
            anchorBounds.width * 0.88;

        const desiredDiameterInWorld =
            desiredDiameterInPixels *
            worldUnitsPerPixel;

        targetScale =
            desiredDiameterInWorld /
            (GLASS_RADIUS * 2);

        targetScale = THREE.MathUtils.clamp(
            targetScale,
            0.45,
            1.35
        );

        if (immediate || firstLayout) {
            glassGroup.position.copy(
                targetPosition
            );

            glassGroup.scale.setScalar(
                targetScale
            );

            firstLayout = false;
        }

        layoutDirty = false;
    }

    function interpolateGroupAlignment() {
        glassGroup.position.lerp(
            targetPosition,
            0.11
        );

        const nextScale =
            THREE.MathUtils.lerp(
                glassGroup.scale.x,
                targetScale,
                0.1
            );

        glassGroup.scale.setScalar(nextScale);
    }

    /* =====================================================
       DEFORMACIÓN LÍQUIDA
       ===================================================== */

    function updateLiquidSurface(time) {
        if (reducedMotionQuery.matches) {
            return;
        }

        const positions =
            glassGeometry.attributes.position;

        const positionArray = positions.array;

        for (
            let index = 0;
            index < positionArray.length;
            index += 3
        ) {
            const originalX =
                originalGlassPositions[index];

            const originalY =
                originalGlassPositions[index + 1];

            const originalZ =
                originalGlassPositions[index + 2];

            const length = Math.sqrt(
                originalX * originalX +
                originalY * originalY +
                originalZ * originalZ
            );

            const normalizedX =
                originalX / length;

            const normalizedY =
                originalY / length;

            const normalizedZ =
                originalZ / length;

            const firstWave =
                Math.sin(
                    normalizedX * 4.4 +
                    time * 0.72
                ) *
                Math.sin(
                    normalizedY * 3.7 -
                    time * 0.54
                );

            const secondWave =
                Math.sin(
                    (normalizedX + normalizedZ) *
                    5.2 -
                    time * 0.38
                ) *
                Math.cos(
                    normalizedY * 4.8 +
                    time * 0.46
                );

            const thirdWave =
                Math.sin(
                    normalizedZ * 6.3 +
                    normalizedX * 2.2 +
                    time * 0.3
                );

            const displacement =
                1 +
                firstWave * 0.033 +
                secondWave * 0.019 +
                thirdWave * 0.011;

            positionArray[index] =
                originalX * displacement;

            positionArray[index + 1] =
                originalY * displacement;

            positionArray[index + 2] =
                originalZ * displacement;
        }

        positions.needsUpdate = true;

        /*
         * Actualizar normales cada dos fotogramas reduce
         * bastante el consumo sin afectar visualmente.
         */
        deformationFrame += 1;

        if (deformationFrame % 2 === 0) {
            glassGeometry.computeVertexNormals();
        }
    }

    /* =====================================================
       MOVIMIENTO DE BURBUJAS
       ===================================================== */

    function updateBubbles(time) {
        bubbles.forEach((bubble, index) => {
            const bubbleTime =
                time * bubble.userData.speed +
                bubble.userData.offset;

            const angle =
                bubble.userData.angle +
                bubbleTime;

            const radius =
                bubble.userData.radius;

            bubble.position.x =
                Math.cos(angle) * radius;

            bubble.position.y =
                Math.sin(
                    angle * 1.25 +
                    index * 0.4
                ) *
                1.65;

            bubble.position.z =
                Math.sin(angle) * 0.95;
        });
    }

    /* =====================================================
       PUNTERO Y PROFUNDIDAD
       ===================================================== */

    function handlePointerMove(event) {
        if (
            reducedMotionQuery.matches ||
            !finePointerQuery.matches
        ) {
            return;
        }

        pointerTarget.x =
            (event.clientX / window.innerWidth) *
                2 -
            1;

        pointerTarget.y =
            -(
                (event.clientY /
                    window.innerHeight) *
                    2 -
                1
            );
    }

    function resetPointer() {
        pointerTarget.set(0, 0);
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
        resetPointer,
        {
            passive: true
        }
    );

    /* =====================================================
       RESIZE Y SCROLL
       ===================================================== */

    function getTargetPixelRatio() {
        const maximumPixelRatio =
            mobileQuery.matches ? 1.45 : 2;

        return Math.min(
            window.devicePixelRatio || 1,
            maximumPixelRatio
        );
    }

    function handleResize() {
        if (sceneDisposed) {
            return;
        }

        const width = window.innerWidth;
        const height = window.innerHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        currentPixelRatio =
            getTargetPixelRatio();

        renderer.setPixelRatio(
            currentPixelRatio
        );

        renderer.setSize(
            width,
            height,
            false
        );

        layoutDirty = true;
        requestSceneRender();
    }

    function handleScroll() {
        layoutDirty = true;
        requestSceneRender();
    }

    window.addEventListener(
        "resize",
        handleResize,
        {
            passive: true
        }
    );

    window.addEventListener(
        "scroll",
        handleScroll,
        {
            passive: true
        }
    );

    /*
     * Detecta cambios ocasionados por responsive, fuentes
     * o modificaciones en el layout.
     */
    const anchorResizeObserver =
        "ResizeObserver" in window
            ? new ResizeObserver(() => {
                layoutDirty = true;
                requestSceneRender();
            })
            : null;

    anchorResizeObserver?.observe(modelAnchor);

    /* =====================================================
       VISIBILIDAD DEL HERO
       ===================================================== */

    const heroObserver =
        "IntersectionObserver" in window
            ? new IntersectionObserver(
                (entries) => {
                    const entry = entries[0];

                    heroIsVisible =
                        Boolean(entry?.isIntersecting);

                    glassGroup.visible =
                        heroIsVisible;

                    if (heroIsVisible) {
                        layoutDirty = true;
                        requestSceneRender();
                    } else {
                        stopAnimation();
                        renderer.render(scene, camera);
                    }
                },
                {
                    root: null,
                    rootMargin: "180px 0px",
                    threshold: 0
                }
            )
            : null;

    heroObserver?.observe(heroVisual);

    document.addEventListener(
        "visibilitychange",
        () => {
            documentIsVisible =
                !document.hidden;

            if (documentIsVisible) {
                previousTime =
                    performance.now();

                layoutDirty = true;
                requestSceneRender();
            } else {
                stopAnimation();
            }
        }
    );

    /* =====================================================
       BUCLE DE ANIMACIÓN
       ===================================================== */

    function updateScene(time, deltaTime) {
        if (layoutDirty) {
            updateGroupAlignment();
        }

        interpolateGroupAlignment();

        pointerCurrent.lerp(
            pointerTarget,
            0.055
        );

        if (!reducedMotionQuery.matches) {
            updateLiquidSurface(time);
            updateBubbles(time);

            glassGroup.rotation.x =
                Math.sin(time * 0.24) *
                    0.055 +
                pointerCurrent.y * 0.11;

            glassGroup.rotation.y =
                time * 0.075 +
                pointerCurrent.x * 0.16;

            glassGroup.rotation.z =
                Math.sin(time * 0.16) *
                0.035;

            coreMesh.rotation.x +=
                deltaTime * 0.16;

            coreMesh.rotation.y -=
                deltaTime * 0.22;

            coreWireMesh.rotation.x -=
                deltaTime * 0.09;

            coreWireMesh.rotation.y +=
                deltaTime * 0.13;

            const corePulse =
                1 +
                Math.sin(time * 1.25) *
                    0.025;

            coreMesh.scale.set(
                corePulse,
                corePulse * 0.92,
                corePulse * 1.04
            );

            coreWireMesh.scale.setScalar(
                1.025 +
                Math.sin(time * 0.9) *
                    0.012
            );

            orbitalGroup.rotation.y +=
                deltaTime * 0.075;

            orbitalGroup.rotation.z -=
                deltaTime * 0.045;

            bubbleGroup.rotation.z =
                Math.sin(time * 0.16) * 0.08;

            particles.rotation.y +=
                deltaTime * 0.018;

            particles.rotation.x =
                Math.sin(time * 0.1) *
                0.035;

            primaryLight.position.x =
                -2.7 +
                Math.sin(time * 0.55) *
                    0.45;

            secondaryLight.position.y =
                -1.6 +
                Math.cos(time * 0.48) *
                    0.4;

            accentLight.position.z =
                -1.5 +
                Math.sin(time * 0.37) *
                    0.5;
        }
    }

    function animate(currentTime) {
        animationFrame = null;

        if (
            sceneDisposed ||
            !documentIsVisible ||
            !heroIsVisible
        ) {
            return;
        }

        const deltaTime = Math.min(
            (currentTime - previousTime) / 1000,
            0.05
        );

        previousTime = currentTime;
        elapsedTime += deltaTime;

        updateScene(
            elapsedTime,
            deltaTime
        );

        renderer.render(scene, camera);

        if (firstRender) {
            firstRender = false;
            root.classList.add("webgl-ready");
        }

        /*
         * Con movimiento reducido renderizamos solo cuando
         * ocurre un cambio real.
         */
        if (!reducedMotionQuery.matches) {
            animationFrame =
                requestAnimationFrame(animate);
        }
    }

    function requestSceneRender() {
        if (
            sceneDisposed ||
            animationFrame !== null ||
            !documentIsVisible ||
            !heroIsVisible
        ) {
            return;
        }

        previousTime = performance.now();

        animationFrame =
            requestAnimationFrame(animate);
    }

    function stopAnimation() {
        if (animationFrame === null) {
            return;
        }

        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    /* =====================================================
       CONTEXTO WEBGL
       ===================================================== */

    canvas.addEventListener(
        "webglcontextlost",
        (event) => {
            event.preventDefault();

            stopAnimation();

            root.classList.remove(
                "webgl-ready"
            );

            root.classList.add(
                "webgl-context-lost"
            );
        }
    );

    canvas.addEventListener(
        "webglcontextrestored",
        () => {
            root.classList.remove(
                "webgl-context-lost"
            );

            layoutDirty = true;
            firstRender = true;

            requestSceneRender();
        }
    );

    /* =====================================================
       CAMBIO DE PREFERENCIA DE MOVIMIENTO
       ===================================================== */

    registerMediaQueryChange(
        reducedMotionQuery,
        () => {
            pointerTarget.set(0, 0);
            pointerCurrent.set(0, 0);

            layoutDirty = true;
            requestSceneRender();
        }
    );

    /* =====================================================
       LIMPIEZA DE MEMORIA
       ===================================================== */

    function disposeScene() {
        if (sceneDisposed) {
            return;
        }

        sceneDisposed = true;

        stopAnimation();
        heroObserver?.disconnect();
        anchorResizeObserver?.disconnect();

        scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }

            if (Array.isArray(object.material)) {
                object.material.forEach(
                    (material) => {
                        material.dispose();
                    }
                );
            } else if (object.material) {
                object.material.dispose();
            }
        });

        environmentTexture.dispose();
        renderer.dispose();

        root.classList.remove("webgl-ready");
    }

    window.addEventListener(
        "pagehide",
        (event) => {
            /*
             * Conservamos la escena cuando el navegador utiliza
             * el caché de navegación hacia atrás.
             */
            if (!event.persisted) {
                disposeScene();
            }
        }
    );

    /* =====================================================
       PRIMER RENDER
       ===================================================== */

    updateGroupAlignment(true);
    requestSceneRender();
}

/* =========================================================
   UTILIDADES
   ========================================================= */

function hexToRgba(hexColor, opacity = 1) {
    const normalizedHex = hexColor
        .replace("#", "")
        .trim();

    const completeHex =
        normalizedHex.length === 3
            ? normalizedHex
                .split("")
                .map((character) => {
                    return character + character;
                })
                .join("")
            : normalizedHex;

    const numericColor = Number.parseInt(
        completeHex,
        16
    );

    const red =
        (numericColor >> 16) & 255;

    const green =
        (numericColor >> 8) & 255;

    const blue =
        numericColor & 255;

    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function registerMediaQueryChange(
    mediaQuery,
    callback
) {
    if (
        typeof mediaQuery.addEventListener ===
        "function"
    ) {
        mediaQuery.addEventListener(
            "change",
            callback
        );

        return;
    }

    /*
     * Alternativa para versiones anteriores de Safari.
     */
    if (
        typeof mediaQuery.addListener ===
        "function"
    ) {
        mediaQuery.addListener(callback);
    }
}

function handleWebGLError(error) {
    console.warn(
        "No fue posible iniciar la escena WebGL. Se conservará la alternativa CSS.",
        error
    );

    document.documentElement.classList.add(
        "webgl-unavailable"
    );
}