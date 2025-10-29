import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MicrophoneIcon, StopIcon, SpinnerIcon, CopyIcon, DownloadIcon } from './Icons';

// FIX: Implement encode function as per Gemini API guidelines for audio data.
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const LiveTranscription: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [finalizedTranscript, setFinalizedTranscript] = useState('');
    const [inProgressTranscript, setInProgressTranscript] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    const fullTranscription = (finalizedTranscript + ' ' + inProgressTranscript).trim();

    const stopRecording = useCallback(() => {
        setIsRecording(false);
        
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        if (scriptProcessorRef.current && audioContextRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        audioContextRef.current = null;
        
        // Finalize any in-progress text when stopping manually
        // Use functional update to avoid stale state issues.
        setInProgressTranscript(currentInProgress => {
            if (currentInProgress) {
                setFinalizedTranscript(prevFinalized =>
                    (prevFinalized ? prevFinalized + ' ' : '') + currentInProgress
                );
            }
            return ''; // Clear in-progress
        });
    }, []);

    const startRecording = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setFinalizedTranscript('');
        setInProgressTranscript('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setIsLoading(false);
                        setIsRecording(true);
                        const source = audioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(audioContextRef.current!.destination);
                    },
                    onmessage: (message: LiveServerMessage) => {
                        const text = message.serverContent?.inputTranscription?.text;
                        if (!text) return;

                        // The API sends chunks, so we always append to the in-progress part.
                        setInProgressTranscript(prev => prev + text);

                        if (message.serverContent?.turnComplete) {
                            // The utterance is complete. Move the full in-progress text to finalized, and reset in-progress.
                            setInProgressTranscript(currentInProgress => {
                                setFinalizedTranscript(prevFinalized => 
                                    (prevFinalized ? prevFinalized + ' ' : '') + currentInProgress
                                );
                                return ''; // Reset for the next turn.
                            });
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        setError(`An error occurred: ${e.message || 'Unknown error'}`);
                        stopRecording();
                    },
                    onclose: () => {
                       // Connection closed.
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                },
            });
            await sessionPromiseRef.current;
        } catch (err) {
            let message = 'An unknown error occurred.';
            if (err instanceof Error) {
                message = err.message;
            }
            setError(`Failed to start recording: ${message}`);
            setIsLoading(false);
            stopRecording();
        }
    }, [stopRecording]);

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(fullTranscription).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const downloadTxtFile = () => {
        const element = document.createElement("a");
        const fileBlob = new Blob([fullTranscription], {type: 'text/plain'});
        element.href = URL.createObjectURL(fileBlob);
        element.download = `live-transcription-${new Date().toISOString()}.txt`;
        document.body.appendChild(element); 
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-center items-center mb-6">
                <button
                    onClick={toggleRecording}
                    disabled={isLoading}
                    className={`flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
                        isRecording ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isLoading ? (
                        <SpinnerIcon className="w-10 h-10 text-white" />
                    ) : isRecording ? (
                        <StopIcon className="w-10 h-10 text-white" />
                    ) : (
                        <MicrophoneIcon className="w-10 h-10 text-white" />
                    )}
                </button>
            </div>

            <div className="flex-grow bg-gray-900 rounded-lg p-4 overflow-y-auto min-h-[300px] border border-gray-700">
                {error && <p className="text-red-400 mb-4">{error}</p>}
                
                {fullTranscription.length === 0 && !isRecording && !isLoading && (
                    <p className="text-gray-500 text-center mt-12">Click the microphone to start live transcription.</p>
                )}

                <textarea
                    readOnly
                    value={fullTranscription}
                    className="w-full h-full bg-transparent text-gray-200 resize-none border-none focus:ring-0 p-0"
                    placeholder={isRecording ? 'Listening...' : ''}
                />
            </div>
             {fullTranscription && !isRecording && (
                <div className="mt-4 flex justify-end space-x-2">
                    <button onClick={copyToClipboard} title="Copy to clipboard" className="flex items-center space-x-2 p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                        {copySuccess ? 'Copied!' : <><CopyIcon /> <span>Copy</span></>}
                    </button>
                    <button onClick={downloadTxtFile} title="Download as .txt" className="flex items-center space-x-2 p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                        <DownloadIcon />
                        <span>Download</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default LiveTranscription;