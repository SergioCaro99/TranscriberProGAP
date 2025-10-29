import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback } from 'react';
import { CopyIcon, DownloadIcon, SpinnerIcon, UploadIcon } from './Icons';

interface TranscriptionResult {
    status: 'pending' | 'transcribing' | 'done' | 'error';
    text: string;
    error?: string;
}

const ResultBlock: React.FC<{ fileName: string; result: TranscriptionResult }> = ({ fileName, result }) => {
    const [copySuccess, setCopySuccess] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(result.text).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const downloadTxtFile = () => {
        const element = document.createElement("a");
        const fileBlob = new Blob([result.text], { type: 'text/plain' });
        element.href = URL.createObjectURL(fileBlob);
        const nameWithoutExtension = fileName.split('.').slice(0, -1).join('.') || 'transcription';
        element.download = `${nameWithoutExtension}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="bg-gray-900 rounded-lg p-4 mt-4 border border-gray-700 relative">
            <h3 className="font-semibold text-blue-400 mb-2">{fileName}</h3>
            {result.status === 'transcribing' && (
                <div className="flex items-center text-gray-400">
                    <SpinnerIcon className="w-5 h-5 mr-2" />
                    <span>Transcribing...</span>
                </div>
            )}
            {result.status === 'error' && <p className="text-red-400">{result.error}</p>}
            {result.status === 'done' && result.text && (
                 <>
                    <div className="absolute top-2 right-2 flex space-x-2">
                        <button onClick={copyToClipboard} title="Copy to clipboard" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                            {copySuccess ? 'Copied!' : <CopyIcon className="w-5 h-5" />}
                        </button>
                        <button onClick={downloadTxtFile} title="Download as .txt" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <textarea
                        readOnly
                        value={result.text}
                        className="w-full h-48 bg-transparent text-gray-200 resize-y border-none focus:ring-0 p-0"
                    />
                </>
            )}
        </div>
    );
};


const FileTranscription: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [results, setResults] = useState<Map<string, TranscriptionResult>>(new Map());
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleFiles = useCallback((selectedFiles: FileList | null) => {
        if (selectedFiles) {
            const newFiles = Array.from(selectedFiles).filter(
              (file) => !files.some((f) => f.name === file.name)
            );
            setFiles(prevFiles => [...prevFiles, ...newFiles]);
            const newResults = new Map(results);
            newFiles.forEach(file => {
                newResults.set(file.name, { status: 'pending', text: '' });
            });
            setResults(newResults);
        }
    }, [files, results]);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(event.target.files);
    };

    const handleDragEvents = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };
    
    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleTranscribe = async () => {
        const filesToTranscribe = files.filter(f => results.get(f.name)?.status === 'pending');
        if (filesToTranscribe.length === 0) return;

        setIsTranscribing(true);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        for (const file of filesToTranscribe) {
            setResults(prev => new Map(prev).set(file.name, { status: 'transcribing', text: '' }));

            try {
                const fileAsBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = (error) => reject(error);
                    reader.readAsDataURL(file);
                });

                const audioPart = { inlineData: { mimeType: file.type, data: fileAsBase64 } };
                const textPart = { text: "Transcribe this audio, which is a call between multiple people. It is critical that you accurately identify each speaker and label them as 'Persona 1:', 'Persona 2:', etc. Start a new line for each turn in the conversation with the correct speaker label. Provide only the final, clean transcription." };
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: { parts: [textPart, audioPart] },
                });

                setResults(prev => new Map(prev).set(file.name, { status: 'done', text: response.text }));
            } catch (err) {
                const message = err instanceof Error ? err.message : 'An unknown error occurred.';
                setResults(prev => new Map(prev).set(file.name, { status: 'error', text: '', error: message }));
            }
        }

        setIsTranscribing(false);
    };

    const clearFiles = () => {
        setFiles([]);
        setResults(new Map());
    };

    const filesToTranscribeCount = files.filter(f => results.get(f.name)?.status === 'pending').length;

    return (
        <div className="flex flex-col h-full">
            <label 
                htmlFor="audio-upload"
                onDragEnter={handleDragEvents}
                onDragLeave={handleDragEvents}
                onDragOver={handleDragEvents}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-600 transition-all duration-300 ${isDragging ? 'border-blue-500 bg-gray-600' : ''}`}
            >
                <div className="flex flex-col items-center justify-center">
                    <UploadIcon className="w-10 h-10 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-gray-500">You can add multiple files</p>
                </div>
                <input id="audio-upload" type="file" multiple className="hidden" accept="audio/*" onChange={handleFileChange} />
            </label>

            {files.length > 0 && (
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Selected Files:</h3>
                        <button onClick={clearFiles} className="text-sm text-red-400 hover:text-red-300">Clear All</button>
                    </div>
                    <div className="max-h-24 overflow-y-auto bg-gray-900 rounded p-2 border border-gray-700">
                        {files.map(file => <p key={file.name} className="text-sm text-gray-300 truncate">{file.name}</p>)}
                    </div>
                </div>
            )}
            
            <div className="mt-6">
                <button
                    onClick={handleTranscribe}
                    disabled={filesToTranscribeCount === 0 || isTranscribing}
                    className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
                >
                    {isTranscribing ? <SpinnerIcon className="w-5 h-5 mr-2" /> : null}
                    {isTranscribing ? 'Transcribing...' : `Transcribe ${filesToTranscribeCount > 0 ? `${filesToTranscribeCount} File(s)` : 'Audio'}`}
                </button>
            </div>
            
            <div className="flex-grow mt-6 overflow-y-auto">
                {Array.from(results.entries()).map(([fileName, result]) => (
                    result.status !== 'pending' && <ResultBlock key={fileName} fileName={fileName} result={result} />
                ))}
            </div>
        </div>
    );
};

export default FileTranscription;