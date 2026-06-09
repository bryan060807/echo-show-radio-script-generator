import React, { useState, useEffect } from 'react';
import { RadioShowEpisode, ScriptLine } from '../types';
import { Play, Volume2, Music, PhoneCall, Disc, AlertCircle, Sparkles, Copy, Check, Download, Layers, Pencil, Trash, Plus, X } from 'lucide-react';
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

  // Trigger TTS dynamically for a script line
  const handlePlayLine = async (line: ScriptLine) => {
    // If already playing another line, pause it
    if (playingAudio) {
      playingAudio.pause();
      setPlayingAudio(null);
    }

    if (playingLineId === line.id) {
      setPlayingLineId(null);
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
          return;
        }
      }

      const audio = new Audio(audioSource);
      audio.playbackRate = speed;
      setPlayingAudio(audio);

      const cleanupAndStop = () => {
        setPlayingLineId(null);
        setPlayingAudio(null);
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
                className={`flex gap-4 p-4 rounded-xl border transition-all duration-200 relative ${outerStyle} ${
                  isPlaying ? 'ring-2 ring-[#ff9500] border-transparent bg-[#0a0b0e]' : ''
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
                    <div className="flex items-center gap-3 pt-2 mt-2 border-t border-white/5 font-sans">
                      <button
                        onClick={() => handleStartEdit(line)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-[#ff9500] transition cursor-pointer select-none"
                        title="Edit dialogue or cues"
                      >
                        <Pencil className="w-3 h-3 text-slate-500 hover:text-[#ff9500]" />
                        Edit dialogue
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
