import React, { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

const CONVAI_TABLE_OFFSET = [-1.95, 0, -3.35]

export function ClinicRoom({ children, convaiAvatar = null, ...props }) {
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

  const convaiAnchorPosition = useMemo(() => {
    if (!scene) {
      return null
    }

    const tableRoot = scene.getObjectByName('TableRoot')
    if (!tableRoot) {
      return null
    }

    return [
      tableRoot.position.x + CONVAI_TABLE_OFFSET[0],
      CONVAI_TABLE_OFFSET[1],
      tableRoot.position.z + CONVAI_TABLE_OFFSET[2],
    ]
  }, [scene])

  return (
    <group {...props}>
      {/* Render the clinic scene */}
      <primitive object={scene} />
      {convaiAvatar && convaiAnchorPosition && (
        <group position={convaiAnchorPosition}>
          {convaiAvatar}
        </group>
      )}
      {/* Render children (Inhaler, Clipboard, etc.) */}
      {children}
    </group>
  )
}

useGLTF.preload('/models/clinic_vr_scene2.glb')
