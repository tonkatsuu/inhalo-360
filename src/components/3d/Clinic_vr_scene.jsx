import React, { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

const CONVAI_TABLE_OFFSET = [-1.95, 0, -3.35]
const START_PANEL_TABLE_OFFSET = [-1.15, 0.56, -0.18]

export function ClinicRoom({ children, convaiAvatar = null, startPanel = null, ...props }) {
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

  const startPanelAnchorPosition = useMemo(() => {
    if (!scene) {
      return null
    }

    const tableRoot = scene.getObjectByName('TableRoot')
    if (!tableRoot) {
      return null
    }

    return [
      tableRoot.position.x + START_PANEL_TABLE_OFFSET[0],
      tableRoot.position.y + START_PANEL_TABLE_OFFSET[1],
      tableRoot.position.z + START_PANEL_TABLE_OFFSET[2],
    ]
  }, [scene])

  return (
    <group {...props}>
      {/* Render the clinic scene */}
      <primitive object={scene} />
      {startPanel && startPanelAnchorPosition && (
        <group position={startPanelAnchorPosition} rotation={[-0.18, 0, 0]}>
          {startPanel}
        </group>
      )}
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
