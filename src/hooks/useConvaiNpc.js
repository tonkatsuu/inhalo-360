import { useConvaiClient } from '@convai/web-sdk/react'

export function useConvaiNpc({ apiKey, characterId }) {
    const client = useConvaiClient({
        apiKey,
        characterId,
        enableVideo: false,
        enableLipsync: true,
        blendshapeConfig: {
            format: 'arkit',
        },
    })

    return {
        client,
        state: client.state,
        audioControls: client.audioControls,
        room: client.room ?? null,
        connect: () => client.connect(),
        disconnect: () => client.disconnect(),
        mute: () => client.audioControls?.muteAudio?.(),
        unmute: () => client.audioControls?.unmuteAudio?.(),
    }
}
