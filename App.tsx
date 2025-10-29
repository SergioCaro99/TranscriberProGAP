import React, { useState } from 'react';
import LiveTranscription from './components/LiveTranscription';
import FileTranscription from './components/FileTranscription';

type Mode = 'live' | 'file';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('live');

  const getButtonClasses = (buttonMode: Mode) => {
    return `px-6 py-2 text-lg font-semibold rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${
      mode === buttonMode
        ? 'bg-blue-600 text-white shadow-lg'
        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="./logoblanco.png" alt="Afore Coppel Logo" className="h-20" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            Audio Transcriber <span className="text-blue-500">Pro</span>
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Real-time and file-based audio transcription powered by GAP
          </p>
        </header>

        <main>
          <div className="flex justify-center items-center mb-8 space-x-4">
            <button onClick={() => setMode('live')} className={getButtonClasses('live')}>
              Live Recording
            </button>
            <button onClick={() => setMode('file')} className={getButtonClasses('file')}>
              Upload File
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 min-h-[500px]">
            {mode === 'live' ? <LiveTranscription /> : <FileTranscription />}
          </div>
        </main>
        
        <footer className="text-center mt-8 text-gray-500">
          <p>&copy; {new Date().getFullYear()} Audio Transcriber Pro. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;