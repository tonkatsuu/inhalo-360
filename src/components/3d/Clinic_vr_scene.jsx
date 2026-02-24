import React from 'react'
import { useGLTF } from '@react-three/drei'

export function ClinicRoom(props) {
  // Use the transformed model
  const { scene } = useGLTF('/models/clinic_vr_scene-transformed.glb')
  
  return (
    // We render the scene exactly as exported from Unity
    <primitive object={scene} {...props} />
  )
}

useGLTF.preload('/models/clinic_vr_scene-transformed.glb')