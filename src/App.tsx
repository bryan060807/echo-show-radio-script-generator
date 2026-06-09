import React, { useState, useEffect } from 'react';
import { RadioShowEpisode, EpisodeLength, RadioTone, TargetAudience, GuestIntensity, OutputFormat } from './types';
import UploadSection from './components/UploadSection';
import EpisodeReview from './components/EpisodeReview';
import EpisodeScript from './components/EpisodeScript';
import { ShieldCheck, Music, Radio, Disc, AlertCircle, Info, Sparkles, BookOpen, Sun, Moon } from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('echowave-theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('echowave-theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      root.classList.add('light');
    } else {
      root.removeAttribute('data-theme');
      root.classList.remove('light');
    }
  }, [theme]);

  const [episode, setEpisode] = useState<RadioShowEpisode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'show'>('upload');
  
  // Custom loader subtitles
  const [loaderMessage, setLoaderMessage] = useState('Drafting snappy host banter...');

  const handleGenerate = async (params: {
    pastedText: string;
    files: Array<{ name: string; content: string; type: string }>;
    episodeLength: EpisodeLength;
    tone: RadioTone;
    audience: TargetAudience;
    guestIntensity: GuestIntensity;
    callerToggle: boolean;
    parodyToggle: boolean;
    outputFormat: OutputFormat;
    host1Name: string;
    host1Voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
    host1Profile: string;
    host2Name: string;
    host2Voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
    host2Profile: string;
    sponsorBreak: string;
    banterDensity: 'formal' | 'witty' | 'caffeine';
    activeAmbience: 'none' | 'vinyl_rain' | 'radio_static' | 'coffee_house';
  }) => {
    setIsGenerating(true);
    setErrorMessage(null);
    setEpisode(null);
    
    // Rotate loading messages for high fidelity feedback
    const loadingSentences = [
      'Extracting and cataloging document facts...',
      'Mapping technical tensions & conflicts...',
      'Summoning sarcastic parodistic experts...',
      'Tuning the caller board frequencies...',
      'Penning witty interruptions and puns...',
      'Burying dead AI phrases (e.g. "Let\'s dive in")...',
      'Refining dialogue transitions & comedic timing...'
    ];
    let counter = 0;
    const interval = setInterval(() => {
      setLoaderMessage(loadingSentences[counter % loadingSentences.length]);
      counter++;
    }, 2500);

    try {
      const response = await fetch('/api/generate-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to connect to the compilation stream.');
      }

      setEpisode(data);
      setActiveTab('show');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred while contacting the Gemini radio editor backend.');
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-slate-100 font-sans antialiased pb-12 selection:bg-accent-amber selection:text-slate-950 selection:font-bold transition-colors duration-200">
      
      {/* Dynamic Static Header Bar matching Sophisticated Dark Spec */}
      <header className="border-b border-white/5 bg-[#16181d]/85 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ff9500] flex items-center justify-center text-slate-950 shadow-md shadow-[#ff9500]/25">
              <Radio className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5 leading-none">
                EchoWave <span className="text-[#ff9500] font-light opacity-80">Studio</span>
              </h1>
              <p className="text-[10px] text-[#8e8e93] font-medium uppercase tracking-widest mt-0.5">Broadcast System</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Accessibility Light/Dark Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 text-slate-400 hover:text-white transition-all duration-150 cursor-pointer flex items-center justify-center mr-1"
              aria-label="Toggle visual theme"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              id="theme-toggle-btn"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#ff9500] animate-pulse" />
              ) : (
                <Moon className="w-4 h-4 text-[#4a90e2]" />
              )}
            </button>

            {/* Elegant ON AIR live broadcast status light inspired by Design Template info */}
            <span className="hidden sm:inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/25 px-3 py-1.5 rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff3b30] animate-pulse-red shrink-0"></span>
              REALLY ON AIR
            </span>

            <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-1.5 rounded-lg font-mono">
              [SYSTEM ACTIVE]
            </span>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
        
        {/* Intro Hero Section using --panel-bg and custom luxury dark layout */}
        <div className="bg-[#16181d] rounded-2xl p-6 border border-white/5 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff95005]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-2 relative z-10 max-w-xl">
            <span className="text-xs font-bold text-[#ff9500] uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#ff9500]" />
              CREATIVE TRANSMITTER UNIT
            </span>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-sans">
              Transform written documents into witty radio scripts
            </h2>
            <p className="text-[#8e8e93] text-xs sm:text-sm leading-relaxed font-sans font-light">
              EchoWave processes text matrices (Markdown/TXT/DOCX), translating structural points, data metrics, and arguments into a back-and-forth radio discussion. Adjust tone dials, summon panels, and speak dialogue streams below.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full md:w-auto relative z-10">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 sm:flex-none text-xs font-bold uppercase px-5 py-3 rounded-lg border tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-[#ff9500] border-[#ff9500] text-slate-950 font-extrabold shadow-lg shadow-[#ff9500]/20'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              Control Center
            </button>
            <button
              disabled={!episode}
              onClick={() => setActiveTab('show')}
              className={`flex-1 sm:flex-none text-xs font-bold uppercase px-5 py-3 rounded-lg border tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === 'show'
                  ? 'bg-[#ff9500] border-[#ff9500] text-slate-950 font-extrabold'
                  : 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
              }`}
            >
              Studio script Monitor
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/35 rounded-xl p-4 flex gap-3 text-sm text-rose-300">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Compilation Failure:</span> {errorMessage}
            </div>
          </div>
        )}

        {/* LOADING ANIMATED OVERLAY */}
        {isGenerating && (
          <div className="bg-[#16181d] border border-white/5 rounded-2xl p-12 text-center shadow-2xl space-y-6 relative overflow-hidden flex flex-col items-center justify-center">
            {/* Ambient loading frequency waves */}
            <div className="flex items-end justify-center gap-1.5 h-16 w-full max-w-xs">
              <div className="w-2 bg-accent-amber rounded-full animate-[pulse_1s_infinite]" style={{ height: '35%', animationDelay: '0.1s' }}></div>
              <div className="w-2 bg-accent-amber rounded-full animate-[pulse_1s_infinite]" style={{ height: '80%', animationDelay: '0.3s' }}></div>
              <div className="w-2 bg-accent-amber rounded-full animate-[pulse_1s_infinite]" style={{ height: '55%', animationDelay: '0.2s' }}></div>
              <div className="w-2 bg-accent-amber rounded-full animate-[pulse_1s_infinite]" style={{ height: '95%', animationDelay: '0.5s' }}></div>
              <div className="w-2 bg-accent-amber rounded-full animate-[pulse_1s_infinite]" style={{ height: '40%', animationDelay: '0.4s' }}></div>
              <div className="w-2 bg-accent-amber rounded-full animate-[pulse_1s_infinite]" style={{ height: '70%', animationDelay: '0.6s' }}></div>
            </div>

            <div className="relative z-10 max-w-sm space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">Broadcasting & Generating...</h3>
              <p className="text-accent-amber text-sm font-semibold tracking-wider animate-pulse">{loaderMessage}</p>
              <p className="text-[11px] text-[#8e8e93] pt-1">This typically takes 10 to 15 seconds to parse documents, design voices, and render a complete scripted production.</p>
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW BLOCKS */}
        {!isGenerating && (
          <>
            {activeTab === 'upload' && (
              <UploadSection onGenerate={handleGenerate} isGenerating={isGenerating} />
            )}

            {activeTab === 'show' && episode && (
              <div className="space-y-8 animate-fade-in">
                
                {/* Fact analytics & roadmap assessment */}
                <EpisodeReview episode={episode} />

                {/* Show script visualization & TTS narration */}
                <EpisodeScript episode={episode} />

              </div>
            )}
          </>
        )}

        {/* EXPLAINER SECTIONS */}
        <section className="bg-[#16181d] border border-white/5 rounded-2xl p-6 shadow-2xl space-y-4">
          <h3 className="text-xs font-bold text-[#8e8e93] uppercase tracking-widest flex items-center gap-2">
            <Info className="w-4 h-4 text-accent-amber" />
            EchoWave Architecture & Design Blueprints
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-sans text-[#8e8e93]">
            <div className="p-4 bg-[#0a0b0e] rounded-xl border border-white/5 space-y-2">
              <span className="font-bold text-white block uppercase tracking-wider text-[10px] text-accent-amber">A. Full-Stack Assembly</span>
              <p className="leading-relaxed">
                Operates through server-side secure processes using an Express.js backend. High-level Gemini standard calls protect the API key entirely, complying with browser sandboxing standards.
              </p>
            </div>

            <div className="p-4 bg-[#0a0b0e] rounded-xl border border-white/5 space-y-2">
              <span className="font-bold text-white block uppercase tracking-wider text-[10px] text-accent-amber">B. File Extraction Suite</span>
              <p className="leading-relaxed">
                Utilizes <code className="text-accent-amber px-1 font-mono bg-white/5 rounded">mammoth</code> to extract parsed text from Word (.docx) documents, supplemented by plain text FileReaders for .txt, .md, and JSON formats.
              </p>
            </div>

            <div className="p-4 bg-[#0a0b0e] rounded-xl border border-white/5 space-y-2">
              <span className="font-bold text-white block uppercase tracking-wider text-[10px] text-accent-amber">C. Dynamic Vocal Synthesis</span>
              <p className="leading-relaxed">
                Employs heritable parameters to route dialogue lines asynchronously to <code className="text-accent-amber px-1 font-mono bg-white/5 rounded">gemini-3.1-flash-tts-preview</code>, returning real PCM base64 wav files based on assigned speaker personalities.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer Block */}
      <footer className="mt-16 border-t border-white/5 text-center py-6 text-xs text-[#8e8e93] font-medium">
        EchoWave Studio Suite • Crafted in full-stack Node.js + React. Checked for strict model guidelines.
      </footer>

    </div>
  );
}
