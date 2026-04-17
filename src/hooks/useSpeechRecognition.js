import { useState, useEffect, useCallback, useRef } from 'react'

export function useSpeechRecognition() {
    const [isListening, setIsListening] = useState(false)
    const [status, setStatus] = useState('idle')
    const [transcript, setTranscript] = useState('')
    const [error, setError] = useState(null)
    const recognitionRef = useRef(null)
    const shouldKeepListeningRef = useRef(false)
    const isStartingRef = useRef(false)
    const isSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

    useEffect(() => {
        if (!isSupported) {
            recognitionRef.current = null
            return undefined
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event) => {
            let currentTranscript = ''
            for (let i = 0; i < event.results.length; i += 1) {
                currentTranscript += event.results[i][0].transcript
            }
            setError(null)
            setTranscript(currentTranscript.toLowerCase())
        }

        recognition.onstart = () => {
            isStartingRef.current = false
            setError(null)
            setIsListening(true)
            setStatus('listening')
        }

        recognition.onend = () => {
            if (shouldKeepListeningRef.current) {
                setStatus('starting')
                try {
                    recognition.start()
                } catch (restartError) {
                    isStartingRef.current = false
                    setError(restartError instanceof Error ? restartError.message : 'restart_failed')
                    setIsListening(false)
                    setStatus('error')
                }
            } else {
                setIsListening(false)
                setStatus('idle')
            }
        }

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error)
            setError(event.error ?? 'unknown')
            if (event.error === 'no-speech' && shouldKeepListeningRef.current) {
                return
            }

            isStartingRef.current = false
            setIsListening(false)
            shouldKeepListeningRef.current = false
            setStatus('error')
        }

        recognitionRef.current = recognition

        return () => {
            shouldKeepListeningRef.current = false
            recognition.onresult = null
            recognition.onstart = null
            recognition.onend = null
            recognition.onerror = null
            recognitionRef.current = null
        }
    }, [isSupported])

    const ensureMicrophonePermission = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            return true
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        return true
    }, [])

    const startListening = useCallback(async () => {
        if (!recognitionRef.current || isListening || isStartingRef.current) return
        setTranscript('')
        setError(null)
        shouldKeepListeningRef.current = true
        setStatus('starting')
        isStartingRef.current = true

        try {
            await ensureMicrophonePermission()
            recognitionRef.current.start()
        } catch (startError) {
            setError(startError instanceof Error ? startError.message : 'start_failed')
            shouldKeepListeningRef.current = false
            setIsListening(false)
            setStatus('error')
            isStartingRef.current = false
        }
    }, [ensureMicrophonePermission, isListening])

    const stopListening = useCallback(() => {
        if (!recognitionRef.current || (!isListening && !isStartingRef.current && status !== 'starting')) return
        shouldKeepListeningRef.current = false
        isStartingRef.current = false
        recognitionRef.current.stop()
        setIsListening(false)
        setStatus('idle')
    }, [isListening, status])

    const restartListening = useCallback(async () => {
        if (!recognitionRef.current || !isSupported) return

        setTranscript('')
        setError(null)
        shouldKeepListeningRef.current = true
        setStatus('starting')
        isStartingRef.current = true

        if (isListening) {
            recognitionRef.current.stop()
            return
        }

        try {
            await ensureMicrophonePermission()
            recognitionRef.current.start()
        } catch (startError) {
            setError(startError instanceof Error ? startError.message : 'start_failed')
            shouldKeepListeningRef.current = false
            setIsListening(false)
            setStatus('error')
            isStartingRef.current = false
        }
    }, [ensureMicrophonePermission, isListening, isSupported])

    return {
        isListening,
        status: isSupported ? status : 'unsupported',
        transcript,
        error,
        startListening,
        stopListening,
        restartListening,
        isSupported,
    }
}
