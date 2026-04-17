import { useState, useEffect, useCallback, useRef } from 'react'

export function useSpeechRecognition() {
    const [isListening, setIsListening] = useState(false)
    const [status, setStatus] = useState('idle')
    const [transcript, setTranscript] = useState('')
    const [error, setError] = useState(null)
    const [inputLevel, setInputLevel] = useState(0)
    const recognitionRef = useRef(null)
    const shouldKeepListeningRef = useRef(false)
    const isStartingRef = useRef(false)
    const mediaStreamRef = useRef(null)
    const audioContextRef = useRef(null)
    const analyserRef = useRef(null)
    const inputFrameRef = useRef(null)
    const restartTimeoutRef = useRef(null)
    const isSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

    const stopAudioMonitoring = useCallback(() => {
        if (inputFrameRef.current) {
            window.cancelAnimationFrame(inputFrameRef.current)
            inputFrameRef.current = null
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop())
            mediaStreamRef.current = null
        }

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {})
            audioContextRef.current = null
        }

        analyserRef.current = null
        setInputLevel(0)
    }, [])

    const startAudioMonitoring = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            return
        }

        if (mediaStreamRef.current && analyserRef.current) {
            return
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const AudioCtx = window.AudioContext || window.webkitAudioContext

        if (!AudioCtx) {
            mediaStreamRef.current = stream
            return
        }

        const audioContext = new AudioCtx()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.82

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        const timeDomain = new Uint8Array(analyser.fftSize)

        const updateLevel = () => {
            analyser.getByteTimeDomainData(timeDomain)

            let sumSquares = 0
            for (let index = 0; index < timeDomain.length; index += 1) {
                const centered = (timeDomain[index] - 128) / 128
                sumSquares += centered * centered
            }

            const rms = Math.sqrt(sumSquares / timeDomain.length)
            setInputLevel(Math.min(1, rms * 4.5))
            inputFrameRef.current = window.requestAnimationFrame(updateLevel)
        }

        mediaStreamRef.current = stream
        audioContextRef.current = audioContext
        analyserRef.current = analyser
        inputFrameRef.current = window.requestAnimationFrame(updateLevel)
    }, [])

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
                if (restartTimeoutRef.current) {
                    window.clearTimeout(restartTimeoutRef.current)
                }

                restartTimeoutRef.current = window.setTimeout(() => {
                    try {
                        recognition.start()
                    } catch (restartError) {
                        isStartingRef.current = false
                        setError(restartError instanceof Error ? restartError.message : 'restart_failed')
                        setIsListening(false)
                        setStatus('error')
                    }
                }, 180)
            } else {
                setIsListening(false)
                setStatus('idle')
            }
        }

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error)
            if (event.error === 'no-speech' && shouldKeepListeningRef.current) {
                return
            }

            setError(event.error ?? 'unknown')
            isStartingRef.current = false
            setIsListening(false)
            shouldKeepListeningRef.current = false
            setStatus('error')
            stopAudioMonitoring()
        }

        recognitionRef.current = recognition

        return () => {
            shouldKeepListeningRef.current = false
            if (restartTimeoutRef.current) {
                window.clearTimeout(restartTimeoutRef.current)
                restartTimeoutRef.current = null
            }
            recognition.onresult = null
            recognition.onstart = null
            recognition.onend = null
            recognition.onerror = null
            recognitionRef.current = null
            stopAudioMonitoring()
        }
    }, [isSupported, stopAudioMonitoring])

    const startListening = useCallback(async () => {
        if (!recognitionRef.current || isListening || isStartingRef.current) return
        setTranscript('')
        setError(null)
        shouldKeepListeningRef.current = true
        setStatus('starting')
        isStartingRef.current = true

        try {
            await startAudioMonitoring()
            recognitionRef.current.start()
        } catch (startError) {
            setError(startError instanceof Error ? startError.message : 'start_failed')
            shouldKeepListeningRef.current = false
            setIsListening(false)
            setStatus('error')
            isStartingRef.current = false
            stopAudioMonitoring()
        }
    }, [isListening, startAudioMonitoring, stopAudioMonitoring])

    const stopListening = useCallback(() => {
        if (!recognitionRef.current || (!isListening && !isStartingRef.current && status !== 'starting')) return
        shouldKeepListeningRef.current = false
        isStartingRef.current = false
        if (restartTimeoutRef.current) {
            window.clearTimeout(restartTimeoutRef.current)
            restartTimeoutRef.current = null
        }
        recognitionRef.current.stop()
        setIsListening(false)
        setStatus('idle')
        stopAudioMonitoring()
    }, [isListening, status, stopAudioMonitoring])

    const restartListening = useCallback(async () => {
        if (!recognitionRef.current || !isSupported) return

        setTranscript('')
        setError(null)

        if (isListening) {
            setStatus('listening')
            return
        }

        shouldKeepListeningRef.current = true
        setStatus('starting')
        isStartingRef.current = true

        try {
            await startAudioMonitoring()
            recognitionRef.current.start()
        } catch (startError) {
            setError(startError instanceof Error ? startError.message : 'start_failed')
            shouldKeepListeningRef.current = false
            setIsListening(false)
            setStatus('error')
            isStartingRef.current = false
            stopAudioMonitoring()
        }
    }, [isListening, isSupported, startAudioMonitoring, stopAudioMonitoring])

    return {
        isListening,
        status: isSupported ? status : 'unsupported',
        transcript,
        error,
        inputLevel,
        startListening,
        stopListening,
        restartListening,
        isSupported,
    }
}
