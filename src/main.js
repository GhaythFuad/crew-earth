import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Renderer ───────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.82;
document.body.appendChild(renderer.domElement);

// ── Scene & Camera ─────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0.5, 4.2);

// ── Controls ───────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 1.3;
controls.maxDistance = 10;

const AXIAL_TILT_DEGREES = 23 + 27 / 60;
const AXIAL_TILT_RADIANS = THREE.MathUtils.degToRad(AXIAL_TILT_DEGREES);
const SIDEREAL_DAY_SECONDS = 23.9344696 * 3600;
const EARTH_ANGULAR_RATE = (Math.PI * 2) / SIDEREAL_DAY_SECONDS;
const CLOUD_RELATIVE_DRIFT = 0.018;
const DEFAULT_SCIENCE_START_UTC = '2026-04-21T20:00:00Z';
const queryParams = new URLSearchParams(window.location.search);
const baseCameraPosition = new THREE.Vector3();
const baseCameraTarget = new THREE.Vector3();
let framingStateInitialized = false;

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getUtcDayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((current - start) / 86400000);
}

function normalizeDegrees180(degrees) {
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

function wrapRadians(radians) {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

function readScienceStartDate() {
  const utcOverride = queryParams.get('utc');
  if (utcOverride) {
    const parsed = new Date(utcOverride);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date(DEFAULT_SCIENCE_START_UTC);
}

function computeSolarState(date) {
  const dayOfYear = getUtcDayOfYear(date);
  const hoursUtc =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3600000;
  const yearLength = isLeapYear(date.getUTCFullYear()) ? 366 : 365;
  const gamma = (Math.PI * 2 / yearLength) * (dayOfYear - 1 + (hoursUtc - 12) / 24);

  // NOAA's compact solar model gives us a stable declination/equation-of-time pair.
  const equationOfTime =
    229.18 * (
      0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma)
    );

  const solarDeclination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const utcMinutes = hoursUtc * 60;
  const subsolarLongitudeDegrees = normalizeDegrees180(180 - (utcMinutes + equationOfTime) / 4);

  return {
    equationOfTime,
    solarDeclination,
    subsolarLongitudeRadians: THREE.MathUtils.degToRad(subsolarLongitudeDegrees),
  };
}

const scienceStartDate = readScienceStartDate();
let scienceTimeMs = scienceStartDate.getTime();
let cloudLongitudeOffset = 0;
const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 0, 1),
  AXIAL_TILT_RADIANS,
);

let viewportMode = '';

function getViewportMode() {
  const isPortrait = window.innerHeight > window.innerWidth;
  if (window.innerWidth <= 640 && isPortrait) {
    return 'mobile-portrait';
  }
  if (window.innerWidth <= 820) {
    return 'compact';
  }
  return 'desktop';
}

function applyResponsiveViewport(force = false) {
  const nextMode = getViewportMode();

  if (force || nextMode !== viewportMode) {
    if (nextMode === 'mobile-portrait') {
      camera.fov = 50;
      baseCameraPosition.set(-1.18, 0.56, 4.92);
      controls.minDistance = 1.6;
      controls.maxDistance = 12;
      baseCameraTarget.set(0.02, 0.05, 0);
    } else if (nextMode === 'compact') {
      camera.fov = 47;
      baseCameraPosition.set(-1.36, 0.72, 4.34);
      controls.minDistance = 1.45;
      controls.maxDistance = 11;
      baseCameraTarget.set(0.02, 0.03, 0);
    } else {
      camera.fov = 45;
      baseCameraPosition.set(-1.55, 0.86, 3.98);
      controls.minDistance = 1.3;
      controls.maxDistance = 10;
      baseCameraTarget.set(0.03, 0.03, 0);
    }

    viewportMode = nextMode;
  }

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (framingStateInitialized) {
    updateCameraFraming();
  } else {
    camera.position.copy(baseCameraPosition);
    controls.target.copy(baseCameraTarget);
    camera.lookAt(baseCameraTarget);
  }
}

applyResponsiveViewport(true);

// ── Texture Loading (4K versions for performance) ──────────────────────
const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

manager.onLoad = () => {
  document.getElementById('loader')?.classList.add('hidden');
};

