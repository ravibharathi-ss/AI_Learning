import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeBackgroundProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  agentType?: 'general' | 'technical' | 'billing';
}

export default function ThreeBackground({ scrollRef }: ThreeBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, and Renderer Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // 2. Master AI Visuals Group
    const aiGroup = new THREE.Group();
    scene.add(aiGroup);

    // ════════════════════════════════════════════════════════════════════
    // 3. AI NEURAL NETWORK / SYNAPTIC CONSTELLATION
    // ════════════════════════════════════════════════════════════════════
    const nodeCount = 70;
    const nodePositions: THREE.Vector3[] = [];
    const nodeVelocities: THREE.Vector3[] = [];
    const nodeGroup = new THREE.Group();
    aiGroup.add(nodeGroup);

    // Node geometry & luminous AI blue/violet materials
    const nodeGeometry = new THREE.SphereGeometry(0.18, 16, 16);
    const nodeMaterial1 = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9, // Electric cyan/blue
      transparent: true,
      opacity: 0.6
    });
    const nodeMaterial2 = new THREE.MeshBasicMaterial({
      color: 0x6366f1, // Neural indigo/purple
      transparent: true,
      opacity: 0.6
    });

    const nodeMeshes: THREE.Mesh[] = [];
    const spreadRadius = 14;

    for (let i = 0; i < nodeCount; i++) {
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * spreadRadius * 2.2,
        (Math.random() - 0.5) * spreadRadius * 1.6,
        (Math.random() - 0.5) * 10
      );
      nodePositions.push(pos);
      nodeVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.015,
          (Math.random() - 0.5) * 0.015,
          (Math.random() - 0.5) * 0.01
        )
      );

      const mesh = new THREE.Mesh(nodeGeometry, i % 2 === 0 ? nodeMaterial1 : nodeMaterial2);
      mesh.position.copy(pos);
      nodeGroup.add(mesh);
      nodeMeshes.push(mesh);
    }

    // Dynamic Synaptic Interconnection Lines
    const maxConnections = 120;
    const linePositions = new Float32Array(maxConnections * 6);
    const lineColors = new Float32Array(maxConnections * 6);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });

    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    nodeGroup.add(linesMesh);

    // ════════════════════════════════════════════════════════════════════
    // 4. HOLOGRAPHIC AI NEURAL CORE (Central Quantum Brain)
    // ════════════════════════════════════════════════════════════════════
    const coreGroup = new THREE.Group();
    // Shift slightly to the right so it balances with the left sidebar & chat
    coreGroup.position.set(4, 0, -2);
    aiGroup.add(coreGroup);

    // Outer Geodesic Wireframe Sphere (AI Cortex)
    const cortexGeom = new THREE.IcosahedronGeometry(3.6, 2);
    const cortexWireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.22
    });
    const cortexMesh = new THREE.Mesh(cortexGeom, cortexWireMat);
    coreGroup.add(cortexMesh);

    // Inner Glowing Energy Core
    const innerCoreGeom = new THREE.IcosahedronGeometry(2.0, 1);
    const innerCoreMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const innerCoreMesh = new THREE.Mesh(innerCoreGeom, innerCoreMat);
    coreGroup.add(innerCoreMesh);

    // Quantum Orbital Gimbal Rings (Data Gyroscope)
    const ring1Geom = new THREE.TorusGeometry(4.8, 0.04, 16, 100);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35
    });
    const ring1 = new THREE.Mesh(ring1Geom, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    coreGroup.add(ring1);

    const ring2Geom = new THREE.TorusGeometry(5.4, 0.035, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.3
    });
    const ring2 = new THREE.Mesh(ring2Geom, ringMat2);
    ring2.rotation.y = Math.PI / 4;
    coreGroup.add(ring2);

    // Ambient Floating Data Particles
    const particleCount = 200;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 35;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 25;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.15,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particleGeom, particleMat);
    aiGroup.add(particleSystem);

    // 5. Interactive Mouse Parallax & Scroll Interpolation
    let mouseX = 0;
    let mouseY = 0;
    let targetScrollY = 0;
    let currentScrollY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const scrollContainer = scrollRef.current;
    const handleScroll = () => {
      if (scrollContainer) {
        targetScrollY = scrollContainer.scrollTop;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 6. Smooth Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth scroll interpolation
      currentScrollY += (targetScrollY - currentScrollY) * 0.08;

      // Rotate AI Core & Orbital Rings
      cortexMesh.rotation.y = time * 0.12;
      cortexMesh.rotation.x = time * 0.08;

      innerCoreMesh.rotation.y = -time * 0.18;
      innerCoreMesh.rotation.z = time * 0.14;

      ring1.rotation.z = time * 0.2;
      ring1.rotation.y = time * 0.1;

      ring2.rotation.x = -time * 0.15;
      ring2.rotation.z = time * 0.12;

      // Pulse breathing scale on the AI core
      const pulse = 1.0 + Math.sin(time * 2.0) * 0.04;
      innerCoreMesh.scale.set(pulse, pulse, pulse);

      // Animate Synaptic Nodes
      for (let i = 0; i < nodeCount; i++) {
        const pos = nodePositions[i];
        const vel = nodeVelocities[i];
        pos.add(vel);

        // Boundary bounce
        if (Math.abs(pos.x) > spreadRadius * 1.1) vel.x *= -1;
        if (Math.abs(pos.y) > spreadRadius * 0.8) vel.y *= -1;
        if (Math.abs(pos.z) > 5) vel.z *= -1;

        nodeMeshes[i].position.copy(pos);
      }

      // Reconnect Dynamic Synaptic Lines between close nodes
      let lineIdx = 0;
      const connectionDist = 4.2;
      const posAttr = lineGeometry.attributes.position as THREE.BufferAttribute;
      const colAttr = lineGeometry.attributes.color as THREE.BufferAttribute;

      for (let i = 0; i < nodeCount && lineIdx < maxConnections; i++) {
        for (let j = i + 1; j < nodeCount && lineIdx < maxConnections; j++) {
          const dist = nodePositions[i].distanceTo(nodePositions[j]);
          if (dist < connectionDist) {
            const p1 = nodePositions[i];
            const p2 = nodePositions[j];

            const idx = lineIdx * 6;
            posAttr.array[idx] = p1.x;
            posAttr.array[idx + 1] = p1.y;
            posAttr.array[idx + 2] = p1.z;
            posAttr.array[idx + 3] = p2.x;
            posAttr.array[idx + 4] = p2.y;
            posAttr.array[idx + 5] = p2.z;

            const alpha = 1.0 - dist / connectionDist;
            // Cyan-to-purple gradient line
            colAttr.array[idx] = 0.05 * alpha;
            colAttr.array[idx + 1] = 0.65 * alpha;
            colAttr.array[idx + 2] = 0.95 * alpha;
            colAttr.array[idx + 3] = 0.5 * alpha;
            colAttr.array[idx + 4] = 0.3 * alpha;
            colAttr.array[idx + 5] = 0.95 * alpha;

            lineIdx++;
          }
        }
      }
      lineGeometry.setDrawRange(0, lineIdx * 2);
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // Mouse Parallax & Soft Drift
      camera.position.x += (mouseX * 2.5 - camera.position.x) * 0.04;
      camera.position.y += (-mouseY * 2.0 - camera.position.y) * 0.04;
      camera.position.y += Math.sin(time * 0.5) * 0.005;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // 7. Cleanup on unmount
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      nodeGeometry.dispose();
      nodeMaterial1.dispose();
      nodeMaterial2.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      cortexGeom.dispose();
      cortexWireMat.dispose();
      innerCoreGeom.dispose();
      innerCoreMat.dispose();
      ring1Geom.dispose();
      ringMat1.dispose();
      ring2Geom.dispose();
      ringMat2.dispose();
      particleGeom.dispose();
      particleMat.dispose();
    };
  }, [scrollRef]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: 0.85
      }}
    />
  );
}
