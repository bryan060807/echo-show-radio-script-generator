import React, { useState, useEffect } from 'react';
import { RadioShowEpisode, ScriptLine } from '../types';
import { Play, Volume2, Music, PhoneCall, Disc, AlertCircle, Sparkles, Copy, Check, Download, Layers, Pencil, Trash, Plus, X, ChevronLeft, ChevronRight, Pause, Radio, RefreshCcw } from 'lucide-react';
import VoicePresetsAndCompiler, { SpeakerRegistry } from './VoicePresetsAndCompiler';

interface EpisodeScriptProps {
  episode: RadioShowEpisode;
}

export default function EpisodeScript({ episode }: EpisodeScriptProps) {
  const { script, hosts } = episode;
  const [playingLineId, setPlayingLineId] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Real-time Web Audio API Visualizer state registries & refs
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const [visualizerTheme, setVisualizerTheme] = useState<'neon_amber' | 'cyber_scope' | 'liquid_mercury'>('neon_amber');
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(true);

  // Local editable copy of the movie/show script
  const [localScript, setLocalScript] = useState<ScriptLine[]>(() => script);

  // Synchronize when a new script is uploaded/regenerated
  useEffect(() => {
    setLocalScript(script);
  }, [script]);

  // States for holding active inline editing values
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editSpeaker, setEditSpeaker] = useState('');
  const [editCues, setEditCues] = useState('');
  const [editText, setEditText] = useState('');

  // Continuous Autoplay Player Engine states
  const [autoplayActive, setAutoplayActive] = useState(false);
  const [autoplayIndex, setAutoplayIndex] = useState<number | null>(null);
  const [autoScrollFollow, setAutoScrollFollow] = useState(true);

  // AI rephrase assistant states
  const [rephrasingLineId, setRephrasingLineId] = useState<string | null>(null);
  const [activeRephraseDropdownId, setActiveRephraseDropdownId] = useState<string | null>(null);

  // Dialogue clip downloader states
  const [downloadingLineId, setDownloadingLineId] = useState<string | null>(null);

  // Speaker custom presets registry synchronized via localStorage
  const [speakerRegistry, setSpeakerRegistry] = useState<SpeakerRegistry>(() => {
    try {
      const saved = localStorage.getItem('echowave-cast-v3');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Client-side cache of line audio URLs to prevent double fetches and throttle api calls
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  // Exporter specific state
  const [exportFormat, setExportFormat] = useState<'clean' | 'paragraphs' | 'standard'>('clean');
  const [exportSpeaker, setExportSpeaker] = useState<string>('all');
  const [stripEmotionText, setStripEmotionText] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isExporterOpen, setIsExporterOpen] = useState(false);

  // Formatter utilities
  const getFormattedText = () => {
    let linesToProcess = localScript;
    if (exportSpeaker !== 'all') {
      linesToProcess = localScript.filter(line => line.role === exportSpeaker);
    }

    return linesToProcess
      .map(line => {
        let text = line.text;

        // Strip parenthesized or bracketed text if option checked (e.g., [Laughs], (chuckles))
        if (stripEmotionText) {
          text = text.replace(/\[[^\]]*\]/g, '');
          text = text.replace(/\([^)]*\)/g, '');
          text = text.replace(/\s+/g, ' ').trim();
        }

        if (exportFormat === 'paragraphs') {
          return text;
        }

        const prefix = line.speaker;
        if (exportFormat === 'clean') {
          return `${prefix}: ${text}`;
        } else {
          const cues = line.cues ? ` [CUE: ${line.cues}]` : '';
          return `${prefix}:${cues} ${text}`;
        }
      })
      .filter(t => t.trim() !== '')
      .join('\n\n');
  };

  const activeSpeakerName = () => {
    if (exportSpeaker === 'all') return 'All_Speakers';
    if (exportSpeaker === 'host1') return hosts.host1.name;
    if (exportSpeaker === 'host2') return hosts.host2.name;
    return exportSpeaker;
  };

  const handleCopyText = async () => {
    const text = getFormattedText();
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  const handleDownloadFile = () => {
    const text = getFormattedText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EchoWave_Script_${activeSpeakerName()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Trigger TTS dynamically for a script line (accepts an optional onEndedCallback for continuous flow)
  const handlePlayLine = async (line: ScriptLine, callbackOnEnd?: () => void) => {
    // If already playing another line, pause it
    if (playingAudio) {
      playingAudio.pause();
      setPlayingAudio(null);
    }

    if (playingLineId === line.id && !callbackOnEnd) {
      setPlayingLineId(null);
      setAutoplayActive(false);
      return;
    }

    setPlayingLineId(line.id);

    try {
      // Find corresponding custom casting preset config
      const config = speakerRegistry[line.speaker] || {
        voiceName: 'Zephyr',
        emotionStyle: 'standard',
        playbackRate: 1.0
      };

      const selectedVoice = config.voiceName;
      const selectedStyle = config.emotionStyle;
      const speed = config.playbackRate || 1.0;

      let audioSource = audioCache[line.id];

      if (!audioSource) {
        console.log(`Requesting TTS for line ID ${line.id} with voice ${selectedVoice} and style ${selectedStyle}`);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: line.text,
            voiceName: selectedVoice,
            emotionStyle: selectedStyle
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
          audioSource = URL.createObjectURL(blob);

          setAudioCache(prev => ({
            ...prev,
            [line.id]: audioSource
          }));
        } else {
          alert('Could not produce audio. Ensure process.env.GEMINI_API_KEY is configured correctly.');
          setPlayingLineId(null);
          setAutoplayActive(false);
          return;
        }
      }

      const audio = new Audio(audioSource);
      audio.playbackRate = speed;
      setPlayingAudio(audio);
      connectVisualizer(audio);

      const cleanupAndStop = () => {
        setPlayingLineId(null);
        setPlayingAudio(null);
        if (callbackOnEnd) {
          callbackOnEnd();
        }
      };

      audio.onended = cleanupAndStop;
      audio.onerror = (e) => {
        console.error('Audio playback error details:', e, audio.error);
        cleanupAndStop();
      };

      await audio.play();
    } catch (err) {
      console.error('Error generating script voice speak:', err);
      alert('Error connecting to voice generator.');
      setPlayingLineId(null);
      setAutoplayActive(false);
    }
  };

  // Connect active audio elements to the real-time Analyser node to support live visuals
  const connectVisualizer = (audioElement: HTMLAudioElement) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.75;
      }

      const audioContext = audioContextRef.current;
      const analyser = analyserRef.current!;

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Hook element. Note: browser restrictions allow one MediaElementAudioSourceNode per element.
      // Since we instantiate a fresh Audio() object for every single vocal line, we can safely
      // create a new node and connect it to our central analyzer!
      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      // Trigger standard canvas drawing loop
      startWaveformAnimation();
    } catch (err) {
      console.warn('Web Audio node creator notice (falling back to dynamic standby wave):', err);
      startWaveformAnimation();
    }
  };

  // High fidelity canvas drawing loop (displays ambient radio wave when idle, and real audio frequency data on active plays)
  const startWaveformAnimation = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);
    let waveOffset = 0;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      // Deep dark futuristic background with phosphor persistence trail
      ctx.fillStyle = 'rgba(10, 11, 14, 0.28)';
      ctx.fillRect(0, 0, width, height);

      // Check if audio has finished playing or is paused
      const isActuallySpeechActive = analyser && playingLineId && playingAudio && !playingAudio.paused;

      if (isActuallySpeechActive) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Beautiful flowing sine standby waves for radio offline mood
        waveOffset += 0.035;
        for (let i = 0; i < bufferLength; i++) {
          const sineFactor = Math.sin(i * 0.12 + waveOffset) * Math.cos(i * 0.045 + waveOffset * 0.35);
          dataArray[i] = Math.max(0, Math.min(255, 35 + Math.abs(sineFactor) * 55));
        }
      }

      // Draw depending on Visualizer Theme Style
      if (visualizerTheme === 'neon_amber') {
        const barWidth = (width / bufferLength) * 1.6;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = percent * height * 0.82;

          const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
          grad.addColorStop(0, 'rgba(255, 149, 0, 0.05)');
          grad.addColorStop(0.5, 'rgba(255, 149, 0, 0.65)');
          grad.addColorStop(1, '#ff9500');

          ctx.fillStyle = grad;
          ctx.fillRect(x, height - barHeight, barWidth - 1.5, barHeight);

          if (barHeight > 5) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, Math.max(0, height - barHeight - 2), barWidth - 1.5, 2);
          }

          x += barWidth;
        }

        // Draw amber baseline
        ctx.fillStyle = 'rgba(255, 149, 0, 0.1)';
        ctx.fillRect(0, height - 1.5, width, 1.5);
      } 
      else if (visualizerTheme === 'cyber_scope') {
        ctx.beginPath();
        ctx.lineWidth = isActuallySpeechActive ? 3.0 : 1.5;
        ctx.strokeStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = isActuallySpeechActive ? 12 : 3;

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const percent = dataArray[i] / 255;
          const waveHeight = (percent - 0.15) * height * (isActuallySpeechActive ? 0.8 : 0.3);
          const y = height / 2 + (i % 2 === 0 ? waveHeight : -waveHeight) * 0.45;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow

        // Grid lines in the background
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.03)';
        ctx.lineWidth = 1;
        for (let gl = 25; gl < width; gl += 25) {
          ctx.beginPath();
          ctx.moveTo(gl, 0);
          ctx.lineTo(gl, height);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      } 
      else {
        // dynamic symmetric violet mercury ripple centered inside canvas
        const barWidth = (width / (bufferLength / 2)) * 0.95;
        let x = 0;

        for (let i = 0; i < bufferLength / 2; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = percent * height * (isActuallySpeechActive ? 0.75 : 0.35);

          const grad = ctx.createLinearGradient(0, height / 2 - barHeight / 2, 0, height / 2 + barHeight / 2);
          grad.addColorStop(0, '#e100ff');
          grad.addColorStop(1, '#7f00ff');

          ctx.fillStyle = grad;
          ctx.fillRect(width / 2 + x, height / 2 - barHeight / 2, barWidth - 1.5, barHeight);
          ctx.fillRect(width / 2 - x - barWidth, height / 2 - barHeight / 2, barWidth - 1.5, barHeight);

          x += barWidth;
        }

        // Draw symmetric glowing core
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    };

    draw();
  };

  // Continuous Playback Engine Sequencers
  const toggleAutoplay = () => {
    if (autoplayActive) {
      setAutoplayActive(false);
    } else {
      // If we are currently at idle, start from the first line or current indices
      if (autoplayIndex === null || autoplayIndex >= localScript.length) {
        setAutoplayIndex(0);
      }
      setAutoplayActive(true);
    }
  };

  const handleAutoplayReset = () => {
    setAutoplayActive(false);
    setAutoplayIndex(null);
    if (playingAudio) {
      playingAudio.pause();
      setPlayingAudio(null);
    }
    setPlayingLineId(null);
  };

  const handleAutoplayNext = () => {
    if (autoplayIndex !== null && autoplayIndex + 1 < localScript.length) {
      if (playingAudio) {
        playingAudio.pause();
        setPlayingAudio(null);
      }
      setAutoplayIndex(autoplayIndex + 1);
    }
  };

  const handleAutoplayPrev = () => {
    if (autoplayIndex !== null && autoplayIndex > 0) {
      if (playingAudio) {
        playingAudio.pause();
        setPlayingAudio(null);
      }
      setAutoplayIndex(autoplayIndex - 1);
    }
  };

  // Autoplay reactive runner loop
  useEffect(() => {
    if (autoplayActive && autoplayIndex !== null && autoplayIndex < localScript.length) {
      const line = localScript[autoplayIndex];

      // Automatically smooth-scroll dialogue card into structural view
      if (autoScrollFollow) {
        const docEl = document.getElementById(`line-container-${line.id}`);
        if (docEl) {
          docEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      handlePlayLine(line, () => {
        setAutoplayIndex(prev => {
          if (prev !== null && prev + 1 < localScript.length) {
            return prev + 1;
          } else {
            // Reached conclusion of show
            setAutoplayActive(false);
            return null;
          }
        });
      });
    } else if (!autoplayActive) {
      // Pause playing audio on manual interrupt pause
      if (playingAudio) {
        playingAudio.pause();
        setPlayingAudio(null);
      }
      setPlayingLineId(null);
    }
  }, [autoplayActive, autoplayIndex]);

  // Clean-up effect on component unmount and visualizer mount initializer
  useEffect(() => {
    startWaveformAnimation();
    return () => {
      if (playingAudio) {
        playingAudio.pause();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [visualizerTheme]);

  // Download Dialogue segment as a high-quality WAV audio file
  const handleDownloadLineClip = async (line: ScriptLine) => {
    setDownloadingLineId(line.id);
    try {
      let audioSource = audioCache[line.id];

      if (!audioSource) {
        const config = speakerRegistry[line.speaker] || {
          voiceName: 'Zephyr',
          emotionStyle: 'standard'
        };

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: line.text,
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
          audioSource = URL.createObjectURL(blob);

          setAudioCache(prev => ({
            ...prev,
            [line.id]: audioSource
          }));
        } else {
          alert('Could not compile clip audio from server.');
          setDownloadingLineId(null);
          return;
        }
      }

      // Explicitly trigger anchor tag download
      const dLink = document.createElement('a');
      dLink.href = audioSource;
      dLink.download = `EchoWave_Studio_Segment_${line.speaker.replace(/\s+/g, '_')}_${line.id}.wav`;
      dLink.click();
    } catch (err) {
      console.error('Dialogue segment download err:', err);
      alert('Error triggering audio clip compile download.');
    } finally {
      setDownloadingLineId(null);
    }
  };

  // Call server-side /api/rephrase-line Gemini rephrase controller
  const handleAIRephrase = async (line: ScriptLine, toneStyle: string) => {
    setRephrasingLineId(line.id);
    setActiveRephraseDropdownId(null);

    // Stop active playings to prevent sound overlap/glitch
    if (autoplayActive) {
      setAutoplayActive(false);
    }
    if (playingAudio) {
      playingAudio.pause();
      setPlayingAudio(null);
    }
    setPlayingLineId(null);

    try {
      const res = await fetch('/api/rephrase-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: line.text,
          speaker: line.speaker,
          role: line.role || 'guest',
          style: toneStyle
        })
      });

      const data = await res.json();
      if (data.text) {
        // Rewrite dialogue script state
        setLocalScript(prev => prev.map(l => {
          if (l.id === line.id) {
            return {
              ...l,
              text: data.text.trim()
            };
          }
          return l;
        }));

        // Invalidate associated audioCache file so it has to rebuild to matches new text
        setAudioCache(prev => {
          const clone = { ...prev };
          if (clone[line.id]) {
            try {
              URL.revokeObjectURL(clone[line.id]);
            } catch {}
            delete clone[line.id];
          }
          return clone;
        });
      } else {
        alert('Server API was unable to polish text. Check if process.env.GEMINI_API_KEY is declared.');
      }
    } catch (err) {
      console.error('Dialogue rephrase API error:', err);
      alert('Network failure connecting to dialogue rephrase service.');
    } finally {
      setRephrasingLineId(null);
    }
  };

  // Save edited line changes
  const handleSaveLine = (lineId: string) => {
    setLocalScript(prev => prev.map(line => {
      if (line.id === lineId) {
        return {
          ...line,
          speaker: editSpeaker.trim(),
          cues: editCues.trim() || undefined,
          text: editText.trim()
        };
      }
      return line;
    }));

    // Clear client-side TTS cache for this line because text has updated
    setAudioCache(prev => {
      const copy = { ...prev };
      if (copy[lineId]) {
        try {
          URL.revokeObjectURL(copy[lineId]);
        } catch {}
        delete copy[lineId];
      }
      return copy;
    });

    setEditingLineId(null);
  };

  // Start edit line mode
  const handleStartEdit = (line: ScriptLine) => {
    setEditingLineId(line.id);
    setEditSpeaker(line.speaker);
    setEditCues(line.cues || '');
    setEditText(line.text);
  };

  // Delete dialogue line
  const handleDeleteLine = (lineId: string) => {
    if (confirm('Delete this dialogue line permanently?')) {
      setLocalScript(prev => prev.filter(line => line.id !== lineId));
      // Clear audioCache entry
      setAudioCache(prev => {
        const copy = { ...prev };
        if (copy[lineId]) {
          try {
            URL.revokeObjectURL(copy[lineId]);
          } catch {}
          delete copy[lineId];
        }
        return copy;
      });
    }
  };

  // Add custom dialogue line
  const handleAddLine = () => {
    const newLineId = `line-custom-${Date.now()}`;
    const defaultSpeaker = hosts.host1.name || 'Host';
    const newLine: ScriptLine = {
      id: newLineId,
      speaker: defaultSpeaker,
      role: 'host1',
      text: 'Type dialogue speech here...',
    };

    setLocalScript(prev => [...prev, newLine]);
    setEditingLineId(newLineId);
    setEditSpeaker(newLine.speaker);
    setEditCues('');
    setEditText(newLine.text);
  };

  // Sound cue styling helper
  const renderSoundCue = (cues?: string) => {
    if (!cues) return null;
    const isMusic = cues.toLowerCase().includes('music');
    const isPhone = cues.toLowerCase().includes('phone') || cues.toLowerCase().includes('ring');
    const isStinger = cues.toLowerCase().includes('stinger') || cues.toLowerCase().includes('break');

    let badgeStyle = 'bg-[#ff9500]/15 border-[#ff9500]/20 text-[#ff9500]';
    let Icon = Music;

    if (isMusic) {
      badgeStyle = 'bg-purple-500/15 border-purple-500/20 text-purple-400';
      Icon = Music;
    } else if (isPhone) {
      badgeStyle = 'bg-sky-500/15 border-sky-500/20 text-sky-450';
      Icon = PhoneCall;
    } else if (isStinger) {
      badgeStyle = 'bg-[#ff3b30]/15 border-[#ff3b30]/20 text-[#ff3b30]';
      Icon = Disc;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border mb-2 ${badgeStyle}`}>
        <Icon className="w-3 h-3" />
        {cues}
      </span>
    );
  };

  // Filter line list from localScript
  const filteredLines = localScript.filter(line => {
    const textMatch = line.text.toLowerCase().includes(searchFilter.toLowerCase()) || 
                      line.speaker.toLowerCase().includes(searchFilter.toLowerCase());
    const roleMatch = roleFilter === 'all' || line.role === roleFilter;
    return textMatch && roleMatch;
  });

  return (
    <div className="bg-[#16181d] border border-white/5 rounded-2xl p-6 shadow-2xl text-slate-100 flex flex-col space-y-4">
      
      {/* Script Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 font-sans">
            <Volume2 className="w-5 h-5 text-[#ff9500] animate-pulse" />
            Interactive Show Script
          </h2>
          <p className="text-xs text-[#8e8e93]">Read the dialogue script, see production cues, or hear any line read by actual AI voices.</p>
        </div>

        {/* Listen hint / disclaimer */}
        <div className="bg-black/40 border border-white/5 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs text-[#8e8e93]">
          <Sparkles className="w-4 h-4 text-[#ff9500] shrink-0" />
          <span>Click any line's speaker icon to speak!</span>
        </div>
      </div>

      {/* VOCAL & TTV EXPORTER PANEL */}
      <div className="bg-black/20 rounded-xl border border-white/5 p-4 space-y-3">
        <button
          onClick={() => setIsExporterOpen(!isExporterOpen)}
          className="w-full flex items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-white transition cursor-pointer select-none"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#ff9500]" />
            TTV Voice / Song Vocal Exporter Tool
          </span>
          <span className="text-[10px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-[#8e8e93]">
            {isExporterOpen ? 'Hide Panel' : 'Expand Exporter'}
          </span>
        </button>

        {isExporterOpen && (
          <div className="space-y-4 pt-2.5 border-t border-white/5 animate-fade-in text-xs">
            <p className="text-[#8e8e93] leading-relaxed font-light">
              This exporter cleanses, filters, and prepares your script text specifically for third-party AI voice synthesizer tools (like <code className="text-[#ff9500] font-mono px-1">aisonggenerator.io</code>, ElevenLabs, or TTS agents). Strip brackets/emotional labels so actors do not read sound effects aloud.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                {/* Format Presets */}
                <div className="space-y-1.5">
                  <span className="block font-bold text-[#8e8e93] uppercase tracking-wider text-[10px]">
                    Exporter Format Preset:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['clean', 'paragraphs', 'standard'] as const).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`py-1.5 px-2 rounded border text-center transition font-bold uppercase text-[9px] cursor-pointer ${
                          exportFormat === fmt
                            ? 'bg-[#ff9500] text-slate-950 border-[#ff9500]'
                            : 'bg-[#16181d] border-white/5 text-[#8e8e93]'
                        }`}
                      >
                        {fmt === 'clean' ? 'Clean Speech' : fmt === 'paragraphs' ? 'Only Text' : 'With cues'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speaker Select */}
                <div className="space-y-1.5">
                  <span className="block font-bold text-[#8e8e93] uppercase tracking-wider text-[10px]">
                    Filter to Specific Speaker:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setExportSpeaker('all')}
                      className={`py-1.5 px-2 rounded border text-center transition text-[9px] uppercase font-bold cursor-pointer ${
                        exportSpeaker === 'all'
                          ? 'bg-[#ff9500] text-slate-950 border-[#ff9500]'
                          : 'bg-[#16181d] border-white/5 text-[#8e8e93]'
                      }`}
                    >
                      All Roles
                    </button>
                    <button
                      onClick={() => setExportSpeaker('host1')}
                      className={`py-1.5 px-2 rounded border text-center transition text-[9px] uppercase font-bold cursor-pointer ${
                        exportSpeaker === 'host1'
                          ? 'bg-[#ff9500] text-slate-950 border-[#ff9500]'
                          : 'bg-[#16181d] border-white/5 text-[#8e8e93]'
                      }`}
                    >
                      {hosts.host1.name} (Host 1)
                    </button>
                    <button
                      onClick={() => setExportSpeaker('host2')}
                      className={`py-1.5 px-2 rounded border text-center transition text-[9px] uppercase font-bold cursor-pointer ${
                        exportSpeaker === 'host2'
                          ? 'bg-[#ff9500] text-slate-950 border-[#ff9500]'
                          : 'bg-[#16181d] border-white/5 text-[#8e8e93]'
                      }`}
                    >
                      {hosts.host2.name} (Host 2)
                    </button>
                    {script.some(l => l.role === 'guest') && (
                      <button
                        onClick={() => setExportSpeaker('guest')}
                        className={`py-1.5 px-2 rounded border text-center transition text-[9px] uppercase font-bold cursor-pointer ${
                          exportSpeaker === 'guest'
                            ? 'bg-[#ff9500] text-slate-950 border-[#ff9500]'
                            : 'bg-[#16181d] border-white/5 text-[#8e8e93]'
                        }`}
                      >
                        Guest Expert
                      </button>
                    )}
                    {script.some(l => l.role === 'caller') && (
                      <button
                        onClick={() => setExportSpeaker('caller')}
                        className={`py-1.5 px-2 rounded border text-center transition text-[9px] uppercase font-bold cursor-pointer ${
                          exportSpeaker === 'caller'
                            ? 'bg-[#ff9500] text-slate-950 border-[#ff9500]'
                            : 'bg-[#16181d] border-white/5 text-[#8e8e93]'
                        }`}
                      >
                        Fictional Caller
                      </button>
                    )}
                  </div>
                </div>

                {/* Brackets sanitization */}
                <label className="flex items-center justify-between p-2 rounded bg-[#16181d] border border-white/5 cursor-pointer hover:bg-white/5 transition">
                  <div className="space-y-0.5 text-left">
                    <span className="font-bold text-slate-200 block text-[10px]">Strip bracketed emotions</span>
                    <span className="text-[#8e8e93] text-[9px] block">Removes (Laughter), [sighs], etc.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={stripEmotionText}
                    onChange={(e) => setStripEmotionText(e.target.checked)}
                    className="w-4 h-4 text-[#ff9500] bg-[#16181d] border-white/10 accent-[#ff9500] cursor-pointer"
                  />
                </label>
              </div>

              {/* Preview and actions */}
              <div className="space-y-2 flex flex-col justify-end">
                <span className="block font-bold text-[#8e8e93] uppercase tracking-wider text-[10px] text-left">
                  Formatted Clipboard Preview:
                </span>
                <textarea
                  readOnly
                  value={getFormattedText()}
                  rows={4}
                  className="w-full bg-[#0a0b0e] border border-white/15 rounded p-2 text-[11px] font-mono text-slate-300 placeholder-slate-700 resize-none focus:outline-none"
                  placeholder="No dialogue lines available for the chosen filters."
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCopyText}
                    className="flex items-center justify-center gap-2 bg-[#ff9500] hover:bg-[#ff9500]/90 text-slate-950 font-bold uppercase py-2 px-3 rounded text-[10px] transition cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy text
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadFile}
                    className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-slate-200 font-bold uppercase py-2 px-3 rounded text-[10px] transition cursor-pointer border border-white/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CAST VOICE REGISTRY AND COMPILER STUDIO PANEL */}
      <VoicePresetsAndCompiler
        episode={{ ...episode, script: localScript }}
        speakerRegistry={speakerRegistry}
        setSpeakerRegistry={setSpeakerRegistry}
        audioCache={audioCache}
        setAudioCache={setAudioCache}
      />

      {/* REAL-TIME DYNAMIC WAVEFORM STUDIO MONITOR */}
      {isVisualizerOpen && (
        <div className="bg-[#121319] border border-white/5 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden">
          {/* Subtle grid background mask */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] uppercase font-black tracking-widest text-[#8e8e93] flex items-center gap-1.5 font-sans">
                Live Studio Waveform & Signal Oscilloscope
              </span>
            </div>

            {/* Visual themes slider selector */}
            <div className="flex items-center gap-1.5 bg-black/45 p-1 rounded-xl border border-white/5">
              {[
                { id: 'neon_amber', label: 'Amber Bars' },
                { id: 'cyber_scope', label: 'Cyan Matrix' },
                { id: 'liquid_mercury', label: 'Vocal Ripple' }
              ].map(themeOpt => (
                <button
                  key={themeOpt.id}
                  onClick={() => setVisualizerTheme(themeOpt.id as any)}
                  className={`text-[8.5px] uppercase font-black px-2.5 py-1 rounded-lg transition duration-150 cursor-pointer ${
                    visualizerTheme === themeOpt.id
                      ? 'bg-white/5 text-[#ff9500] shadow-sm font-extrabold border border-white/5'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {themeOpt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-24 bg-[#0a0b0e] border border-white/5 rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner">
            <canvas
              ref={canvasRef}
              width={750}
              height={96}
              className="w-full h-full block rounded-xl"
            />
            
            {/* Overlay indicators on the corner of the oscilloscope */}
            <div className="absolute top-2 left-3 font-mono text-[8px] text-slate-500 tracking-wider flex items-center gap-4 pointer-events-none select-none">
              <span>SENSITIVITY: <span className="text-slate-400 font-bold">AUTO-TUNE</span></span>
              <span>SAMPLING: <span className="text-slate-400 font-bold">24.0 kHz</span></span>
              <span>MONITOR UNIT: <span className="text-[#ff9500] font-black animate-pulse">{playingLineId ? 'SPEECH ON-AIR-SIGNAL' : 'PASSIVE CARRIER STANDBY'}</span></span>
            </div>

            {/* Micro-labels right footer */}
            <div className="absolute bottom-2 right-3 font-mono text-[7.5px] text-slate-600 pointer-events-none select-none flex items-center gap-1.5">
              <span>DBFS LEVEL_METER</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]" />
            </div>
          </div>
        </div>
      )}

      {/* CONTINUOUS BROADCAST PLAYER CONSOLE */}
      <div className="bg-black/35 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ff9500]/10 flex items-center justify-center border border-[#ff9500]/20 text-[#ff9500]">
            <Radio className={`w-5 h-5 ${autoplayActive ? 'animate-bounce text-[#ff9500]' : 'text-slate-400'}`} />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#ff9500] flex items-center gap-1.5">
              <span>Virtual Script Autoplayer</span>
              <span className="text-[8px] font-extrabold text-white bg-red-500 px-1.5 py-0.5 rounded animate-pulse">
                LIVE preview
              </span>
            </h3>
            <p className="text-[10px] text-[#8e8e93]">Continuous sequential vocal reading with automated scrolling focus.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Previous Button */}
          <button
            onClick={handleAutoplayPrev}
            disabled={autoplayIndex === null || autoplayIndex === 0}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer select-none"
            title="Previous line"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Master Play/Pause Sequential Button */}
          <button
            onClick={toggleAutoplay}
            className={`py-2 px-4 rounded-xl flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider cursor-pointer border select-none transition-all duration-150 ${
              autoplayActive
                ? 'bg-red-500 hover:bg-red-600 text-white border-red-500/10'
                : 'bg-[#ff9500] hover:bg-[#ff9500]/90 text-slate-950 border-orange-400/10 shadow-md'
            }`}
          >
            {autoplayActive ? (
              <>
                <Pause className="w-4 h-4 fill-white" strokeWidth={3} />
                Pause Show
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950 text-slate-950" strokeWidth={3} />
                Play Entire Show
              </>
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={handleAutoplayNext}
            disabled={autoplayIndex === null || autoplayIndex >= localScript.length - 1}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer select-none"
            title="Next line"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Reset Show */}
          <button
            onClick={handleAutoplayReset}
            className="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-extrabold uppercase tracking-widest text-[#8e8e93] hover:text-white transition cursor-pointer select-none"
            title="Reset to segment #1"
          >
            Reset
          </button>
        </div>

        {/* Scrolling Focus toggle & status */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-xs font-sans text-slate-400">
          <label className="flex items-center gap-2 cursor-pointer select-none md:border-r md:border-white/15 md:pr-4">
            <input
              type="checkbox"
              checked={autoScrollFollow}
              onChange={(e) => setAutoScrollFollow(e.target.checked)}
              className="w-4 h-4 rounded text-[#ff9500] bg-[#16181d] border-white/10 accent-[#ff9500] cursor-pointer"
            />
            <span className="text-[9.5px] uppercase font-bold text-slate-300 hover:text-white transition">Auto-Scroll Focus</span>
          </label>

          {/* Dynamic LED Index Tracker */}
          <div className="flex items-center gap-2 font-mono text-[9px] text-[#ff9500] bg-black/45 border border-white/5 px-3 py-2 rounded-xl h-8">
            <span className={`w-1.5 h-1.5 rounded-full ${autoplayActive ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
            <span>
              {autoplayActive && autoplayIndex !== null ? (
                <>
                  Line <span className="text-white font-black font-mono">#{autoplayIndex + 1}</span> of {localScript.length} ({localScript[autoplayIndex]?.speaker})
                </>
              ) : autoplayIndex !== null ? (
                <>
                  PAUSED AT <span className="text-white font-mono">#{autoplayIndex + 1}</span>
                </>
              ) : (
                'CHANNELS IDLE'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter lines or search text..."
          className="flex-1 bg-[#0a0b0e] border border-white/5 text-xs sm:text-sm font-sans text-slate-300 placeholder-slate-600 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#ff9500]"
        />

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {['all', 'host1', 'host2', 'guest', 'caller'].map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`text-[9px] uppercase font-bold tracking-wider py-1.5 px-3 rounded-lg border transition-all cursor-pointer ${
                roleFilter === role 
                  ? 'bg-[#ff9500] text-slate-950 border-[#ff9500] font-extrabold' 
                  : 'bg-white/3 text-[#8e8e93] border-white/5 hover:bg-white/10'
              }`}
            >
              {role === 'all' ? 'All Roles' : role.replace('1', ` (${hosts.host1.name})`).replace('2', ` (${hosts.host2.name})`)}
            </button>
          ))}
        </div>
      </div>

      {/* SCRIPT FEED - SCROLLABLE CONTAINER */}
      <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar pt-2">
        {filteredLines.length > 0 ? (
          filteredLines.map((line, idx) => {
            const isPlaying = playingLineId === line.id;
            const isEditing = editingLineId === line.id;
            const isHost1 = line.role === 'host1';
            const isHost2 = line.role === 'host2';
            const isGuest = line.role === 'guest';
            const isCaller = line.role === 'caller';

            // Distinct speaker coloring & styling cards
            let outerStyle = 'border-white/5 bg-[#0a0b0e]/30';
            let nameBadgeStyle = 'bg-white/5 text-slate-350';
            let roleLabel = '';

            if (isHost1) {
              outerStyle = 'border-blue-500/10 bg-blue-500/5 shadow-sm';
              nameBadgeStyle = 'bg-blue-500/10 border border-blue-500/20 text-blue-300';
              roleLabel = 'Host';
            } else if (isHost2) {
              outerStyle = 'border-pink-500/10 bg-pink-500/5 shadow-sm';
              nameBadgeStyle = 'bg-pink-500/10 border border-pink-500/20 text-pink-300';
              roleLabel = 'Host';
            } else if (isGuest) {
              outerStyle = 'border-emerald-500/10 bg-emerald-500/5';
              nameBadgeStyle = 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300';
              roleLabel = 'Guest';
            } else if (isCaller) {
              outerStyle = 'border-[#ff9500]/10 bg-[#ff9500]/5';
              nameBadgeStyle = 'bg-[#ff9500]/10 border border-[#ff9500]/20 text-[#ff9500]';
              roleLabel = 'Caller';
            }

            return (
              <div
                key={line.id}
                id={`line-container-${line.id}`}
                className={`flex gap-4 p-4 rounded-xl border transition-all duration-200 relative ${outerStyle} ${
                  isPlaying || (autoplayActive && autoplayIndex === idx) ? 'ring-2 ring-[#ff9500] border-transparent bg-[#0a0b0e]' : ''
                }`}
              >
                {/* Speaker Avatar / TTS Button */}
                <button
                  onClick={() => handlePlayLine(line)}
                  disabled={(playingLineId !== null && !isPlaying) || isEditing}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition border shadow-sm cursor-pointer ${
                    isPlaying
                      ? 'bg-[#ff9500] text-slate-950 border-[#ff9500] animate-pulse'
                      : isEditing
                        ? 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed opacity-50'
                        : 'bg-[#0a0b0e] hover:bg-white/5 text-[#ff9500] border-white/5'
                  }`}
                  title="Play vocal TTS for this segment line"
                >
                  {isPlaying ? (
                    // Micro soundwave animation
                    <div className="flex gap-0.5 items-end h-4">
                      <div className="w-0.5 bg-slate-950 h-2 animate-bounce transition-all" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-0.5 bg-slate-950 h-4 animate-bounce transition-all" style={{ animationDelay: '0.3s' }}></div>
                      <div className="w-0.5 bg-slate-950 h-3 animate-bounce transition-all" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-0.5 bg-slate-950 h-1 animate-bounce transition-all" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  ) : (
                    <Volume2 className="w-4 h-4 text-[#ff9500]" />
                  )}
                </button>

                {/* Line details / Editor switch */}
                {isEditing ? (
                  <div className="flex-grow space-y-3 pt-0.5">
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Name editor */}
                      <div className="flex-1 max-w-full sm:max-w-[180px] space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-[#8e8e93] block">Speaker Name</label>
                        <input
                          type="text"
                          value={editSpeaker}
                          onChange={(e) => setEditSpeaker(e.target.value)}
                          className="w-full bg-[#0a0b0e] border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white font-bold font-sans focus:outline-none focus:border-[#ff9500]"
                        />
                      </div>

                      {/* Sound cues editor */}
                      <div className="flex-grow space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-[#8e8e93] block">Sound Cue (optional, e.g. [LAUGHTER])</label>
                        <input
                          type="text"
                          value={editCues}
                          onChange={(e) => setEditCues(e.target.value)}
                          placeholder="e.g. [LAUGHTER] or [INTRO MUSIC]"
                          className="w-full bg-[#0a0b0e] border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 font-sans focus:outline-none focus:border-[#ff9500]"
                        />
                      </div>
                    </div>

                    {/* Speech Text editor */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-[#8e8e93] block">Dialogue text content</label>
                      <textarea
                        rows={3}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-[#0a0b0e] border border-white/15 rounded-lg p-3 text-xs sm:text-sm text-slate-200 font-serif leading-relaxed focus:outline-none focus:border-[#ff9500] resize-y"
                      />
                    </div>

                    {/* Editor actions */}
                    <div className="flex items-center gap-2 pt-1 font-sans">
                      <button
                        onClick={() => handleSaveLine(line.id)}
                        className="inline-flex items-center gap-1 bg-[#ff9500] hover:bg-[#ff9500]/90 text-slate-950 font-bold uppercase py-1.5 px-3 rounded-lg text-[9.5px] tracking-wider transition cursor-pointer select-none"
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        Save Dialogue
                      </button>
                      <button
                        onClick={() => setEditingLineId(null)}
                        className="inline-flex items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold uppercase py-1.5 px-3 rounded-lg text-[9.5px] tracking-wider transition cursor-pointer border border-white/10 select-none animate-fade-in"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-grow space-y-1">
                    {/* Speaker detail line */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wider ${nameBadgeStyle}`}>
                        {line.speaker}
                      </span>
                      {roleLabel && (
                        <span className="text-[9px] uppercase font-bold text-[#8e8e93]">
                          • {roleLabel}
                        </span>
                      )}
                    </div>

                    {/* Render optional sound cues */}
                    {line.cues && renderSoundCue(line.cues)}

                    {/* Dialogue text content utilizing Georgia / Playfair Display Editorial Serif Font matching */}
                    <p className="text-slate-100 text-sm md:text-md leading-relaxed tracking-normal font-serif pt-1 pl-0.5 font-light">
                      "{line.text}"
                    </p>

                    {/* Action button toolstrip for Play, Edit, Delete */}
                    <div className="flex items-center gap-3.5 pt-2 mt-2 border-t border-white/5 font-sans flex-wrap sm:flex-nowrap">
                      <button
                        onClick={() => handleStartEdit(line)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-[#ff9500] transition cursor-pointer select-none"
                        title="Edit dialogue or cues"
                      >
                        <Pencil className="w-3 h-3 text-slate-500 hover:text-[#ff9500]" />
                        Edit dialogue
                      </button>

                      {/* AI Dialogue dynamic rephrase button with Popover styles */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setActiveRephraseDropdownId(activeRephraseDropdownId === line.id ? null : line.id);
                          }}
                          disabled={rephrasingLineId === line.id}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase transition select-none cursor-pointer ${
                            rephrasingLineId === line.id
                              ? 'text-yellow-400 animate-pulse'
                              : 'text-slate-400 hover:text-yellow-400'
                          }`}
                          title="Tonal Dialogue refiner"
                        >
                          <Sparkles className={`w-3 h-3 ${rephrasingLineId === line.id ? 'animate-spin text-yellow-400' : 'text-slate-500'}`} />
                          {rephrasingLineId === line.id ? 'Polishing...' : 'AI Rephrase'}
                        </button>

                        {/* Floating visual dropdown popup */}
                        {activeRephraseDropdownId === line.id && (
                          <div className="absolute left-0 bottom-full mb-2 bg-[#12131a] border border-white/10 rounded-xl p-2 w-48 shadow-2xl z-50 animate-fade-in space-y-1">
                            <div className="text-[8px] uppercase tracking-wider text-slate-500 px-2 py-1 font-extrabold border-b border-white/5 mb-1.5">
                              Dynamic Dialogue Styles
                            </div>
                            {[
                              { label: '🪄 Wittier Comeback', style: 'wittier' },
                              { label: '🙄 Sarcastic Mockery', style: 'sarcastic' },
                              { label: '🎭 Add Dramatic Pause', style: 'pause' },
                              { label: '🩺 Rigorous Professional', style: 'professional' },
                              { label: '🕵️ Conspiracy Theory', style: 'conspiracy' },
                              { label: '✂️ Snap Shorter Soundbite', style: 'shorter' }
                            ].map(item => (
                              <button
                                key={item.style}
                                onClick={() => handleAIRephrase(line, item.style)}
                                className="w-full text-left text-[10.5px] font-semibold text-slate-300 hover:text-[#ff9500] hover:bg-white/5 py-1 px-2 rounded-lg transition cursor-pointer"
                              >
                                {item.label}
                              </button>
                            ))}
                            <div className="border-t border-white/5 pt-1.5 mt-1">
                              <button
                                onClick={() => setActiveRephraseDropdownId(null)}
                                className="w-full text-center text-[8px] uppercase tracking-widest text-[#8e8e93] hover:text-white py-0.5 rounded cursor-pointer"
                              >
                                Close menu
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Clip compile WAV downloader */}
                      <button
                        onClick={() => handleDownloadLineClip(line)}
                        disabled={downloadingLineId === line.id}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-emerald-400 transition cursor-pointer select-none disabled:opacity-50"
                        title="Compile and download individual vocal WAV segment"
                      >
                        <Download className={`w-3 h-3 ${downloadingLineId === line.id ? 'animate-bounce text-emerald-400' : 'text-slate-500'}`} />
                        {downloadingLineId === line.id ? 'Rendering...' : 'Download WAV'}
                      </button>

                      <button
                        onClick={() => handleDeleteLine(line.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-red-400 transition cursor-pointer ml-auto select-none"
                        title="Delete this line segment"
                      >
                        <Trash className="w-3 h-3 text-slate-500 hover:text-red-400" />
                        Delete segment
                      </button>
                    </div>
                  </div>
                )}

                {/* Line Index identifier indicator */}
                <div className="absolute right-3 top-3 text-[10px] text-slate-700 font-mono italic">
                  #{idx + 1}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-black/40 rounded-xl border border-white/5">
            <p className="text-[#8e8e93] text-xs">No lines match your filter or search query criteria.</p>
          </div>
        )}
      </div>

      {/* QUICK APPEND DIALOGUE MODULE */}
      <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5 gap-3">
        <div className="text-left">
          <span className="font-bold text-slate-200 block text-xs">Desire additional witty banter?</span>
          <span className="text-[#8e8e93] text-[10px] block leading-normal font-light">Append a brand-new talking segment dynamically at the end of the script broadcast!</span>
        </div>
        <button
          onClick={handleAddLine}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-500/95 text-slate-950 font-extrabold uppercase py-2 px-4 rounded-xl text-[10px] tracking-wider transition cursor-pointer select-none border border-emerald-400/25 shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Add Dialogue Segment
        </button>
      </div>

    </div>
  );
}
