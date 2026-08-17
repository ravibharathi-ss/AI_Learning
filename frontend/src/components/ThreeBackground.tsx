import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeBackgroundProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  agentType?: 'general' | 'technical' | 'billing';
}

export default function ThreeBackground({ scrollRef, agentType = 'general' }: ThreeBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetColor1Ref = useRef<THREE.Color>(new THREE.Color('#00F0FF'));
  const targetColor2Ref = useRef<THREE.Color>(new THREE.Color('#9D00FF'));
  
  const currentColor1Ref = useRef<THREE.Color>(new THREE.Color('#00F0FF'));
  const currentColor2Ref = useRef<THREE.Color>(new THREE.Color('#9D00FF'));

  useEffect(() => {
    const colorMap = {
      general: { c1: '#00F0FF', c2: '#FFFFFF' },
      technical: { c1: '#00F0FF', c2: '#00FF99' },
      billing: { c1: '#9D00FF', c2: '#FF007F' }
    };
    const theme = colorMap[agentType] || colorMap.general;
    targetColor1Ref.current.set(theme.c1);
    targetColor2Ref.current.set(theme.c2);
  }, [agentType]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 16;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 3. Main 3D Object Group
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 3A. Giant 3D Torus Knot (Central Hero 3D Geometry)
    const knotGeometry = new THREE.TorusKnotGeometry(4.2, 1.1, 128, 32);
    const knotMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.15,
      metalness: 0.9,
      emissive: 0x002244,
      wireframe: false
    });
    const knotMesh = new THREE.Mesh(knotGeometry, knotMaterial);
    mainGroup.add(knotMesh);

    // Outer 3D Wireframe Accent Overlay
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    const wireframeMesh = new THREE.Mesh(knotGeometry, wireframeMaterial);
    wireframeMesh.scale.set(1.03, 1.03, 1.03);
    mainGroup.add(wireframeMesh);

    // 3B. Orbiting 3D Polyhedrons / Floating Crystals
    const crystalGroup = new THREE.Group();
    mainGroup.add(crystalGroup);

    const crystalMeshes: THREE.Mesh[] = [];
    const crystalGeom = new THREE.OctahedronGeometry(1.2, 0);

    for (let i = 0; i < 8; i++) {
      const crystalMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x00f0ff : 0x9d00ff,
        roughness: 0.1,
        metalness: 0.95,
        wireframe: i % 3 === 0
      });
      const crystal = new THREE.Mesh(crystalGeom, crystalMat);
      
      const angle = (i / 8) * Math.PI * 2;
      const radius = 11 + (i % 3) * 2;
      crystal.position.x = Math.cos(angle) * radius;
      crystal.position.y = Math.sin(angle) * radius;
      crystal.position.z = (Math.random() - 0.5) * 8;

      crystalGroup.add(crystal);
      crystalMeshes.push(crystal);
    }

    // 3C. Vibrant 3D Starfield / Particle Cloud
    const particleCount = 1200;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color('#00F0FF');
    const color2 = new THREE.Color('#9D00FF');

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

      const mixedColor = color1.clone().lerp(color2, Math.random());
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    mainGroup.add(particleSystem);

    // 4. Dynamic 3D Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const light1 = new THREE.PointLight(0x00f0ff, 8, 50);
    light1.position.set(12, 12, 12);
    scene.add(light1);

    const light2 = new THREE.PointLight(0x9d00ff, 6, 50);
    light2.position.set(-12, -12, 10);
    scene.add(light2);

    const spotLight = new THREE.SpotLight(0xffffff, 10);
    spotLight.position.set(0, 20, 20);
    scene.add(spotLight);

    // 5. Interactive Mouse Tracking & Scroll Listener
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

    // 6. 60 FPS 3D Animation & Scroll Transform Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth scroll interpolation
      currentScrollY += (targetScrollY - currentScrollY) * 0.1;

      // 3D SCROLL ANIMATION: Transform 3D geometries continuously based on scroll position!
      mainGroup.rotation.y = time * 0.15 + currentScrollY * 0.003;
      mainGroup.rotation.x = time * 0.1 + currentScrollY * 0.002;
      mainGroup.position.y = (currentScrollY * 0.008) % 10 - 2;

      // Orbiting 3D Crystals
      crystalGroup.rotation.z = -time * 0.2 + currentScrollY * 0.001;
      crystalMeshes.forEach((crystal, idx) => {
        crystal.rotation.x += delta * (0.8 + idx * 0.2);
        crystal.rotation.y += delta * (0.6 + idx * 0.1);
        crystal.position.z = Math.sin(time * 2 + idx) * 2;
      });

      // Mouse Parallax Camera Motion
      camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
      camera.position.y += (-mouseY * 4 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      // Smooth Light Theme Color Interpolation
      currentColor1Ref.current.lerp(targetColor1Ref.current, 0.05);
      currentColor2Ref.current.lerp(targetColor2Ref.current, 0.05);
      
      light1.color.copy(currentColor1Ref.current);
      light2.color.copy(currentColor2Ref.current);
      knotMaterial.color.copy(currentColor1Ref.current);

      renderer.render(scene, camera);
    };

    animate();

    // 7. Cleanup
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
      knotGeometry.dispose();
      knotMaterial.dispose();
      wireframeMaterial.dispose();
      crystalGeom.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
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
        overflow: 'hidden'
      }}
    />
  );
}
