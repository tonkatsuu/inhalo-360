import React, { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'

export function ClinicRoom({ children, ...props }) {
  // Use the transformed model
  const { scene } = useGLTF('/models/clinic_vr_scene2.glb')

  useEffect(() => {
    if (!scene) return
    // Hide any clipboard meshes baked into the exported scene.
    scene.traverse((child) => {
      if (child?.name && /clipboard/i.test(child.name)) {
        child.visible = false
      }
    })
  }, [scene])

  return (
    <group {...props}>
      {/* Render the clinic scene */}
      <primitive object={scene} />
      {/* Render children (Inhaler, Clipboard, etc.) */}
      {children}
    </group>
  )
}

useGLTF.preload('/models/clinic_vr_scene2.glb')