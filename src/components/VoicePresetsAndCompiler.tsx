import React, { useState, useEffect, useRef } from 'react';
import { RadioShowEpisode, ScriptLine } from '../types';
import { 
  Users, 
  Settings2, 
  Play, 
  Sparkles, 
  Download, 
  Volume2, 
  Layers, 
  Sliders, 
  FileAudio, 
  HelpCircle, 
  Check, 
  RefreshCw, 
  Loader2, 
  Pause 
} from 'lucide-react';

export interface CustomSpeakerPreset {
  name: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  emotionStyle: 'standard' | 'cheerfully' | 'excitedly' | 'whispering' | 'sardonically' | 'soberly' | 'urgently' | 'gently';
  playbackRate: number;
  role: 'host1' | 'host2' | 'guest' | 'caller';
}

export type SpeakerRegistry = Record<string, CustomSpeakerPreset>;

interface VoicePresetsAndCompilerProps {
  episode: RadioShowEpisode;
  speakerRegistry: SpeakerRegistry;
  setSpeakerRegistry: React.Dispatch<React.SetStateAction<SpeakerRegistry>>;
  audioCache: Record<string, string>; // Maps line ID -> Object URL
  setAudioCache: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const VOICE_OPTIONS = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
const EMOTION_OPTIONS = [
  { value: 'standard', label: 'Standard Speaking' },
  { value: 'cheerfully', label: 'Cheerful/Warm' },
  { value: 'excitedly', label: 'Excited' },
  { value: 'whispering', label: 'Whisper/Intimate' },
  { value: 'sardonically', label: 'Dry Sarcasm' },
  { value: 'soberly', label: 'Sober/Serious' },
  { value: 'urgently', label: 'Urgently/Frenzied' },
  { value: 'gently', label: 'Gentle/Soft' }
] as const;

export default function VoicePresetsAndCompiler({
  episode,
  speakerRegistry,
  setSpeakerRegistry,
  audioCache,
  setAudioCache
}: VoicePresetsAndCompilerProps) {
  const { script, hosts } = episode;
  
  // Local state for configuration panel toggle
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'cast' | 'compiler'>('cast');

  // Compiler parameters
  const [exchangePause, setExchangePause] = useState<number>(0.5); // seconds between speakers
  const [cueDuration, setCueDuration] = useState<number>(1.5); // seconds of pause for cues
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [compileStatusText, setCompileStatusText] = useState('');
  const [audioTestingId, setAudioTestingId] = useState<string | null>(null);
  const testingAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize and extract unique speakers from the script
  useEffect(() => {
    const uniqueSpeakers = new Set<string>();
    const speakerRoles: Record<string, 'host1' | 'host2' | 'guest' | 'caller'> = {};

    script.forEach(line => {
      uniqueSpeakers.add(line.speaker);
      speakerRoles[line.speaker] = line.role;
    });

    const loadedRegistry: SpeakerRegistry = { ...speakerRegistry };
    let updated = false;

    uniqueSpeakers.forEach(name => {
      if (!loadedRegistry[name]) {
        updated = true;
        const role = speakerRoles[name] || 'guest';
        
        // Smart voice default assignment based on roles
        let voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Zephyr';
        if (role === 'host1') {
          voiceName = hosts.host1.voiceName as any || 'Charon';
        } else if (role === 'host2') {
          voiceName = hosts.host2.voiceName as any || 'Kore';
        } else if (role === 'guest') {
          // Alternative female/male defaults
          voiceName = 'Kore';
        } else if (role === 'caller') {
          voiceName = 'Puck';
        }

        loadedRegistry[name] = {
          name,
          voiceName,
          emotionStyle: 'standard',
          playbackRate: 1.0,
          role
        };
      }
    });

    if (updated) {
      setSpeakerRegistry(loadedRegistry);
      localStorage.setItem('echowave-cast-v3', JSON.stringify(loadedRegistry));
    }
  }, [script, hosts, setSpeakerRegistry]);

  // Handle speaker updates
  const handleUpdateSpeaker = (name: string, fields: Partial<CustomSpeakerPreset>) => {
    const updated = {
      ...speakerRegistry,
      [name]: {
        ...speakerRegistry[name],
        ...fields
      }
    };
    setSpeakerRegistry(updated);
    localStorage.setItem('echowave-cast-v3', JSON.stringify(updated));
  };

  // Quick voice testing
  const handleTestVoice = async (speaker: string) => {
    if (testingAudioRef.current) {
      testingAudioRef.current.pause();
      testingAudioRef.current = null;
    }

    if (audioTestingId === speaker) {
      setAudioTestingId(null);
      return;
    }

    setAudioTestingId(speaker);
    const config = speakerRegistry[speaker];
    const testText = `Greetings! I am ${speaker}. I am configured using the ${config.voiceName} voice with a ${config.emotionStyle} tone. How do I sound?`;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          voiceName: config.voiceName,
          emotionStyle: config.emotionStyle
        })
      });

      const data = await res.json();
      if (data.audio) {
        const binaryString = window.atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const mime = data.mimeType || 'audio/wav';
        const blob = new Blob([bytes], { type: mime });
        const audSource = URL.createObjectURL(blob);
        const aud = new Audio(audSource);
        aud.playbackRate = config.playbackRate;
        testingAudioRef.current = aud;

        aud.onended = () => {
          setAudioTestingId(null);
          URL.revokeObjectURL(audSource);
        };
        aud.onerror = () => {
          setAudioTestingId(null);
          URL.revokeObjectURL(audSource);
        };

        await aud.play();
      } else {
        alert('Could not generate voice test.');
        setAudioTestingId(null);
      }
    } catch (err) {
      console.error(err);
      alert('Error testing voice.');
      setAudioTestingId(null);
    }
  };

  // COMPILER STITCHING CORE
  const handleCompileFullShow = async () => {
    if (isCompiling) return;
    setIsCompiling(true);
    setCompileProgress(1);
    setCompileStatusText('Initializing audio context compiler...');

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const localCache = { ...audioCache };
    const decodedBuffers: { buffer: AudioBuffer; rate: number; hasCue: boolean }[] = [];

    try {
      // Step 1: Sequential Fetch and Decode all lines
      for (let i = 0; i < script.length; i++) {
        const line = script[i];
        const speakerConfig = speakerRegistry[line.speaker] || {
          voiceName: 'Zephyr',
          emotionStyle: 'standard',
          playbackRate: 1.0
        };

        setCompileStatusText(`Downloading and generating voices: Line ${i + 1} of ${script.length} (${line.speaker})...`);
        setCompileProgress(Math.floor((i / script.length) * 80) + 1);

        let audioUrl = localCache[line.id];
        let audioBlob: Blob;

        if (!audioUrl) {
          // If not cached, let's fetch
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: line.text,
              voiceName: speakerConfig.voiceName,
              emotionStyle: speakerConfig.emotionStyle
            })
          });

          const data = await res.json();
          if (!data.audio) {
            throw new Error(`Failed to generate TTS audio block for line ${i + 1} (${line.speaker})`);
          }

          const binary = window.atob(data.audio);
          const bytes = new Uint8Array(binary.length);
          for (let u = 0; u < binary.length; u++) {
            bytes[u] = binary.charCodeAt(u);
          }

          audioBlob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
          audioUrl = URL.createObjectURL(audioBlob);
          
          // Cache on client
          localCache[line.id] = audioUrl;
        } else {
          // Retrieve from Object URL binary content
          const fetchedBlob = await fetch(audioUrl).then(r => r.blob());
          audioBlob = fetchedBlob;
        }

        // Decode the blob to an AudioBuffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

        decodedBuffers.push({
          buffer: decodedBuffer,
          rate: speakerConfig.playbackRate || 1.0,
          hasCue: !!line.cues
        });
      }

      // Update external cache
      setAudioCache(localCache);

      // Step 2: Calculate timeline and offline audio rendering
      setCompileStatusText('Arranging timeline & mixing audio outputs...');
      setCompileProgress(85);

      let currentTimelineTime = 0.5; // Start with a safe 0.5s pause
      const timelineArrangements: { buffer: AudioBuffer; start: number; rate: number }[] = [];

      for (let i = 0; i < decodedBuffers.length; i++) {
        const { buffer, rate, hasCue } = decodedBuffers[i];
        
        timelineArrangements.push({
          buffer,
          start: currentTimelineTime,
          rate
        });

        // Calculate the duration this line takes based on custom speed
        const duration = buffer.duration / rate;
        
        // Add exchange pause + potential extra cue padding
        const spacing = exchangePause + (hasCue ? cueDuration : 0);
        currentTimelineTime += duration + spacing;
      }

      const totalDuration = currentTimelineTime + 1.0; // Let it end with 1 sec buffer
      const sampleRate = 24050; // Align sample rate
      const totalSamples = Math.floor(totalDuration * sampleRate);

      setCompileStatusText('Encoding studio-grade podcast stream (Offline Context rendering)...');
      setCompileProgress(90);

      // Setup offline context
      const offlineContext = new OfflineAudioContext(1, totalSamples, sampleRate);

      // Play each scheduled segment
      timelineArrangements.forEach(({ buffer, start, rate }) => {
        const source = offlineContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        source.connect(offlineContext.destination);
        source.start(start);
      });

      // Render the comprehensive single buffer
      const renderedBuffer = await offlineContext.startRendering();

      setCompileStatusText('Encoding raw output to master WAV format download...');
      setCompileProgress(95);

      // Convert buffer to WAV Blob on the client
      const wavBlob = bufferToWav(renderedBuffer);
      const outputUrl = URL.createObjectURL(wavBlob);

      // Download file automatically
      const link = document.createElement('a');
      link.href = outputUrl;
      link.download = `EchoWave_FullShow_${hosts.host1.name}_${hosts.host2.name}.wav`;
      link.click();

      // Finish up
      setCompileProgress(100);
      setCompileStatusText('Download ready! Stitching completed successfully.');
      setTimeout(() => {
        setIsCompiling(false);
        setCompileProgress(0);
      }, 4000);

    } catch (e: any) {
      console.error(e);
      setCompileStatusText(`Compilation error: ${e.message || 'Check terminal logs'}`);
      setTimeout(() => {
        setIsCompiling(false);
        setCompileProgress(0);
      }, 6000);
    }
  };

  // Master WAV File encoder matching high-standard guidelines
  const bufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // 1 = raw PCM
    const bitDepth = 16;
    
    // Get single channel or interleaved
    const channelData = buffer.getChannelData(0);
    const bufferLength = channelData.length * 2;
    const totalLength = bufferLength + 44;
    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);
    
    // Write RIFF WAVE header bytes
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + bufferLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
    view.setUint16(32, numOfChan * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, bufferLength, true);
    
    // Convert float PCM (-1 to 1) to standard 16-bit integer PCM
    let offset = 44;
    for (let i = 0; i < channelData.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    return new Blob([view], { type: 'audio/wav' });
  };

  return (
    <div className="bg-[#16181d] border border-white/5 rounded-2xl p-5 shadow-xl transition-all duration-300">
      
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#ff9500] animate-pulse" />
          <div>
            <h3 className="font-bold text-sm tracking-tight text-white font-sans flex items-center gap-1.5">
              Cast Registry & Smart Voice Studio
              <span className="text-[9px] bg-[#ff9500]/10 border border-[#ff9500]/25 text-[#ff9500] px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider">
                Ultra AI Engine
              </span>
            </h3>
            <p className="text-[11px] text-[#8e8e93]">Change assigned voices, enunciation emotion moods, talking speeds, and render the final podcast.</p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 text-xs font-bold text-slate-350 hover:text-white rounded-lg transition-all cursor-pointer select-none"
        >
          {isOpen ? 'Close Panel' : 'Configure Voices'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-4 animate-fade-in text-xs">
          
          {/* Navigation Control Tabs */}
          <div className="flex border-b border-white/5 pb-1">
            <button
              onClick={() => setActiveTab('cast')}
              className={`flex items-center gap-1.5 pb-2 px-3 focus:outline-none transition-all font-bold uppercase text-[10px] tracking-wider border-b-2 hover:text-white cursor-pointer ${
                activeTab === 'cast'
                  ? 'border-[#ff9500] text-white'
                  : 'border-transparent text-[#8e8e93]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              1. Cast Registry ({Object.keys(speakerRegistry).length} Speakers)
            </button>
            <button
              onClick={() => setActiveTab('compiler')}
              className={`flex items-center gap-1.5 pb-2 px-3 focus:outline-none transition-all font-bold uppercase text-[10px] tracking-wider border-b-2 hover:text-white cursor-pointer ${
                activeTab === 'compiler'
                  ? 'border-[#ff9500] text-white'
                  : 'border-transparent text-[#8e8e93]'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5" />
              2. Full Podcast Compiler
            </button>
          </div>

          {/* TAB 1: CAST REGISTRY */}
          {activeTab === 'cast' && (
            <div className="space-y-3.5">
              <p className="text-[#8e8e93] text-[11px] leading-relaxed font-light">
                EchoWave auto-scans the script, isolates every character, and saves custom voice signatures. Changes persist in your browser setting registry—perfect for recurring guests or specific dialogue scenarios!
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.values(speakerRegistry).map(speaker => {
                  const isTesting = audioTestingId === speaker.name;
                  let cardBorder = 'border-white/5 bg-black/10';
                  let nameStyle = 'text-white border-white/10 bg-slate-950/40 text-[#8e8e93]';

                  if (speaker.role === 'host1') {
                    cardBorder = 'border-blue-500/10 bg-blue-500/5';
                    nameStyle = 'bg-blue-500/10 border-blue-500/20 text-blue-300';
                  } else if (speaker.role === 'host2') {
                    cardBorder = 'border-pink-500/10 bg-pink-500/5';
                    nameStyle = 'bg-pink-500/10 border-pink-500/20 text-pink-300';
                  } else if (speaker.role === 'guest') {
                    cardBorder = 'border-emerald-500/10 bg-emerald-500/5';
                    nameStyle = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
                  } else if (speaker.role === 'caller') {
                    cardBorder = 'border-amber-500/10 bg-amber-500/5';
                    nameStyle = 'bg-amber-500/10 border-amber-500/20 text-amber-300';
                  }

                  return (
                    <div 
                      key={speaker.name}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 relative transition-all ${cardBorder}`}
                    >
                      {/* Name Badge and Play Test */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${nameStyle}`}>
                            {speaker.name}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-[#8e8e93]">
                            • {speaker.role}
                          </span>
                        </div>

                        {/* Audition testing button */}
                        <button
                          onClick={() => handleTestVoice(speaker.name)}
                          disabled={audioTestingId !== null && !isTesting}
                          className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition cursor-pointer select-none ${
                            isTesting
                              ? 'bg-[#ff9500]/20 border-[#ff9500]/40 text-[#ff9500] animate-pulse'
                              : 'bg-black/30 border-white/5 text-[#8e8e93] hover:text-white hover:bg-black/50'
                          }`}
                          title="Generate live voice test"
                        >
                          {isTesting ? (
                            <>
                              <Pause className="w-3 h-3 text-[#ff9500]" />
                              Auditioning...
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 text-[#8e8e93]" />
                              Quick Test
                            </>
                          )}
                        </button>
                      </div>

                      {/* Select Selectors */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Voice Name Select */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-[#8e8e93]">Voice Avatar</label>
                          <select
                            value={speaker.voiceName}
                            onChange={(e) => handleUpdateSpeaker(speaker.name, { voiceName: e.target.value as any })}
                            className="w-full bg-slate-950/80 border border-white/5 rounded-lg py-1 px-2 text-[10px] text-slate-200 font-bold focus:outline-none focus:border-[#ff9500]"
                          >
                            {VOICE_OPTIONS.map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>

                        {/* Emotion Accent Type */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-[#8e8e93]">Tone/Emotion</label>
                          <select
                            value={speaker.emotionStyle}
                            onChange={(e) => handleUpdateSpeaker(speaker.name, { emotionStyle: e.target.value as any })}
                            className="w-full bg-slate-950/80 border border-white/5 rounded-lg py-1 px-2 text-[10px] text-slate-200 font-bold focus:outline-none focus:border-[#ff9500]"
                          >
                            {EMOTION_OPTIONS.map(emo => (
                              <option key={emo.value} value={emo.value}>{emo.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Performance playbackRate slider */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[9px] font-bold text-[#8e8e93]">
                          <span>talking rate (speed)</span>
                          <span className="text-white bg-[#ff9500]/10 border border-[#ff9500]/10 px-1.5 py-0.2 rounded font-mono">
                            {speaker.playbackRate.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.80"
                          max="1.40"
                          step="0.05"
                          value={speaker.playbackRate}
                          onChange={(e) => handleUpdateSpeaker(speaker.name, { playbackRate: parseFloat(e.target.value) })}
                          className="w-full accent-[#ff9500] h-1.5 bg-[#0a0b0e] border border-white/5 rounded-lg cursor-pointer"
                        />
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: FULL PODCAST COMPILER */}
          {activeTab === 'compiler' && (
            <div className="space-y-4">
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1.5">
                <span className="flex items-center gap-1 text-[11px] font-bold text-white uppercase tracking-wider">
                  <Sliders className="w-3.5 h-3.5 text-[#ff9500]" />
                  Smart Compiler Tuning
                </span>
                <p className="text-[#8e8e93] text-[10px] leading-relaxed">
                  Stitch the entire exchange of dialogue lines sequentially! The compiler invokes the text-to-speech models, applies custom paces/pause intervals client-side, and encodes/downloads a single continuous master podcast show wave file structure.
                </p>
              </div>

              {/* Adjusters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-white/5 bg-black/10 space-y-3 text-[11px]">
                  
                  {/* Exchange Pauses in seconds */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">Host Exchange Dialogue Pause</span>
                      <span className="text-[#ff9500] font-mono font-bold leading-none">{exchangePause}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.2"
                      step="0.1"
                      value={exchangePause}
                      onChange={(e) => setExchangePause(parseFloat(e.target.value))}
                      className="w-full accent-[#ff9500] h-1 bg-[#0a0b0e] rounded"
                    />
                    <span className="text-[9px] text-[#8e8e93] block">Safety spacing (silence buffer duration) appended after dialogues.</span>
                  </div>

                  {/* Production Cue space in seconds */}
                  <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">Segment Cue Timing Offset</span>
                      <span className="text-[#ff9500] font-mono font-bold leading-none">{cueDuration}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="4.0"
                      step="0.5"
                      value={cueDuration}
                      onChange={(e) => setCueDuration(parseFloat(e.target.value))}
                      className="w-full accent-[#ff9500] h-1 bg-[#0a0b0e] rounded"
                    />
                    <span className="text-[9px] text-[#8e8e93] block">Extra spacing added for cues like [INTRO MUSIC] or [LAUGHTER].</span>
                  </div>

                </div>

                <div className="flex flex-col justify-between p-3.5 bg-black/15 border border-white/5 rounded-xl">
                  {/* Master specs info */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-[#8e8e93] uppercase tracking-wider text-[10px]">Compilation Specs summary:</span>
                    <ul className="space-y-1 text-[#8e8e93] text-[10px] pl-1 list-inside list-disc">
                      <li>Stitching <strong className="text-white">{script.length} dialogue lines</strong> consecutively.</li>
                      <li>Sample rate auto-mixed at <span className="text-white">24kHz WAV streams</span>.</li>
                      <li>Pre-cache downloads: <span className="text-emerald-400 font-bold">{Object.keys(audioCache).length} lines saved</span>.</li>
                      <li>Full show duration estimated around <span className="text-white">~{(script.length * 4.9 / 60 + 0.1).toFixed(1)} mins</span>.</li>
                    </ul>
                  </div>

                  {/* Compilation trigger button board */}
                  <div className="pt-4 space-y-2">
                    {isCompiling ? (
                      <div className="space-y-2">
                        {/* Progress line */}
                        <div className="w-full bg-[#0a0b0e] border border-white/5 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-amber-500 to-[#ff9500] h-full transition-all duration-300 rounded-full" 
                            style={{ width: `${compileProgress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] pl-0.5">
                          <span className="text-white max-w-[200px] truncate block font-bold font-mono text-[9px] text-[#ff9500] animate-pulse">
                            {compileStatusText}
                          </span>
                          <span className="font-mono text-[#8e8e93] font-bold text-right pl-2 shrink-0">{compileProgress}%</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleCompileFullShow}
                        className="w-full flex items-center justify-center gap-2 bg-[#ff9500] hover:bg-[#ff9500]/95 text-slate-950 font-bold uppercase py-2.5 px-4 rounded-xl text-[10px] transition cursor-pointer font-sans shadow-md"
                      >
                        <Download className="w-4 h-4 shrink-0" />
                        Compile and Download Full Podcast
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