const dayMap = loader.load(assetUrl('textures/earth_4k.jpg'));
const nightMap = loader.load(assetUrl('textures/night_4k.jpg'));
const bumpMap = loader.load(assetUrl('textures/elev_bump_4k.jpg'));
const cloudsMap = loader.load(assetUrl('textures/fair_clouds_8k.jpg'));
const specularMap = loader.load(assetUrl('textures/2k_earth_specular_map.jpg'));

dayMap.colorSpace = THREE.SRGBColorSpace;
nightMap.colorSpace = THREE.SRGBColorSpace;

[dayMap, nightMap, bumpMap, cloudsMap, specularMap].forEach(t => {
  t.anisotropy = 16;
});

// ── Lighting ───────────────────────────────────────────────────────────
const sunDir = new THREE.Vector3(1, 0, 0);
const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
dirLight.position.copy(sunDir.clone().multiplyScalar(10));
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x060612, 0.03));

// ── Earth Group ────────────────────────────────────────────────────────
const earthTiltGroup = new THREE.Group();
earthTiltGroup.quaternion.copy(tiltQuaternion);
scene.add(earthTiltGroup);

const earthSpinGroup = new THREE.Group();
earthTiltGroup.add(earthSpinGroup);

// ── Earth Shader ───────────────────────────────────────────────────────
const earthUniforms = {
  dayMap: { value: dayMap },
  nightMap: { value: nightMap },
  bumpMap: { value: bumpMap },
  cloudMap: { value: cloudsMap },
  specularMap: { value: specularMap },
  sunDirection: { value: sunDir },
  // All controllable via UI
  saturation: { value: 0.60 },
  contrast: { value: 1.00 },
  brightness: { value: 1.18 },
  bumpStrength: { value: 0.16 },
  surfaceSoftness: { value: 0.50 },
  nightBrightness: { value: 0.18 },
  terminatorSoft: { value: 0.09 },
  specStrength: { value: 0.18 },
  specPower: { value: 80.0 },
  atmosScatter: { value: 0.65 },
  waterBrightness: { value: 1.08 },
  waterSaturate: { value: 0.80 },
  waterHue: { value: -1.0 },
  cloudOpacity: { value: 0.78 },
  cloudRotation: { value: 0.0 },
};

const earthMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 64),
  new THREE.ShaderMaterial({
    uniforms: earthUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D bumpMap;
      uniform sampler2D cloudMap;
      uniform sampler2D specularMap;
      uniform vec3 sunDirection;
      uniform float saturation;
      uniform float contrast;
      uniform float brightness;
      uniform float bumpStrength;
      uniform float surfaceSoftness;
      uniform float nightBrightness;
      uniform float terminatorSoft;
      uniform float specStrength;
      uniform float specPower;
      uniform float atmosScatter;
      uniform float waterBrightness;
      uniform float waterSaturate;
      uniform float waterHue;
      uniform float cloudOpacity;
      uniform float cloudRotation;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      vec3 rotateHue(vec3 color, float degrees) {
        float hRad = degrees * 3.14159265 / 180.0;
        float hCos = cos(hRad);
        float hSin = sin(hRad);
        mat3 hueMat = mat3(
          0.213 + 0.787*hCos - 0.213*hSin, 0.213 - 0.213*hCos + 0.143*hSin, 0.213 - 0.213*hCos - 0.787*hSin,
          0.715 - 0.715*hCos - 0.715*hSin, 0.715 + 0.285*hCos + 0.140*hSin, 0.715 - 0.715*hCos + 0.715*hSin,
          0.072 - 0.072*hCos + 0.928*hSin, 0.072 - 0.072*hCos - 0.283*hSin, 0.072 + 0.928*hCos + 0.072*hSin
        );
        return hueMat * color;
      }

      vec3 sampleDayMapSoft(vec2 uv) {
        vec2 dayTexelSize = vec2(1.0 / 4096.0, 1.0 / 2048.0);
        vec3 sharp = texture2D(dayMap, uv).rgb;
        float softness = max(surfaceSoftness, 0.0);

        if (softness < 0.001) {
          return sharp;
        }

        vec2 blurStep = dayTexelSize * (1.0 + softness * 10.0);
        vec3 blurred = sharp * 4.0;

        blurred += texture2D(dayMap, uv + vec2( blurStep.x, 0.0)).rgb;
        blurred += texture2D(dayMap, uv + vec2(-blurStep.x, 0.0)).rgb;
        blurred += texture2D(dayMap, uv + vec2(0.0,  blurStep.y)).rgb;
        blurred += texture2D(dayMap, uv + vec2(0.0, -blurStep.y)).rgb;

        blurred += texture2D(dayMap, uv + vec2( blurStep.x,  blurStep.y)).rgb * 0.75;
        blurred += texture2D(dayMap, uv + vec2( blurStep.x, -blurStep.y)).rgb * 0.75;
        blurred += texture2D(dayMap, uv + vec2(-blurStep.x,  blurStep.y)).rgb * 0.75;
        blurred += texture2D(dayMap, uv + vec2(-blurStep.x, -blurStep.y)).rgb * 0.75;

        blurred /= 11.0;

        float blurMix = 1.0 - exp(-softness * 1.5);
        return mix(sharp, blurred, blurMix);
      }

      float sampleCloudShadow(vec2 uv, vec3 worldNormal) {
        vec3 tangent = cross(vec3(0.0, 1.0, 0.0), worldNormal);
        if (length(tangent) < 0.001) {
          tangent = vec3(1.0, 0.0, 0.0);
        } else {
          tangent = normalize(tangent);
        }

        vec3 bitangent = normalize(cross(worldNormal, tangent));
        vec2 shadowDrift = vec2(
          -dot(sunDirection, tangent),
          dot(sunDirection, bitangent)
        ) * 0.0035 * (0.65 + 0.35 * abs(worldNormal.y));

        vec2 cloudUv = vec2(
          fract(uv.x - cloudRotation + shadowDrift.x),
          clamp(uv.y + shadowDrift.y, 0.001, 0.999)
        );

        float cloudAlpha = texture2D(cloudMap, cloudUv).r;
        return smoothstep(0.22, 0.72, cloudAlpha) * cloudOpacity;
      }

      vec3 gradeWater(vec3 color) {
        vec3 graded = color * waterBrightness;
        float waterLuma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
        graded = mix(vec3(waterLuma), graded, waterSaturate);
        return rotateHue(graded, waterHue);
      }

      void main() {
        // Bump mapping
        vec2 texelSize = vec2(1.0 / 4096.0, 1.0 / 2048.0);
        float hL = texture2D(bumpMap, vUv - vec2(texelSize.x, 0.0)).r;
        float hR = texture2D(bumpMap, vUv + vec2(texelSize.x, 0.0)).r;
        float hD = texture2D(bumpMap, vUv - vec2(0.0, texelSize.y)).r;
        float hU = texture2D(bumpMap, vUv + vec2(0.0, texelSize.y)).r;
        vec3 bumpN = vec3(hL - hR, hD - hU, 1.0);
        bumpN.xy *= bumpStrength;
        vec3 normal = normalize(vNormal + bumpN.x * normalize(dFdx(vPosition)) + bumpN.y * normalize(dFdy(vPosition)));

        // Sun in view space
        vec3 viewLightDir = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
        float NdotL = dot(normal, viewLightDir);

        // Day/night blend
        float dayFactor = smoothstep(-0.02, -0.02 + terminatorSoft, NdotL);

        // Raw texture color with contrast applied
        vec3 dayColor = sampleDayMapSoft(vUv);
        dayColor = (dayColor - 0.5) * contrast + 0.5;
        vec3 nightColor = texture2D(nightMap, vUv).rgb * nightBrightness;

        // Diffuse lighting
        float diffuse = max(NdotL, 0.0);
        vec3 worldNormal = normalize(vWorldNormal);
        vec3 worldViewDir = normalize(cameraPosition - vWorldPosition);
        float sunFacing = dot(worldNormal, sunDirection);
        float sunScatter = smoothstep(-0.12, 0.42, sunFacing);
        float litRim = smoothstep(0.02, 0.3, sunFacing);
        float horizon = pow(clamp(1.0 - max(dot(worldViewDir, worldNormal), 0.0), 0.0, 1.0), 5.8);
        float cloudShadow = sampleCloudShadow(vUv, worldNormal) * 0.38;
        float shadowFactor = 1.0 - cloudShadow * dayFactor * (0.25 + 0.75 * diffuse) * 0.42;
        vec3 litDay = dayColor * (0.09 + 0.91 * diffuse) * shadowFactor;

        // Blend
        vec3 color = mix(nightColor, litDay, dayFactor);

        float specMask = texture2D(specularMap, vUv).r;
        float oceanMask = smoothstep(0.08, 0.72, specMask);
        vec3 viewDir = normalize(-vPosition);
        float viewFacing = clamp(dot(normal, viewDir), 0.0, 1.0);
        float fresnel = pow(1.0 - viewFacing, 4.5);

        if (oceanMask > 0.001) {
          vec3 waterBase = gradeWater(dayColor * mix(0.62, 0.82, diffuse));
          vec3 reflectedSky = mix(vec3(0.28, 0.40, 0.60), vec3(0.82, 0.90, 1.0), sunScatter);
          vec3 waterColor = mix(waterBase, reflectedSky, fresnel * 0.38);
          waterColor *= shadowFactor * dayFactor;
          waterColor = mix(waterColor, reflectedSky, horizon * dayFactor * 0.18);
          color = mix(color, waterColor, oceanMask);
        }

        // Keep the sun glint narrow and secondary to the atmospheric rim.
        vec3 halfDir = normalize(viewLightDir + viewDir);
        float spec = pow(max(dot(normal, halfDir), 0.0), specPower * 2.2) * oceanMask * dayFactor;
        spec *= mix(0.06, 1.0, fresnel);
        spec *= mix(1.0, shadowFactor, 0.55);
        color += spec * vec3(1.0, 0.995, 0.98) * specStrength;

        // Space photos wash surface detail out near the limb; add cool aerial haze.
        float aerialHaze = horizon * dayFactor * smoothstep(-0.04, 0.42, sunFacing);
        vec3 hazeTint = mix(vec3(0.70, 0.80, 0.96), vec3(0.98, 0.99, 1.0), sunScatter);
        color = mix(color, hazeTint, aerialHaze * 0.12);

        // Keep the separator neutral: it should fall through grayscale shadow, not a tinted band.
        float separatorBand = smoothstep(-0.11 - terminatorSoft * 0.45, -0.008, NdotL);
        separatorBand *= 1.0 - smoothstep(0.012, 0.07 + terminatorSoft * 0.5, NdotL);
        color *= 1.0 - separatorBand * 0.09;

        // User-controlled saturation
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, saturation);

        // User-controlled brightness
        color *= brightness;

        // Keep atmospheric color on the lit rim instead of the day/night separator.
        vec3 skyScatter = mix(vec3(0.90, 0.95, 1.0), vec3(0.62, 0.80, 1.0), sunScatter);
        float scatter = horizon * atmosScatter * (0.05 + 0.24 * dayFactor) * litRim;
        scatter *= 0.35 + 0.65 * sunScatter;
        color += skyScatter * scatter;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
);
earthSpinGroup.add(earthMesh);

// ── Cloud Layer ────────────────────────────────────────────────────────
const cloudMat = new THREE.MeshPhongMaterial({
  color: 0xffffff,
  alphaMap: cloudsMap,
  transparent: true,
  opacity: 0.78,
  depthWrite: false,
});
const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.007, 64, 64), cloudMat);
earthSpinGroup.add(cloudMesh);

