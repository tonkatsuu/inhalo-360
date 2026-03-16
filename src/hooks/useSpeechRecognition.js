import { useState, useEffect, useCallback, useRef } from 'react'

export function useSpeechRecognition() {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [isSupported, setIsSupported] = useState(false)
    const recognitionRef = useRef(null)
    const shouldKeepListeningRef = useRef(false)

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (SpeechRecognition) {
            setIsSupported(true)
            const recognition = new SpeechRecognition()
            recognition.continuous = true
            recognition.interimResults = true
            recognition.lang = 'en-US'

            recognition.onresult = (event) => {
                let currentTranscript = ''
                for (let i = 0; i < event.results.length; i += 1) {
                    currentTranscript += event.results[i][0].transcript
                }
                setTranscript(currentTranscript.toLowerCase())
            }

            recognition.onend = () => {
                if (shouldKeepListeningRef.current) {
                    recognition.start()
                } else {
                    setIsListening(false)
                }
            }

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error)
                if (event.error === 'no-speech' && shouldKeepListeningRef.current) {
                    // Just let it restart on end
                } else {
                    setIsListening(false)
                    shouldKeepListeningRef.current = false
                }
            }

            recognitionRef.current = recognition
        }
    }, [])

    const startListening = useCallback(() => {
        if (!recognitionRef.current || isListening) return
        setTranscript('')
        shouldKeepListeningRef.current = true
        setIsListening(true)
        recognitionRef.current.start()
    }, [isListening])

    const stopListening = useCallback(() => {
        if (!recognitionRef.current || !isListening) return
        shouldKeepListeningRef.current = false
        recognitionRef.current.stop()
        setIsListening(false)
    }, [isListening])

    return {
        isListening,
        transcript,
        startListening,
        stopListening,
        isSupported,
    }
}
