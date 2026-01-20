"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
  hue: number;
  isBioluminescent: boolean;
}

interface LightRay {
  x: number;
  width: number;
  opacity: number;
  speed: number;
  offset: number;
}

export default function DeepOceanBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lightRaysRef = useRef<LightRay[]>([]);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
      initLightRays();
    };

    const initParticles = () => {
      const particleCount = Math.floor((canvas.width * canvas.height) / 15000);
      particlesRef.current = Array.from({ length: particleCount }, () => {
        const isBioluminescent = Math.random() < 0.15; // 15% are amber bioluminescent
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 3 + 1,
          speedX: (Math.random() - 0.5) * 0.3,
          speedY: -Math.random() * 0.2 - 0.1, // Slowly rise like bubbles
          opacity: Math.random() * 0.5 + 0.2,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.002 + 0.001,
          hue: isBioluminescent ? 35 + Math.random() * 15 : 200 + Math.random() * 40, // Amber or blue-purple
          isBioluminescent,
        };
      });
    };

    const initLightRays = () => {
      const rayCount = 5;
      lightRaysRef.current = Array.from({ length: rayCount }, (_, i) => ({
        x: (canvas.width / (rayCount + 1)) * (i + 1) + (Math.random() - 0.5) * 100,
        width: Math.random() * 150 + 100,
        opacity: Math.random() * 0.03 + 0.01,
        speed: Math.random() * 0.0002 + 0.0001,
        offset: Math.random() * Math.PI * 2,
      }));
    };

    const drawGradientBackground = (time: number) => {
      // Animated gradient: deep navy → slate → dark purple
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

      // Subtle color shift over time
      const shift = Math.sin(time * 0.0001) * 10;

      gradient.addColorStop(0, `hsl(${220 + shift}, 60%, 8%)`); // Deep navy
      gradient.addColorStop(0.4, `hsl(${215 + shift}, 50%, 12%)`); // Navy-slate
      gradient.addColorStop(0.7, `hsl(${230 + shift}, 45%, 15%)`); // Slate-purple
      gradient.addColorStop(1, `hsl(${270 + shift}, 50%, 12%)`); // Dark purple

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const drawLightRays = (time: number) => {
      lightRaysRef.current.forEach((ray) => {
        const waveX = Math.sin(time * ray.speed + ray.offset) * 50;
        const currentX = ray.x + waveX;

        const gradient = ctx.createLinearGradient(currentX, 0, currentX, canvas.height);
        gradient.addColorStop(0, `rgba(200, 220, 255, ${ray.opacity * 1.5})`);
        gradient.addColorStop(0.3, `rgba(180, 200, 240, ${ray.opacity})`);
        gradient.addColorStop(0.7, `rgba(160, 180, 220, ${ray.opacity * 0.5})`);
        gradient.addColorStop(1, "rgba(140, 160, 200, 0)");

        ctx.beginPath();
        ctx.moveTo(currentX - ray.width / 2, 0);
        ctx.lineTo(currentX + ray.width / 2, 0);
        ctx.lineTo(currentX + ray.width * 0.3, canvas.height);
        ctx.lineTo(currentX - ray.width * 0.3, canvas.height);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();
      });
    };

    const drawPearlShimmer = (time: number) => {
      // Multiple subtle radial gradients for pearl-like shimmer
      const shimmerCount = 3;
      for (let i = 0; i < shimmerCount; i++) {
        const baseX = canvas.width * (0.2 + i * 0.3);
        const baseY = canvas.height * 0.4;
        const moveX = Math.sin(time * 0.0003 + i * 2) * 100;
        const moveY = Math.cos(time * 0.0002 + i * 2) * 50;
        const x = baseX + moveX;
        const y = baseY + moveY;
        const radius = 300 + Math.sin(time * 0.001 + i) * 50;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.03)");
        gradient.addColorStop(0.3, "rgba(220, 230, 255, 0.02)");
        gradient.addColorStop(0.6, "rgba(200, 210, 240, 0.01)");
        gradient.addColorStop(1, "rgba(180, 190, 220, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    const drawParticle = (particle: Particle, time: number) => {
      const { x, y, size, opacity, pulse, pulseSpeed, hue, isBioluminescent } = particle;

      // Pulsing effect
      const currentOpacity = opacity * (0.5 + Math.sin(pulse + time * pulseSpeed) * 0.5);
      const currentSize = size * (0.8 + Math.sin(pulse + time * pulseSpeed) * 0.2);

      // Mouse interaction - particles glow brighter near cursor
      const dx = mouseRef.current.x - x;
      const dy = mouseRef.current.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const mouseGlow = Math.max(0, 1 - distance / 200);

      ctx.save();

      if (isBioluminescent) {
        // Amber bioluminescent glow
        const glowSize = currentSize * 8;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
        gradient.addColorStop(0, `hsla(${hue}, 100%, 70%, ${(currentOpacity + mouseGlow * 0.5) * 0.8})`);
        gradient.addColorStop(0.3, `hsla(${hue}, 90%, 60%, ${(currentOpacity + mouseGlow * 0.3) * 0.4})`);
        gradient.addColorStop(0.6, `hsla(${hue}, 80%, 50%, ${currentOpacity * 0.15})`);
        gradient.addColorStop(1, "transparent");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core particle
      const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, currentSize * 2);
      if (isBioluminescent) {
        coreGradient.addColorStop(0, `hsla(${hue}, 100%, 80%, ${currentOpacity + mouseGlow * 0.3})`);
        coreGradient.addColorStop(0.5, `hsla(${hue}, 90%, 60%, ${currentOpacity * 0.6})`);
        coreGradient.addColorStop(1, "transparent");
      } else {
        coreGradient.addColorStop(0, `hsla(${hue}, 60%, 80%, ${currentOpacity * 0.8})`);
        coreGradient.addColorStop(0.5, `hsla(${hue}, 50%, 60%, ${currentOpacity * 0.4})`);
        coreGradient.addColorStop(1, "transparent");
      }

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(x, y, currentSize * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const animate = (time: number) => {
      // Draw gradient background
      drawGradientBackground(time);

      // Draw light rays (underwater light refraction)
      drawLightRays(time);

      // Draw pearl shimmer effects
      drawPearlShimmer(time);

      // Update and draw particles
      particlesRef.current.forEach((particle) => {
        drawParticle(particle, time);

        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Add slight wave motion
        particle.x += Math.sin(time * 0.001 + particle.pulse) * 0.2;

        // Wrap around edges
        if (particle.y < -10) {
          particle.y = canvas.height + 10;
          particle.x = Math.random() * canvas.width;
        }
        if (particle.x < -10) particle.x = canvas.width + 10;
        if (particle.x > canvas.width + 10) particle.x = -10;
      });

      // Vignette effect for depth
      const vignette = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.3,
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.9
      );
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, "rgba(0, 0, 20, 0.4)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    resizeCanvas();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
