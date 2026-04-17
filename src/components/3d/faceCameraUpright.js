import * as THREE from 'three'

const worldPosition = new THREE.Vector3()
const targetPosition = new THREE.Vector3()
const worldUp = new THREE.Vector3(0, 1, 0)
const lookAtMatrix = new THREE.Matrix4()
const worldQuaternion = new THREE.Quaternion()
const inverseParentQuaternion = new THREE.Quaternion()
const targetQuaternion = new THREE.Quaternion()

export function faceCameraUpright(object, camera, { flatten = true, slerpAlpha = 1 } = {}) {
    if (!object || !camera) {
        return
    }

    object.getWorldPosition(worldPosition)
    camera.getWorldPosition(targetPosition)

    if (flatten) {
        targetPosition.y = worldPosition.y
    }

    if (targetPosition.distanceToSquared(worldPosition) < 1e-6) {
        return
    }

    lookAtMatrix.lookAt(targetPosition, worldPosition, worldUp)
    targetQuaternion.setFromRotationMatrix(lookAtMatrix)

    if (object.parent) {
        object.parent.getWorldQuaternion(worldQuaternion)
        inverseParentQuaternion.copy(worldQuaternion).invert()
        targetQuaternion.premultiply(inverseParentQuaternion)
    }

    if (slerpAlpha < 1) {
        object.quaternion.slerp(targetQuaternion, slerpAlpha)
        return
    }

    object.quaternion.copy(targetQuaternion)
}
