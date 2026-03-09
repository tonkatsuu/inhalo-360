import { Image, RoundedBox, Text } from '@react-three/drei'
import { BRAND_ICON_PATH, BRAND_NAME } from '../../branding'

export function BrandChip3D({ position = [0, 0, 0], width = 0.5, label = BRAND_NAME, iconSize = 0.085, materialRef }) {
    return (
        <group position={position}>
            <RoundedBox args={[width, 0.11, 0.02]} radius={0.04} smoothness={4}>
                <meshStandardMaterial ref={materialRef} color="#0f2b35" transparent opacity={0.84} />
            </RoundedBox>

            <Image url={BRAND_ICON_PATH} position={[-width / 2 + 0.075, 0, 0.013]} scale={[iconSize, iconSize, 1]} transparent />

            <Text
                position={[-width / 2 + 0.135, 0, 0.014]}
                fontSize={0.049}
                maxWidth={width - 0.19}
                anchorX="left"
                anchorY="middle"
                textAlign="left"
                color="#f8fafc"
            >
                {label}
            </Text>
        </group>
    )
}