// ── Atmosphere ─────────────────────────────────────────────────────────
const atmosUniforms = {
  rimPower: { value: 3.7 },
  rimIntensity: { value: 1.42 },
  rayleighColor: { value: new THREE.Vector3(0.68, 0.82, 1.0) },
  mieColor: { value: new THREE.Vector3(0.98, 0.99, 1.0) },
  twilightColor: { value: new THREE.Vector3(0.80, 0.86, 0.95) },
  atmosOpacity: { value: 0.56 },
  sunDirection: { value: sunDir },
};

const atmosMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.013, 64, 64),
  new THREE.ShaderMaterial({
    uniforms: atmosUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float rimPower;
      uniform float rimIntensity;
      uniform vec3 rayleighColor;
      uniform vec3 mieColor;
      uniform vec3 twilightColor;
      uniform float atmosOpacity;
      uniform vec3 sunDirection;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldNormal;
      void main() {
        vec3 viewDir = normalize(-vPosition);
        float horizon = pow(clamp(1.0 - max(dot(viewDir, vNormal), 0.0), 0.0, 1.0), rimPower);
        float sunFacing = dot(vWorldNormal, sunDirection);
        float dayScatter = smoothstep(-0.12, 0.36, sunFacing);
        float twilightBand = smoothstep(-0.22, 0.04, sunFacing) * (1.0 - smoothstep(0.04, 0.18, sunFacing));
        float forwardScatter = pow(max(dot(viewDir, sunDirection) * 0.5 + 0.5, 0.0), 11.0);

        float rayleigh = pow(horizon, 1.12) * (0.18 + 0.82 * dayScatter);
        float mie = pow(horizon, 3.0) * forwardScatter * (0.05 + 0.95 * dayScatter);
        float twilight = pow(horizon, 2.1) * twilightBand;

        vec3 color =
          rayleighColor * rayleigh * rimIntensity +
          mieColor * mie * rimIntensity * 0.32 +
          twilightColor * twilight * rimIntensity * 0.03;

        float alpha =
          rayleigh * rimIntensity * 0.30 +
          mie * rimIntensity * 0.22 +
          twilight * rimIntensity * 0.02;

        gl_FragColor = vec4(color, alpha * atmosOpacity);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
earthSpinGroup.add(atmosMesh);

function updateScientificOrientation(date) {
  const solarState = computeSolarState(date);
  const localSunDirection = new THREE.Vector3(
    Math.cos(solarState.solarDeclination),
    Math.sin(solarState.solarDeclination),
    0,
  );
  const worldSunDirection = localSunDirection.applyQuaternion(earthTiltGroup.quaternion).normalize();

  sunDir.copy(worldSunDirection);
  dirLight.position.copy(worldSunDirection.clone().multiplyScalar(10));

  earthSpinGroup.rotation.y = solarState.subsolarLongitudeRadians + THREE.MathUtils.degToRad(state.earthYawOffset);
  cloudMesh.rotation.y = wrapRadians(earthSpinGroup.rotation.y + cloudLongitudeOffset);
  earthUniforms.cloudRotation.value = wrapRadians(cloudMesh.rotation.y - earthSpinGroup.rotation.y) / (Math.PI * 2);
}

// ── Star Field ─────────────────────────────────────────────────────────
// Two layers: dense tiny dots (background grain) + fewer brighter stars
const starCount = 15000;
const starPos = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);
for (let i = 0; i < starCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  // Spread across two depth bands for parallax
  const r = i < 10000
    ? 30 + Math.random() * 30   // closer, more parallax
    : 70 + Math.random() * 40;  // far background
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPos[i * 3 + 2] = r * Math.cos(phi);
  starSizes[i] = i < 10000
    ? 0.08 + Math.random() * 0.2  // tiny dots
    : 0.15 + Math.random() * 0.5; // brighter stars
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
const starMat = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute float size;
    uniform float time;
    varying float vBrightness;
    void main() {
      vBrightness = 0.5 + 0.5 * sin(time * 0.3 + position.x * 0.08 + position.y * 0.12);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (150.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: /* glsl */ `
    varying float vBrightness;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.05, d) * vBrightness;
      gl_FragColor = vec4(vec3(0.9, 0.92, 1.0), alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
});
scene.add(new THREE.Points(starGeo, starMat));

// ── UI Controls ────────────────────────────────────────────────────────
const state = {
  rotationSpeed: 0.0001,
  drift: 0.02,
  viewAzimuth: 0,
  viewElevation: 0,
  earthYawOffset: 0,
  earthTiltOffset: 0,
};

function updateCameraFraming() {
  const relative = baseCameraPosition.clone().sub(baseCameraTarget);
  const azimuthRadians = THREE.MathUtils.degToRad(state.viewAzimuth);
  const elevationRadians = THREE.MathUtils.degToRad(state.viewElevation);

  relative.applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuthRadians);

  const rightAxis = new THREE.Vector3().crossVectors(relative, new THREE.Vector3(0, 1, 0)).normalize();
  if (rightAxis.lengthSq() > 0.000001) {
    relative.applyAxisAngle(rightAxis, elevationRadians);
  }

  camera.position.copy(baseCameraTarget).add(relative);
  controls.target.copy(baseCameraTarget);
  camera.lookAt(baseCameraTarget);
}

function updateEarthTiltOrientation() {
  const tiltOffsetRadians = THREE.MathUtils.degToRad(state.earthTiltOffset);
  const tiltOffsetQuaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    tiltOffsetRadians,
  );
  earthTiltGroup.quaternion.copy(tiltQuaternion).multiply(tiltOffsetQuaternion);
}

function bindSlider(id, callback) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(id + '-val');
  const update = () => {
    const v = parseFloat(el.value);
    valEl.textContent = v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(2) : v.toFixed(2);
    callback(v);
  };
  el.addEventListener('input', update);
  update(); // set initial
}

bindSlider('saturation', v => earthUniforms.saturation.value = v);
bindSlider('contrast', v => earthUniforms.contrast.value = v);
bindSlider('brightness', v => earthUniforms.brightness.value = v);
bindSlider('exposure', v => renderer.toneMappingExposure = v);
bindSlider('atmosIntensity', v => atmosUniforms.rimIntensity.value = v);
bindSlider('atmosSize', v => {
  atmosMesh.geometry.dispose();
  atmosMesh.geometry = new THREE.SphereGeometry(v, 64, 64);
});
bindSlider('atmosScatter', v => earthUniforms.atmosScatter.value = v);
bindSlider('cloudOpacity', v => {
  cloudMat.opacity = v;
  earthUniforms.cloudOpacity.value = v;
});
bindSlider('waterBrightness', v => earthUniforms.waterBrightness.value = v);
bindSlider('waterSaturate', v => earthUniforms.waterSaturate.value = v);
bindSlider('waterHue', v => earthUniforms.waterHue.value = v);
bindSlider('specular', v => earthUniforms.specStrength.value = v);
bindSlider('nightLights', v => earthUniforms.nightBrightness.value = v);
bindSlider('terminator', v => earthUniforms.terminatorSoft.value = v);
bindSlider('bumpStrength', v => earthUniforms.bumpStrength.value = v);
bindSlider('surfaceSoftness', v => earthUniforms.surfaceSoftness.value = v);
bindSlider('viewAzimuth', v => {
  state.viewAzimuth = v;
  updateCameraFraming();
});
bindSlider('viewElevation', v => {
  state.viewElevation = v;
  updateCameraFraming();
});
bindSlider('earthYawOffset', v => {
  state.earthYawOffset = v;
  updateScientificOrientation(new Date(scienceTimeMs));
});
bindSlider('earthTiltOffset', v => {
  state.earthTiltOffset = v;
  updateEarthTiltOrientation();
  updateScientificOrientation(new Date(scienceTimeMs));
});
bindSlider('rotationSpeed', v => state.rotationSpeed = v);
bindSlider('drift', v => state.drift = v);

framingStateInitialized = true;
updateEarthTiltOrientation();
updateScientificOrientation(new Date(scienceTimeMs));
updateCameraFraming();

// Toggle controls panel
const panel = document.getElementById('controls');
const toggleBtn = document.getElementById('toggle-btn');
toggleBtn.addEventListener('click', () => {
  panel.classList.remove('collapsed');
  toggleBtn.classList.add('hidden');
});
// Close on clicking outside
renderer.domElement.addEventListener('click', (e) => {
  if (!panel.classList.contains('collapsed') && !panel.contains(e.target)) {
    panel.classList.add('collapsed');
    toggleBtn.classList.remove('hidden');
  }
});

// ── Resize ─────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  applyResponsiveViewport();
});

// ── Animation ──────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  const visualAngularVelocity = state.rotationSpeed * 60;
  const scienceTimeScale = visualAngularVelocity / EARTH_ANGULAR_RATE;

  scienceTimeMs += delta * scienceTimeScale * 1000;
  cloudLongitudeOffset = wrapRadians(cloudLongitudeOffset + visualAngularVelocity * CLOUD_RELATIVE_DRIFT * delta);
  updateScientificOrientation(new Date(scienceTimeMs));

  earthTiltGroup.position.x = Math.sin(elapsed * 0.08) * state.drift;
  earthTiltGroup.position.y = Math.cos(elapsed * 0.12) * state.drift * 0.7;

  starMat.uniforms.time.value = elapsed;

  controls.update();
  renderer.render(scene, camera);
}

animate();
