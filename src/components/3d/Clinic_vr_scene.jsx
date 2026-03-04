import React, { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const CONVAI_TABLE_OFFSET = [-1.95, 0, -3.35]
const START_PANEL_TABLE_OFFSET = [-1.15, 0.56, -0.18]
const COLLISION_ROOM_PADDING = Object.freeze({ x: 0.45, z: 0.45 })
const COLLISION_OBSTACLE_PADDING = Object.freeze({ x: 0.08, y: 0.02, z: 0.08 })

function boxToCollisionBounds(box) {
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  }
}

function createTexturedCanvas(drawTexture) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  drawTexture(context, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

function createFloorTexture() {
  const texture = createTexturedCanvas((context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#9e9083')
    gradient.addColorStop(1, '#7f7268')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    for (let index = 0; index < 4200; index += 1) {
      const x = Math.random() * width
      const y = Math.random() * height
      const alpha = 0.025 + Math.random() * 0.05
      const size = 1 + Math.random() * 1.8
      context.fillStyle = `rgba(239, 230, 217, ${alpha})`
      context.fillRect(x, y, size, size)
    }

    context.strokeStyle = 'rgba(90, 74, 58, 0.05)'
    context.lineWidth = 2
    for (let offset = 0; offset <= width; offset += width / 18) {
      context.beginPath()
      context.moveTo(offset, 0)
      context.lineTo(offset, height)
      context.stroke()
    }
  })

  if (texture) {
    texture.repeat.set(8, 8)
  }

  return texture
}

function createWallTexture() {
  const texture = createTexturedCanvas((context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#ddd6c8')
    gradient.addColorStop(1, '#c5b8a5')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    context.fillStyle = 'rgba(133, 119, 99, 0.08)'
    for (let offset = 0; offset < width; offset += width / 8) {
      context.beginPath()
      context.fillRect(offset, 0, 12, height)
    }

    context.strokeStyle = 'rgba(96, 82, 66, 0.18)'
    context.lineWidth = 4
    for (let offset = height / 3; offset < height; offset += height / 3) {
      context.beginPath()
      context.moveTo(0, offset)
      context.lineTo(width, offset)
      context.stroke()
    }

    for (let index = 0; index < 1300; index += 1) {
      const x = Math.random() * width
      const y = Math.random() * height
      const alpha = 0.02 + Math.random() * 0.04
      context.fillStyle = `rgba(95, 78, 61, ${alpha})`
      context.fillRect(x, y, 2, 2)
    }
  })

  if (texture) {
    texture.repeat.set(5, 2.5)
  }

  return texture
}

function createAccentWallTexture() {
  const texture = createTexturedCanvas((context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#a5b3a2')
    gradient.addColorStop(1, '#7d8f7d')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    context.strokeStyle = 'rgba(231, 236, 226, 0.16)'
    context.lineWidth = 10
    for (let offset = 0; offset < width; offset += width / 7) {
      context.beginPath()
      context.moveTo(offset, 0)
      context.lineTo(offset + width / 10, height)
      context.stroke()
    }

    for (let index = 0; index < 1600; index += 1) {
      const x = Math.random() * width
      const y = Math.random() * height
      const alpha = 0.025 + Math.random() * 0.05
      context.fillStyle = `rgba(255, 255, 255, ${alpha})`
      context.fillRect(x, y, 2.5, 2.5)
    }
  })

  if (texture) {
    texture.repeat.set(3.5, 2.5)
  }

  return texture
}

function createArtworkTexture() {
  const texture = createTexturedCanvas((context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#edf2ea')
    gradient.addColorStop(0.5, '#cedbc8')
    gradient.addColorStop(1, '#c4b49d')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    context.fillStyle = 'rgba(89, 121, 92, 0.55)'
    context.beginPath()
    context.arc(width * 0.28, height * 0.38, width * 0.18, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = 'rgba(174, 128, 83, 0.48)'
    context.beginPath()
    context.arc(width * 0.68, height * 0.6, width * 0.2, 0, Math.PI * 2)
    context.fill()

    context.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    context.lineWidth = 8
    context.beginPath()
    context.moveTo(width * 0.1, height * 0.8)
    context.bezierCurveTo(width * 0.28, height * 0.55, width * 0.52, height * 0.92, width * 0.84, height * 0.22)
    context.stroke()
  })

  return texture
}

function EnvironmentTextureShell({ scene }) {
  const floorTexture = useMemo(() => createFloorTexture(), [])
  const wallTexture = useMemo(() => createWallTexture(), [])
  const accentWallTexture = useMemo(() => createAccentWallTexture(), [])
  const artworkTexture = useMemo(() => createArtworkTexture(), [])

  useEffect(() => {
    return () => {
      floorTexture?.dispose()
      wallTexture?.dispose()
      accentWallTexture?.dispose()
      artworkTexture?.dispose()
    }
  }, [accentWallTexture, artworkTexture, floorTexture, wallTexture])

  const shell = useMemo(() => {
    if (!scene) {
      return null
    }

    const bounds = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    bounds.getSize(size)
    bounds.getCenter(center)

    const width = Math.max(size.x + 6, 14)
    const depth = Math.max(size.z + 6, 14)
    const height = Math.max(size.y + 2.4, 5.5)

    return {
      center: center.toArray(),
      floorY: bounds.min.y - 0.04,
      ceilingY: bounds.max.y + 1.1,
      width,
      depth,
      height,
    }
  }, [scene])

  if (!shell) {
    return null
  }

  const [centerX, , centerZ] = shell.center
  const wallY = shell.floorY + shell.height / 2
  const trimY = shell.floorY + 0.075
  const frameY = wallY + shell.height * 0.08

  return (
    <group>
      <mesh position={[centerX, shell.floorY, centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[shell.width, shell.depth]} />
        <meshStandardMaterial color="#8c7f73" map={floorTexture} roughness={1} metalness={0.01} />
      </mesh>

      <mesh position={[centerX, wallY, centerZ - shell.depth / 2]}>
        <planeGeometry args={[shell.width, shell.height]} />
        <meshStandardMaterial color="#8ea08d" map={accentWallTexture} roughness={0.95} metalness={0.02} />
      </mesh>

      <mesh position={[centerX, wallY, centerZ + shell.depth / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[shell.width, shell.height]} />
        <meshStandardMaterial color="#d7cdbc" map={wallTexture} roughness={0.95} metalness={0.02} />
      </mesh>

      <mesh position={[centerX - shell.width / 2, wallY, centerZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[shell.depth, shell.height]} />
        <meshStandardMaterial color="#d9cfbe" map={wallTexture} roughness={0.94} metalness={0.02} />
      </mesh>

      <mesh position={[centerX + shell.width / 2, wallY, centerZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[shell.depth, shell.height]} />
        <meshStandardMaterial color="#d5ccba" map={wallTexture} roughness={0.94} metalness={0.02} />
      </mesh>

      <mesh position={[centerX, shell.ceilingY, centerZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[shell.width, shell.depth]} />
        <meshStandardMaterial color="#f0ece3" roughness={0.92} metalness={0.01} />
      </mesh>

      <mesh position={[centerX, trimY, centerZ - shell.depth / 2 + 0.03]}>
        <boxGeometry args={[shell.width, 0.15, 0.05]} />
        <meshStandardMaterial color="#7b6653" roughness={0.72} />
      </mesh>

      <mesh position={[centerX, trimY, centerZ + shell.depth / 2 - 0.03]}>
        <boxGeometry args={[shell.width, 0.15, 0.05]} />
        <meshStandardMaterial color="#7b6653" roughness={0.72} />
      </mesh>

      <mesh position={[centerX - shell.width / 2 + 0.03, trimY, centerZ]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[shell.depth, 0.15, 0.05]} />
        <meshStandardMaterial color="#7b6653" roughness={0.72} />
      </mesh>

      <mesh position={[centerX + shell.width / 2 - 0.03, trimY, centerZ]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[shell.depth, 0.15, 0.05]} />
        <meshStandardMaterial color="#7b6653" roughness={0.72} />
      </mesh>

      <mesh position={[centerX - shell.width * 0.2, frameY, centerZ - shell.depth / 2 + 0.04]}>
        <boxGeometry args={[1.55, 1.02, 0.06]} />
        <meshStandardMaterial color="#6e5846" roughness={0.58} />
      </mesh>

      <mesh position={[centerX - shell.width * 0.2, frameY, centerZ - shell.depth / 2 + 0.08]}>
        <planeGeometry args={[1.32, 0.8]} />
        <meshStandardMaterial color="#dfe7db" map={artworkTexture} roughness={0.84} metalness={0.01} />
      </mesh>

      <mesh position={[centerX + shell.width * 0.22, frameY - 0.02, centerZ - shell.depth / 2 + 0.02]}>
        <cylinderGeometry args={[0.2, 0.24, 1.3, 18]} />
        <meshStandardMaterial color="#826e5d" roughness={0.8} />
      </mesh>

      <mesh position={[centerX + shell.width * 0.22, frameY + 0.8, centerZ - shell.depth / 2 + 0.02]}>
        <sphereGeometry args={[0.4, 24, 24]} />
        <meshStandardMaterial color="#efe6d4" emissive="#f4e5c8" emissiveIntensity={0.18} roughness={0.88} />
      </mesh>
    </group>
  )
}

export function ClinicRoom({ children, convaiAvatar = null, startPanel = null, onCollisionLayoutChange = null, ...props }) {
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

  const collisionLayout = useMemo(() => {
    if (!scene) {
      return null
    }

    const sceneBounds = new THREE.Box3().setFromObject(scene)
    const minX = sceneBounds.min.x + COLLISION_ROOM_PADDING.x
    const maxX = sceneBounds.max.x - COLLISION_ROOM_PADDING.x
    const minZ = sceneBounds.min.z + COLLISION_ROOM_PADDING.z
    const maxZ = sceneBounds.max.z - COLLISION_ROOM_PADDING.z

    if (minX >= maxX || minZ >= maxZ) {
      return null
    }

    const obstacles = []
    const tableRoot = scene.getObjectByName('TableRoot')
    if (tableRoot) {
      const tableBounds = new THREE.Box3().setFromObject(tableRoot)
      tableBounds.expandByVector(
        new THREE.Vector3(
          COLLISION_OBSTACLE_PADDING.x,
          COLLISION_OBSTACLE_PADDING.y,
          COLLISION_OBSTACLE_PADDING.z,
        ),
      )
      obstacles.push(boxToCollisionBounds(tableBounds))
    }

    return {
      room: {
        min: [minX, sceneBounds.min.y, minZ],
        max: [maxX, sceneBounds.max.y, maxZ],
      },
      obstacles,
    }
  }, [scene])

  useEffect(() => {
    if (!onCollisionLayoutChange) {
      return undefined
    }

    onCollisionLayoutChange(collisionLayout)
    return () => {
      onCollisionLayoutChange(null)
    }
  }, [collisionLayout, onCollisionLayoutChange])

  return (
    <group {...props}>
      <EnvironmentTextureShell scene={scene} />
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
