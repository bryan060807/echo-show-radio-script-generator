import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Sparkles, MessageSquare, AlertTriangle, Play, HelpCircle, Mic, Radio, Volume2, Sliders, Zap, Music, VolumeX, ShieldAlert, Award } from 'lucide-react';
import { SAMPLE_TEMPLATES } from '../data';
import { RadioTone, TargetAudience, GuestIntensity, EpisodeLength, OutputFormat } from '../types';

// ==========================================
// Web Audio API Synth Engine for Radio FX
// ==========================================
class RadioStationSynth {
  private ctx: AudioContext | null = null;
  private ambienceNodes: AudioNode[] = [];
  private volumeNode: GainNode | null = null;
  private clickTimer: any = null;

  constructor() {}

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public stopAmbience() {
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    this.ambienceNodes.forEach(node => {
      try { node.disconnect(); } catch {}
      try { (node as any).stop?.(); } catch {}
    });
    this.ambienceNodes = [];
    this.volumeNode = null;
  }

  public setVolume(vol: number) {
    if (this.volumeNode && this.ctx) {
      this.volumeNode.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  public playAmbience(type: 'none' | 'vinyl_rain' | 'radio_static' | 'coffee_house', volume: number) {
    const ctx = this.initCtx();
    this.stopAmbience();

    if (type === 'none' || !ctx) return;

    // Create Master Gain node for the ambient track
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this.volumeNode = masterGain;

    // Generate procedural white noise audio buffer
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    if (type === 'radio_static') {
      // 1. Procedural High Mains Hum (55Hz + Sawtooth)
      const humOsc = ctx.createOscillator();
      humOsc.type = 'sawtooth';
      humOsc.frequency.setValueAtTime(55, ctx.currentTime);

      const humFilter = ctx.createBiquadFilter();
      humFilter.type = 'lowpass';
      humFilter.frequency.setValueAtTime(90, ctx.currentTime);

      const humGain = ctx.createGain();
      humGain.gain.setValueAtTime(0.04, ctx.currentTime);

      // 2. Procedural High-Pass Crackle Noise
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1200, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(0.7, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.03, ctx.currentTime);

      // Connect Hum
      humOsc.connect(humFilter);
      humFilter.connect(humGain);
      humGain.connect(masterGain);

      // Connect Noise
      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);

      humOsc.start();
      noiseNode.start();

      this.ambienceNodes.push(humOsc, humFilter, humGain, noiseNode, noiseFilter, noiseGain, masterGain);
    } 
    else if (type === 'vinyl_rain') {
      // Rain Backdrop + Random Vinyl click transients
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.setValueAtTime(1000, ctx.currentTime);
      rainFilter.Q.setValueAtTime(0.3, ctx.currentTime);

      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.04, ctx.currentTime);

      noiseNode.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(masterGain);
      noiseNode.start();

      this.ambienceNodes.push(noiseNode, rainFilter, rainGain);

      // Click transient loop
      const playClick = () => {
        const clickOsc = ctx.createOscillator();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(Math.random() * 320 + 80, ctx.currentTime);

        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.003, ctx.currentTime);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.015);

        clickOsc.connect(clickGain);
        clickGain.connect(masterGain);
        clickOsc.start();
        clickOsc.stop(ctx.currentTime + 0.02);

        this.clickTimer = setTimeout(playClick, Math.random() * 1200 + 150);
      };
      playClick();

      this.ambienceNodes.push({
        disconnect: () => { if (this.clickTimer) clearTimeout(this.clickTimer); }
      } as any);
      this.ambienceNodes.push(masterGain);
    }
    else if (type === 'coffee_house') {
      // Warm low frequency cafe rumble & murmur
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const chatterFilter = ctx.createBiquadFilter();
      chatterFilter.type = 'bandpass';
      chatterFilter.frequency.setValueAtTime(380, ctx.currentTime);
      chatterFilter.Q.setValueAtTime(1.5, ctx.currentTime);

      const chatterGain = ctx.createGain();
      chatterGain.gain.setValueAtTime(0.07, ctx.currentTime);

      // Low rumble LFO
      const lfoOsc = ctx.createOscillator();
      lfoOsc.type = 'sine';
      lfoOsc.frequency.setValueAtTime(0.15, ctx.currentTime);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.02, ctx.currentTime);

      lfoOsc.connect(lfoGain);

      noiseNode.connect(chatterFilter);
      chatterFilter.connect(chatterGain);
      chatterGain.connect(masterGain);

      noiseNode.start();
      lfoOsc.start();

      this.ambienceNodes.push(noiseNode, chatterFilter, chatterGain, lfoOsc, lfoGain, masterGain);
    }
  }

  public playAirhorn() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(640, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(860, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    // Beep patterns
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.setValueAtTime(0.0, now + 0.12);
    gain.gain.setValueAtTime(0.15, now + 0.18);
    gain.gain.setValueAtTime(0.0, now + 0.30);
    gain.gain.setValueAtTime(0.15, now + 0.36);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.1);
    osc2.stop(now + 1.1);
  }

  public playBleep() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playSubDrop() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 1.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.3);
  }

  public playSciFiUplifter() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 1.6);

    const filter = ctx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.setValueAtTime(120, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 1.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.7);
  }
}

