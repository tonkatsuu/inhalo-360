import React from 'react'
import { useGLTF } from '@react-three/drei'

export function ClinicRoom({ children, ...props }) {
  // Use the transformed model
  const { scene } = useGLTF('/models/clinic_vr_scene-transformed.glb')
  
  return (
    <group {...props}>
      {/* Render the clinic scene */}
      <primitive object={scene} />
      {/* Render children (Inhaler, Clipboard, etc.) */}
      {children}
    </group>
  )
}

useGLTF.preload('/models/clinic_vr_scene-transformed.glb')