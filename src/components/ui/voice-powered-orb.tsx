"use client";

import React, { useEffect, useRef, type FC } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import { cn } from "@/lib/utils";

interface VoicePoweredOrbProps {
  className?: string;
  hue?: number;
  enableVoiceControl?: boolean;
  voiceSensitivity?: number;
  maxRotationSpeed?: number;
  maxHoverIntensity?: number;
  onVoiceDetected?: (detected: boolean) => void;
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
  audioVolume?: number;
}

export const VoicePoweredOrb: FC<VoicePoweredOrbProps> = ({
  className,
  hue = 0,
  voiceSensitivity = 2.5,
  maxRotationSpeed = 1.2,
  maxHoverIntensity = 0.8,
  state = 'idle',
  audioVolume = 0,
}) => {
  const stateRef = useRef(state);
  const audioVolumeRef = useRef(audioVolume);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    audioVolumeRef.current = audioVolume;
  }, [audioVolume]);

  const ctnDom = useRef<HTMLDivElement>(null);

  const vert = /* glsl */ `
    precision highp float;
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const frag = /* glsl */ `
    precision highp float;

    uniform float iTime;
    uniform vec3 iResolution;
    uniform float hue;
    uniform float hover;
    uniform float rot;
    uniform float hoverIntensity;
    varying vec2 vUv;

    vec3 rgb2yiq(vec3 c) {
      float y = dot(c, vec3(0.299, 0.587, 0.114));
      float i = dot(c, vec3(0.596, -0.274, -0.322));
      float q = dot(c, vec3(0.211, -0.523, 0.312));
      return vec3(y, i, q);
    }

    vec3 yiq2rgb(vec3 c) {
      float r = c.x + 0.956 * c.y + 0.621 * c.z;
      float g = c.x - 0.272 * c.y - 0.647 * c.z;
      float b = c.x - 1.106 * c.y + 1.703 * c.z;
      return vec3(r, g, b);
    }

    vec3 adjustHue(vec3 color, float hueDeg) {
      float hueRad = hueDeg * 3.14159265 / 180.0;
      vec3 yiq = rgb2yiq(color);
      float cosA = cos(hueRad);
      float sinA = sin(hueRad);
      float i = yiq.y * cosA - yiq.z * sinA;
      float q = yiq.y * sinA + yiq.z * cosA;
      yiq.y = i;
      yiq.z = q;
      return yiq2rgb(yiq);
    }

    vec3 hash33(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yxz + 19.19);
      return -1.0 + 2.0 * fract(vec3(
        p3.x + p3.y,
        p3.x + p3.z,
        p3.y + p3.z
      ) * p3.zyx);
    }

    float snoise3(vec3 p) {
      const float K1 = 0.333333333;
      const float K2 = 0.166666667;
      vec3 i = floor(p + (p.x + p.y + p.z) * K1);
      vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
      vec3 e = step(vec3(0.0), d0 - d0.yzx);
      vec3 i1 = e * (1.0 - e.zxy);
      vec3 i2 = 1.0 - e.zxy * (1.0 - e);
      vec3 d1 = d0 - (i1 - K2);
      vec3 d2 = d0 - (i2 - K1);
      vec3 d3 = d0 - 0.5;
      vec4 h = max(0.6 - vec4(
        dot(d0, d0),
        dot(d1, d1),
        dot(d2, d2),
        dot(d3, d3)
      ), 0.0);
      vec4 n = h * h * h * h * vec4(
        dot(d0, hash33(i)),
        dot(d1, hash33(i + i1)),
        dot(d2, hash33(i + i2)),
        dot(d3, hash33(i + 1.0))
      );
      return dot(vec4(31.316), n);
    }

    vec4 extractAlpha(vec3 colorIn) {
      float a = max(max(colorIn.r, colorIn.g), colorIn.b);
      return vec4(colorIn.rgb / (a + 1e-5), a);
    }

    // Original purple/blue/cyan base colors matching the reference image
    const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
    const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
    const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
    const float innerRadius = 0.62;
    const float noiseScale = 0.65;

    float light1(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * attenuation);
    }

    float light2(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * dist * attenuation);
    }

    vec4 draw(vec2 uv) {
      vec3 color1 = adjustHue(baseColor1, hue);
      vec3 color2 = adjustHue(baseColor2, hue);
      vec3 color3 = adjustHue(baseColor3, hue);

      float ang = atan(uv.y, uv.x);
      float len = length(uv);
      float invLen = len > 0.0 ? 1.0 / len : 0.0;

      float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
      float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
      float d0 = distance(uv, (r0 * invLen) * uv);
      float v0 = light1(1.0, 10.0, d0);
      v0 *= smoothstep(r0 * 1.05, r0, len);
      float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

      float a = iTime * -1.0;
      vec2 pos = vec2(cos(a), sin(a)) * r0;
      float d = distance(uv, pos);
      float v1 = light2(1.5, 5.0, d);
      v1 *= light1(1.0, 50.0, d0);

      float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
      float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

      vec3 col = mix(color1, color2, cl);
      col = mix(color3, col, v0);
      col = (col + v1) * v2 * v3;
      col = clamp(col, 0.0, 1.0);

      return extractAlpha(col);
    }

    vec4 mainImage(vec2 fragCoord) {
      vec2 center = iResolution.xy * 0.5;
      float size = min(iResolution.x, iResolution.y);
      vec2 uv = (fragCoord - center) / size * 2.0;

      float angle = rot;
      float s = sin(angle);
      float c = cos(angle);
      uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

      uv.x += hover * hoverIntensity * 0.15 * sin(uv.y * 10.0 + iTime);
      uv.y += hover * hoverIntensity * 0.15 * sin(uv.x * 10.0 + iTime);

      return draw(uv);
    }

    void main() {
      vec2 fragCoord = vUv * iResolution.xy;
      vec4 col = mainImage(fragCoord);
      gl_FragColor = vec4(col.rgb * col.a, col.a);
    }
  `;

  useEffect(() => {
    if (!ctnDom.current) return;

    // Create OGL context
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    // Style the WebGL canvas to cover 100% of container and stay position absolute
    gl.canvas.style.position = 'absolute';
    gl.canvas.style.inset = '0';
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.zIndex = '2';
    gl.canvas.style.pointerEvents = 'none';

    const container = ctnDom.current;
    container.appendChild(gl.canvas);

    // Geometry & Mesh
    const geometry = new Triangle(gl);

    // Shader program
    let program: Program;
    try {
      program = new Program(gl, {
        vertex: vert,
        fragment: frag,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: [0, 0, 0] },
          hue: { value: hue },
          hover: { value: 0 },
          rot: { value: 0 },
          hoverIntensity: { value: maxHoverIntensity },
        },
        transparent: true,
      });
    } catch (e) {
      console.error('[VoicePoweredOrb] WebGL program compilation failed:', e);
      return;
    }

    const mesh = new Mesh(gl, { geometry, program });

    let rafId: number;
    let lastTime = 0;
    let currentRot = 0;
    const baseRotationSpeed = 0.3;

    const resize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width > 0 && height > 0) {
        renderer.setSize(width, height);
        program.uniforms.iResolution.value = [width, height, 0];
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          renderer.setSize(width, height);
          program.uniforms.iResolution.value = [width, height, 0];
        }
      }
    });

    window.addEventListener('resize', resize, false);
    resizeObserver.observe(container);
    resize();

    const update = (t: number) => {
      rafId = requestAnimationFrame(update);
      if (!program) return;

      const dt = (t - lastTime) * 0.001;
      lastTime = t;
      const timeSec = t * 0.001;
      program.uniforms.iTime.value = timeSec;

      const currentState = stateRef.current || 'idle';
      const currentAudioVolume = audioVolumeRef.current || 0;

      // Update uniforms based on current state
      if (currentState === 'idle') {
        const breathing = Math.sin(timeSec * 2.0) * 0.5 + 0.5;
        program.uniforms.hover.value = 0.15 + breathing * 0.08;
        program.uniforms.hoverIntensity.value = maxHoverIntensity * 0.25;
        currentRot += dt * baseRotationSpeed * 0.6;
      } else if (currentState === 'thinking') {
        const glow = Math.sin(timeSec * 4.0) * 0.5 + 0.5;
        program.uniforms.hover.value = 0.35 + glow * 0.15;
        program.uniforms.hoverIntensity.value = maxHoverIntensity * 0.6;
        currentRot += dt * baseRotationSpeed * 1.5;
      } else if (currentState === 'speaking') {
        const level = Math.min(currentAudioVolume * voiceSensitivity * 2.0, 1.0);
        program.uniforms.hover.value = level;
        program.uniforms.hoverIntensity.value = Math.min(level * maxHoverIntensity, maxHoverIntensity);
        currentRot += dt * (baseRotationSpeed + level * maxRotationSpeed);
      } else if (currentState === 'listening') {
        const level = Math.min(currentAudioVolume * voiceSensitivity * 2.0, 1.0);
        program.uniforms.hover.value = level;
        program.uniforms.hoverIntensity.value = Math.min(level * maxHoverIntensity, maxHoverIntensity);
        currentRot += dt * (baseRotationSpeed + level * maxRotationSpeed);
      }

      program.uniforms.rot.value = currentRot;

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      renderer.render({ scene: mesh });
    };

    rafId = requestAnimationFrame(update);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
      if (container && gl.canvas.parentNode === container) {
        container.removeChild(gl.canvas);
      }
    };
  }, [hue, maxHoverIntensity, maxRotationSpeed, voiceSensitivity]);

  const vol = Math.min(Math.max(audioVolume, 0), 1);

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center select-none pointer-events-none transition-all duration-300",
        "w-full h-full",
        className
      )}
      style={{ position: 'relative', overflow: 'visible' }}
    >
      {/* Keyframe Styles for SVG orbiting particles and breathing */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin-particles {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes breathing-back {
          0% { transform: scale(0.98); opacity: 0.08; }
          50% { transform: scale(1.02); opacity: 0.14; }
          100% { transform: scale(0.98); opacity: 0.08; }
        }
      `}} />

      {/* BACKGROUND EFFECT: Soft radial gold gradient (under 15% opacity) */}
      <div 
        style={{
          position: "absolute",
          inset: "-45px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212, 175, 55, 0.12) 0%, rgba(255, 255, 255, 0) 70%)",
          zIndex: 0,
          animation: state === 'idle' ? 'breathing-back 4s ease-in-out infinite' : 'none',
        }}
      />

      {/* LAYER 1: Solid Dark Charcoal (#1B1B1B) Center sphere with radial gradient and shadows */}
      <div
        style={{
          position: "absolute",
          width: "74%",
          height: "74%",
          borderRadius: "50%",
          background: "radial-gradient(circle at center, #2A2A2A 0%, #111111 100%)",
          boxShadow: `
            0 25px 80px rgba(0, 0, 0, 0.18),
            inset 0 4px 15px rgba(255, 255, 255, 0.08),
            inset 0 -4px 15px rgba(0, 0, 0, 0.6)
          `,
          zIndex: 1,
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      />

      {/* LAYER 2: WebGL OGL Canvas Container (covers 100% height/width) */}
      <div
        ref={ctnDom}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
        }}
      />

      {/* LAYER 3: Inner contents (Logo & Text) centered perfectly inside the orb */}
      <div
        style={{
          position: "absolute",
          width: "74%",
          height: "74%",
          borderRadius: "50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 3,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <span 
          className="legatrixon-logo-circle" 
          style={{ 
            width: '60px', 
            height: '60px',
            borderWidth: '2px',
            borderColor: 'var(--gold, #D4AF37)',
            transform: state === 'speaking' || state === 'listening' ? `scale(${1 + audioVolume * 0.15})` : 'scale(1)',
            transition: 'transform 0.1s ease-out',
            flexShrink: 0,
          }} 
        />
        <div style={{
          fontSize: '0.85rem',
          fontWeight: '800',
          color: '#D4AF37',
          marginTop: '8px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: 'Sora, sans-serif',
        }}>
          LEGATRIXON
        </div>
        <div style={{
          fontSize: '0.6rem',
          color: '#F4E4B2',
          marginTop: '2px',
          opacity: 0.9,
          fontWeight: '500',
          letterSpacing: '0.04em',
        }}>
          Your AI Legal Companion
        </div>
      </div>

      {/* LAYER 4: SVG Orbiting Transparent Particles */}
      <div
        style={{
          position: "absolute",
          inset: "-15px",
          zIndex: 4,
          animation: state === 'thinking' ? 'spin-particles 6s linear infinite' : 'spin-particles 25s linear infinite',
        }}
      >
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle cx="15" cy="50" r="2.2" fill="#D4AF37" opacity="0.65" style={{ filter: "drop-shadow(0 0 2px rgba(212,175,55,0.6))" }} />
          <circle cx="85" cy="50" r="1.8" fill="#F4E4B2" opacity="0.8" style={{ filter: "drop-shadow(0 0 2px rgba(244,228,178,0.8))" }} />
          <circle cx="50" cy="15" r="2" fill="#A87400" opacity="0.5" style={{ filter: "drop-shadow(0 0 2px rgba(168,116,0,0.5))" }} />
          <circle cx="50" cy="85" r="1.6" fill="#FFFFFF" opacity="0.75" style={{ filter: "drop-shadow(0 0 2px rgba(255,255,255,0.75))" }} />
        </svg>
      </div>
    </div>
  );
};