interface UploadSectionProps {
  onGenerate: (data: {
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
  }) => void;
  isGenerating: boolean;
}

export default function UploadSection({ onGenerate, isGenerating }: UploadSectionProps) {
  const [pastedText, setPastedText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; type: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Custom Controls State Setups
  const [episodeLength, setEpisodeLength] = useState<EpisodeLength>('5');
  const [tone, setTone] = useState<RadioTone>('funny');
  const [audience, setAudience] = useState<TargetAudience>('general');
  const [guestIntensity, setGuestIntensity] = useState<GuestIntensity>('few');
  const [callerToggle, setCallerToggle] = useState(true);
  const [parodyToggle, setParodyToggle] = useState(true);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('outline_script');
  
  // Host Profiles State
  const [host1Name, setHost1Name] = useState('Marcus');
  const [host1Voice, setHost1Voice] = useState<'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'>('Charon');
  const [host1Profile, setHost1Profile] = useState('Skeptical Cynic & Tech Realist');

  const [host2Name, setHost2Name] = useState('Sandra');
  const [host2Voice, setHost2Voice] = useState<'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'>('Kore');
  const [host2Profile, setHost2Profile] = useState('Rational Optimist & Curious Academic');

  // Ad sponsorships & conversational pacing
  const [sponsorBreak, setSponsorBreak] = useState('none');
  const [banterDensity, setBanterDensity] = useState<'formal' | 'witty' | 'caffeine'>('witty');

  // Backdrop procedural ambience & volume
  const [activeAmbience, setActiveAmbience] = useState<'none' | 'vinyl_rain' | 'radio_static' | 'coffee_house'>('none');
  const [ambienceVolume, setAmbienceVolume] = useState<number>(0.15);

  // Layout Active Tabs inside Radio Station Controls Card
  const [currentControlsTab, setCurrentControlsTab] = useState<'vocals' | 'dials' | 'soundboard'>('vocals');
  
  const [isExtractingText, setIsExtractingText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Singleton persistence for procedural synthesizer
  const synthRef = useRef<RadioStationSynth | null>(null);

  useEffect(() => {
    synthRef.current = new RadioStationSynth();
    return () => {
      synthRef.current?.stopAmbience();
    };
  }, []);

  // Update dynamic procedural ambience loop when active track or volume changes
  useEffect(() => {
    synthRef.current?.playAmbience(activeAmbience, ambienceVolume);
  }, [activeAmbience]);

  // Adjust volume separately to prevent glitching restart
  useEffect(() => {
    synthRef.current?.setVolume(ambienceVolume);
  }, [ambienceVolume]);

  const handleAmbienceChange = (type: 'none' | 'vinyl_rain' | 'radio_static' | 'coffee_house') => {
    setActiveAmbience(type);
  };

  // Load preset document template
  const handleLoadTemplate = (content: string) => {
    setPastedText(content);
  };

  // Extract text helper files
  const processUploadedFile = async (file: File) => {
    const filename = file.name;
    const type = file.type;

    if (type === 'text/plain' || type === 'text/markdown' || filename.endsWith('.txt') || filename.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setUploadedFiles(prev => [...prev, { name: filename, content: text, type: 'Plain Text' }]);
      };
      reader.readAsText(file);
    } else if (filename.endsWith('.docx')) {
      setIsExtractingText(true);
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          const response = await fetch('/api/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, filename, mimeType: type })
          });
          const result = await response.json();
          if (result.text) {
            setUploadedFiles(prev => [...prev, { name: filename, content: result.text, type: 'DOCX (Word Document)' }]);
          } else {
            alert('Failed to parse MS Word document on the server.');
          }
          setIsExtractingText(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error(err);
        alert('Server processing for Word files failed.');
        setIsExtractingText(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setUploadedFiles(prev => [...prev, { name: filename, content: text, type: 'Document text' }]);
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(processUploadedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(processUploadedFile);
    }
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const triggerSoundFX = (soundName: 'airhorn' | 'bleep' | 'subdrop' | 'uplifter') => {
    if (!synthRef.current) return;
    switch (soundName) {
      case 'airhorn':
        synthRef.current.playAirhorn();
        break;
      case 'bleep':
        synthRef.current.playBleep();
        break;
      case 'subdrop':
        synthRef.current.playSubDrop();
        break;
      case 'uplifter':
        synthRef.current.playSciFiUplifter();
        break;
    }
  };

  const handleTriggerGenerate = () => {
    onGenerate({
      pastedText,
      files: uploadedFiles,
      episodeLength,
      tone,
      audience,
      guestIntensity,
      callerToggle,
      parodyToggle,
      outputFormat,
      host1Name,
      host1Voice,
      host1Profile,
      host2Name,
      host2Voice,
      host2Profile,
      sponsorBreak,
      banterDensity,
      activeAmbience,
    });
  };

  return (
    <div className="bg-[#16181d] border border-white/5 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-6">
      
      {/* Templates / Helper Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 font-sans">
            <Sparkles className="w-5 h-5 text-[#ff9500]" />
            Episode Source Materials
          </h2>
          <p className="text-xs text-[#8e8e93]">Upload or paste documents, select parameters, and produce your show.</p>
        </div>
        
        {/* Sample Templates Quick-Load */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase text-[#8e8e93] tracking-widest">Load Sample:</span>
          {SAMPLE_TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              onClick={() => handleLoadTemplate(tmpl.content)}
              className="text-xs bg-white/5 hover:bg-[#ff9500] hover:text-slate-950 px-3 py-1.5 rounded-lg border border-white/5 transition duration-150 cursor-pointer font-medium text-slate-200"
              title={tmpl.title}
            >
              {tmpl.title.split(' ')[0]} {tmpl.title.split(' ')[1] || ''}
            </button>
          ))}
        </div>
      </div>

      {/* Input Options Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Upload & Paste Area (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#8e8e93]">
            1. Raw Material or Documents
          </label>
          
          {/* Drag & Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
              isDragging 
                ? 'border-[#ff9500] bg-[#ff9500]/5' 
                : 'border-white/10 bg-white/2 hover:bg-black/20 hover:border-[#ff9500]/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".txt,.md,.docx"
              className="hidden"
            />
            <Upload className="w-8 h-8 text-[#8e8e93] mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-200">Drag & Drop Documents Here</p>
            <p className="text-xs text-[#8e8e93] mt-1 font-light">Supports Markdown (.md), Text (.txt) or MS Word (.docx)</p>
            {isExtractingText && (
              <span className="inline-block mt-3 text-xs text-[#ff9500] animate-pulse">
                Extracting word document text...
              </span>
            )}
          </div>

          {/* List of uploaded files */}
          {uploadedFiles.length > 0 && (
            <div className="bg-[#0a0b0e] p-3 rounded-lg space-y-2 border border-white/5">
              <span className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-wider block">Uploaded Pack</span>
              {uploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-[#16181d] px-3 py-2 rounded border border-white/5 text-xs text-[#8e8e93]">
                  <span className="flex items-center gap-2 truncate text-slate-300">
                    <FileText className="w-3.5 h-3.5 text-[#ff9500] shrink-0" />
                    {f.name} <span className="text-[10px] text-slate-500">({f.type})</span>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeUploadedFile(i); }}
                    className="text-[#8e8e93] hover:text-[#ff3b30] font-bold px-1 transition"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pasted text */}
          <div className="space-y-2">
            <span className="text-xs text-[#8e8e93] font-medium flex items-center justify-between">
              <span>Or paste custom transcription / web article below:</span>
              {pastedText && (
                <button 
                  onClick={() => setPastedText('')} 
                  className="text-[#ff3b30] hover:underline"
                >
                  Clear paste area
                </button>
              )}
            </span>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste chapters, meeting logs, studies, policies, web articles, scientific texts, novels, etc..."
              rows={6}
              className="w-full text-xs sm:text-sm bg-black/40 border border-white/10 rounded-xl p-3 text-slate-300 placeholder-slate-700 focus:outline-none focus:border-[#ff9500] focus:ring-1 focus:ring-[#ff9500] transition-all resize-y font-sans"
            />
          </div>
        </div>

        {/* Right Side: Radio Production Params - DECK VERSION (7 cols on lg) */}
        <div className="lg:col-span-7 bg-[#0a0b0e] border border-white/5 rounded-2xl p-4 md:p-5 space-y-4 flex flex-col justify-between">
          
          <div>
            {/* Header with Live Signal Lamp */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#ff9500] animate-pulse" />
                2. Live Broadcast Control Deck
              </span>
              <span className="text-[9px] uppercase font-extrabold text-[#ff9500] bg-[#ff9500]/10 px-2 py-0.5 rounded border border-[#ff9500]/25">
                V3 Tier-1 Edition
              </span>
            </div>

            {/* Visual Dynamic Command Tabs */}
            <div className="flex gap-1.5 p-1 bg-black/45 rounded-xl border border-white/5 mt-3">
              <button
                type="button"
                onClick={() => setCurrentControlsTab('vocals')}
                className={`flex-1 text-[10px] font-bold uppercase py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentControlsTab === 'vocals'
                    ? 'bg-[#16181d] text-white shadow border border-white/5'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic className="w-3 h-3 text-[#ff9500]" />
                Vocal Cast Profiles
              </button>
              <button
                type="button"
                onClick={() => setCurrentControlsTab('dials')}
                className={`flex-1 text-[10px] font-bold uppercase py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentControlsTab === 'dials'
                    ? 'bg-[#16181d] text-white shadow border border-white/5'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3 h-3 text-[#ff9500]" />
                Transmission Dials
              </button>
              <button
                type="button"
                onClick={() => setCurrentControlsTab('soundboard')}
                className={`flex-1 text-[10px] font-bold uppercase py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentControlsTab === 'soundboard'
                    ? 'bg-[#16181d] text-white shadow border border-white/5'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3 h-3 text-[#ff9500]" />
                FX Board & Ambience
              </button>
            </div>

            {/* TAB CONTENT: VOCALS */}
            {currentControlsTab === 'vocals' && (
              <div className="space-y-4 pt-4 animate-fade-in">
                
                {/* Host 1 (Primary Broadcaster) Details */}
                <div className="p-3 bg-[#16181d]/50 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-[#ff9500] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ff9500] block" />
                      Host 1: Primary Broadcaster (Masculine voice)
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Mic Channel 1</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400 block">Host Name</label>
                      <input
                        type="text"
                        value={host1Name}
                        onChange={(e) => setHost1Name(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg py-1 px-2.5 text-xs text-white focus:outline-none focus:border-[#ff9500] font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400 block">TTS Voice Preset</label>
                      <select
                        value={host1Voice}
                        onChange={(e) => setHost1Voice(e.target.value as any)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-1 text-xs text-slate-300 focus:outline-none focus:border-[#ff9500] cursor-pointer"
                      >
                        <option value="Charon">Charon (Deep & Gravitas)</option>
                        <option value="Fenrir">Fenrir (Assertive & Rugged)</option>
                        <option value="Zephyr">Zephyr (Default Airplay)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase text-slate-400 block">Banter Profile & Behavioral Bias</label>
                    <select
                      value={host1Profile}
                      onChange={(e) => setHost1Profile(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff9500] cursor-pointer"
                    >
                      <option value="Skeptical Cynic & Tech Realist">Skeptical Cynic (Deeply sarcastically points out flaws & absurdities)</option>
                      <option value="Pretentious Silicon Valley VC Broadcaster">Pretentious Valley Techie (Obsessed with jargon, disruption & leverage)</option>
                      <option value="Laidback Late-Night Radio DJ">Mellow Late-Nighter (Extremely calm, dry jokes, speaks in prose)</option>
                      <option value="Grumpy Investigative Journalist">Hard-Nosed Sleuth (Suspicious of explanations, demands cold evidence)</option>
                    </select>
                  </div>
                </div>

                {/* Host 2 (Co-Broadcaster) Details */}
                <div className="p-3 bg-[#16181d]/50 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block" />
                      Host 2: Co-Broadcaster (Feminine voice)
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Mic Channel 2</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400 block">Host Name</label>
                      <input
                        type="text"
                        value={host2Name}
                        onChange={(e) => setHost2Name(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg py-1 px-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400 block">TTS Voice Preset</label>
                      <select
                        value={host2Voice}
                        onChange={(e) => setHost2Voice(e.target.value as any)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-400 cursor-pointer"
                      >
                        <option value="Kore">Kore (Clear & Bright)</option>
                        <option value="Puck">Puck (Fast-Paced & Playful)</option>
                        <option value="Zephyr">Zephyr (Default Airplay)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase text-slate-400 block">Banter Profile & Behavioral Bias</label>
                    <select
                      value={host2Profile}
                      onChange={(e) => setHost2Profile(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff9500] cursor-pointer"
                    >
                      <option value="Rational Optimist & Curious Academic">Rational Enthusiast (Hypothesis-driven, optimism-oriented, loves analogies)</option>
                      <option value="Sardonic Philosopher & Zen Critic">Sardonical Humanist (Witty, deep ethical questions, hates tech hype)</option>
                      <option value="Rapid-Fire Fact Checker">Hyper-Precise Academic (Interrupts with numbers, facts & corrections)</option>
                      <option value="Cheeky Drama Instigator">Lively Commentator (Loves building conversational tension, teasing, dramatic prompts)</option>
                    </select>
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: DIALS */}
            {currentControlsTab === 'dials' && (
              <div className="space-y-4 pt-4 animate-fade-in">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tone Selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-wider block">Show Tone Blend</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value as RadioTone)}
                      className="w-full bg-[#16181d] border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff9500] cursor-pointer"
                    >
                      <option value="funny">Comedy & Lighthearted</option>
                      <option value="serious">Rigorous Journalism</option>
                      <option value="investigative">Investigative Scandal</option>
                      <option value="dramatic">Sensational & High Tension</option>
                      <option value="educational">Intriguing Classroom</option>
                      <option value="chaotic">Chaotic Late-Night Radio</option>
                    </select>
                  </div>

                  {/* Target Audience */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-wider block">Target Audience</label>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as TargetAudience)}
                      className="w-full bg-[#16181d] border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff9500] cursor-pointer"
                    >
                      <option value="general">General Listener</option>
                      <option value="students">Curious Students</option>
                      <option value="experts">Arrogant Specialists</option>
                      <option value="kids">High-Energy Kids</option>
                      <option value="executives">Bored Executives</option>
                    </select>
                  </div>

                  {/* Episode Length */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-wider block">Format Length</label>
                    <select
                      value={episodeLength}
                      onChange={(e) => setEpisodeLength(e.target.value as EpisodeLength)}
                      className="w-full bg-[#16181d] border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff9500] cursor-pointer"
                    >
                      <option value="5">5 min (concise show script)</option>
                      <option value="15">15 min (substantial show coverage)</option>
                      <option value="30">30 min (dense full-scale show)</option>
                      <option value="60">60 min (broadcasting marathon masterclass)</option>
                    </select>
                  </div>

                  {/* Guest intensity */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-wider block">Guest Frequency</label>
                    <select
                      value={guestIntensity}
                      onChange={(e) => setGuestIntensity(e.target.value as GuestIntensity)}
                      className="w-full bg-[#16181d] border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff9500] cursor-pointer"
                    >
                      <option value="none">No Guests (Hosts Only)</option>
                      <option value="few">1 Selective Guest Expert</option>
                      <option value="many">Wild Panel (2-3 Guests)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Caller Toggle */}
                  <label className="flex items-center justify-between bg-[#16181d] hover:bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer select-none transition">
                    <div className="text-xs">
                      <p className="font-extrabold text-slate-200">Caller Segments</p>
                      <p className="text-[#8e8e93] text-[9.5px]">Include listener dial-ins</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={callerToggle}
                      onChange={() => setCallerToggle(!callerToggle)}
                      className="w-4 h-4 rounded text-[#ff9500] bg-[#16181d] border-white/10 accent-[#ff9500] cursor-pointer"
                    />
                  </label>

                  {/* Parody Toggle */}
                  <label className="flex items-center justify-between bg-[#16181d] hover:bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer select-none transition">
                    <div className="text-xs">
                      <p className="font-extrabold text-slate-200">Parody Cameos</p>
                      <p className="text-[#8e8e93] text-[9.5px]">Witty fictional character experts</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={parodyToggle}
                      onChange={() => setParodyToggle(!parodyToggle)}
                      className="w-4 h-4 rounded text-[#ff9500] bg-[#16181d] border-white/10 accent-[#ff9500] cursor-pointer"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sponsor Break selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-wider block">Fictional Sponsor Break</label>
                    <select
                      value={sponsorBreak}
                      onChange={(e) => setSponsorBreak(e.target.value)}
                      className="w-full bg-[#16181d] border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff9500] cursor-pointer"
                    >
                      <option value="none">Premium Ad-Free Broadcast</option>
                      <option value="existential_toaster">ToastyMind™: The Existential Sentient Toaster</option>
                      <option value="canine_translator">BarkSpeak™: AI-Powered Decrypter Dog Collar</option>
                      <option value="dehydrated_water">HydroDry™: Fictional Dehydrated Water Pills</option>
                      <option value="anti_ai_lotion">NeoShield™: Anti-AI Artistic Neural Cream</option>
                    </select>
                  </div>

                  {/* Banter interaction density */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-wider block">Banter density & overlap</label>
                    <select
                      value={banterDensity}
                      onChange={(e) => setBanterDensity(e.target.value as any)}
                      className="w-full bg-[#16181d] border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff9500] cursor-pointer"
                    >
                      <option value="formal">Formal Podium (Polite taking turns, complete sentences)</option>
                      <option value="witty">Witty Sparks (Warm chemistry, 2-3 playful teasings)</option>
                      <option value="caffeine">Caffeine Overload (Overlapping cross-talk, rapid interruptions)</option>
                    </select>
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: SOUNDBOARD & AMBIENCE */}
            {currentControlsTab === 'soundboard' && (
              <div className="space-y-4 pt-4 animate-fade-in">
                
                {/* Continuous procedural backdrop generator */}
                <div className="p-3 bg-[#16181d] rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-[#ff9500]" />
                      Backdrop Studio Atmosphere (Web-Synthesised)
                    </span>
                    <span className="text-[9px] uppercase font-bold text-[#8e8e93]">Live Synth</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'none', label: '🔇 No Ambience', desc: 'Dead studio silence' },
                      { id: 'vinyl_rain', label: '🌧️ Cozy Rain & Vinyl', desc: 'Warm crackles and raindrop impulses' },
                      { id: 'radio_static', label: '📟 80s Shortwave', desc: 'Proc static crackle + 55Hz hum line' },
                      { id: 'coffee_house', label: '☕ Espresso Parlor', desc: 'Downtown coffee house muffled acoustics' }
                    ].map(amb => (
                      <button
                        key={amb.id}
                        type="button"
                        onClick={() => handleAmbienceChange(amb.id as any)}
                        className={`p-2 rounded-xl text-left border transition cursor-pointer select-none ${
                          activeAmbience === amb.id
                            ? 'bg-[#ff9500]/10 border-[#ff9500]/40 text-white'
                            : 'bg-black/30 border-white/5 text-[#8e8e93] hover:bg-black/50 hover:text-slate-300'
                        }`}
                      >
                        <span className="font-extrabold text-[10px] block mb-0.5">{amb.label}</span>
                        <span className="text-[8px] block leading-tight text-slate-500">{amb.desc}</span>
                      </button>
                    ))}
                  </div>

                  {activeAmbience !== 'none' && (
                    <div className="pt-2 flex items-center gap-3">
                      <span className="text-[9px] uppercase font-bold text-slate-400 shrink-0">Atmosphere Gain:</span>
                      <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="range"
                        min="0.0"
                        max="0.40"
                        step="0.01"
                        value={ambienceVolume}
                        onChange={(e) => setAmbienceVolume(parseFloat(e.target.value))}
                        className="flex-grow accent-[#ff9500] cursor-pointer h-1.5 bg-black rounded-lg appearance-none"
                      />
                      <span className="text-[9px] font-mono font-bold text-slate-400 w-8 text-right">{Math.round(ambienceVolume * 250)}%</span>
                    </div>
                  )}
                </div>

                {/* Instant physical cue FX board */}
                <div className="p-3 bg-[#16181d] rounded-xl border border-white/5 space-y-3">
                  <span className="text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#ff9500] animate-pulse" />
                    Physical Instant SFX Soundboard
                  </span>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => triggerSoundFX('airhorn')}
                      className="bg-black/30 hover:bg-[#ff9500]/15 hover:text-white hover:border-[#ff9500]/40 p-2.5 rounded-xl border border-white/5 text-center transition cursor-pointer select-none active:scale-95"
                    >
                      <span className="block text-lg">📢</span>
                      <span className="block text-[9px] font-bold uppercase tracking-wider">Airhorn Stinger</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerSoundFX('bleep')}
                      className="bg-black/30 hover:bg-[#ff9500]/15 hover:text-white hover:border-[#ff9500]/40 p-2.5 rounded-xl border border-white/5 text-center transition cursor-pointer select-none active:scale-95"
                    >
                      <span className="block text-lg">🤬</span>
                      <span className="block text-[9px] font-bold uppercase tracking-wider">Censor Beep</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerSoundFX('subdrop')}
                      className="bg-black/30 hover:bg-[#ff9500]/15 hover:text-white hover:border-[#ff9500]/40 p-2.5 rounded-xl border border-white/5 text-center transition cursor-pointer select-none active:scale-95"
                    >
                      <span className="block text-lg">💥</span>
                      <span className="block text-[9px] font-bold uppercase tracking-wider">Sub Drop Boom</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerSoundFX('uplifter')}
                      className="bg-black/30 hover:bg-[#ff9500]/15 hover:text-white hover:border-[#ff9500]/40 p-2.5 rounded-xl border border-white/5 text-center transition cursor-pointer select-none active:scale-95"
                    >
                      <span className="block text-lg">⚡</span>
                      <span className="block text-[9px] font-bold uppercase tracking-wider">Sci-Fi Uplift</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* Output Mode Selection footer-deck */}
            <div className="space-y-1.5 pt-4 border-t border-white/5 mt-4">
              <label className="text-[9px] font-extrabold text-[#8e8e93] uppercase tracking-wider block">Output Format Delivery</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['script', 'outline_script', 'json_script', 'audio_ready'] as OutputFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setOutputFormat(fmt)}
                    className={`text-[9px] uppercase font-bold py-2.5 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                      outputFormat === fmt 
                        ? 'bg-[#ff9500] text-slate-950 border-[#ff9500] font-extrabold shadow-sm' 
                        : 'bg-white/3 text-[#8e8e93] border-white/5 hover:bg-white/10'
                    }`}
                  >
                    {fmt === 'script' ? 'Just Script' : fmt === 'outline_script' ? 'Brief + Script' : fmt === 'json_script' ? 'JSON structure' : 'Voice Ready'}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Alert parody disclaimer detail */}
          {parodyToggle && (
            <div className="bg-white/2 border border-[#ff3b30]/15 p-2.5 rounded-lg flex gap-2 items-start text-[10px] text-[#8e8e93] font-light mt-3">
              <AlertTriangle className="w-3.5 h-3.5 text-[#ff3b30] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#ff3b30] uppercase text-[9px] tracking-wide mr-1">Satire Safeguard:</span> All parodied guest panels are simulated, private humor units designed exclusively for commentary.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* BIG GOLDEN LAUNCH BUTTON */}
      <div className="pt-2 text-center">
        <button
          onClick={handleTriggerGenerate}
          disabled={isGenerating || (pastedText.trim() === '' && uploadedFiles.length === 0)}
          className={`group relative text-xs font-bold tracking-widest uppercase py-4 px-10 rounded-xl transition-all duration-250 w-full sm:w-auto shadow-xl cursor-pointer ${
            isGenerating || (pastedText.trim() === '' && uploadedFiles.length === 0)
              ? 'bg-white/5 text-[#8e8e93] cursor-not-allowed border border-white/5'
              : 'bg-[#ff9500] hover:bg-[#ff9500]/90 text-slate-950 font-extrabold hover:shadow-2xl hover:shadow-[#ff9500]/15 hover:scale-[1.01] border border-[#ff9500]'
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Broadcasting script generation...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Play className="w-4 h-4 fill-current text-slate-950 group-hover:scale-105 transition" />
              Generate Show
            </span>
          )}
        </button>
      </div>

    </div>
  );
}
