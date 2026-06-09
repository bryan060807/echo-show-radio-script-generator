import React, { useState } from 'react';
import { RadioShowEpisode } from '../types';
import { BookOpen, Map, Users, HelpCircle, Flame, ShieldAlert, Award, Grid, List } from 'lucide-react';

interface EpisodeReviewProps {
  episode: RadioShowEpisode;
}

export default function EpisodeReview({ episode }: EpisodeReviewProps) {
  const { brief, outline, hosts } = episode;
  const [activeTab, setActiveTab] = useState<'brief' | 'outline' | 'hosts'>('brief');

  return (
    <div className="bg-[#16181d] border border-white/5 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-6">
      
      {/* Tab Navigation header */}
      <div className="flex border-b border-white/5 pb-4 justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 font-sans">
            <Award className="w-5 h-5 text-[#ff9500]" />
            Show Overview: {brief.documentTitle || "Episode Brief"}
          </h2>
          <p className="text-xs text-[#8e8e93]">Review the extracted document facts and segmented schedule plan.</p>
        </div>

        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('brief')}
            className={`text-xs px-4 py-2 font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'brief' 
                ? 'bg-[#ff9500] text-slate-950 font-extrabold shadow' 
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            Fact Analytics Brief
          </button>
          <button
            onClick={() => setActiveTab('outline')}
            className={`text-xs px-4 py-2 font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'outline' 
                ? 'bg-[#ff9500] text-slate-950 font-extrabold shadow' 
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            Segment Schedule Map
          </button>
          <button
            onClick={() => setActiveTab('hosts')}
            className={`text-xs px-4 py-2 font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'hosts' 
                ? 'bg-[#ff9500] text-slate-950 font-extrabold shadow' 
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            Cast Directory
          </button>
        </div>
      </div>

      {/* TAB CONTENTS */}

      {/* TAB 1: BRIEF */}
      {activeTab === 'brief' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Executive Summary Summary Box */}
          <div className="bg-gradient-to-br from-[#ff9500]/5 via-[#0a0b0e] to-[#0a0b0e] border border-white/10 p-5 rounded-xl space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#ff9500] flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Executive Outline Summary
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">{brief.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Key Ideas Pillar list */}
            <div className="bg-[#0a0b0e] border border-white/5 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase text-[#8e8e93] tracking-wider flex items-center gap-2">
                <Grid className="w-4 h-4 text-emerald-500" />
                Conceptual Pillars
              </h4>
              <ul className="space-y-2.5">
                {brief.keyIdeas.map((idea, idx) => (
                  <li key={idx} className="text-sm text-slate-350 flex items-start gap-2.5">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                    <span>{idea}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Facts and Statistics */}
            <div className="bg-[#0a0b0e] border border-white/5 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase text-[#8e8e93] tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-[#ff9500]" />
                Hard Certified Facts Sheet
              </h4>
              <ul className="space-y-2.5">
                {brief.factsAndFactsSheet.map((fact, idx) => (
                  <li key={idx} className="text-sm text-slate-350 flex items-start gap-2.5">
                    <span className="text-[#ff9500] font-bold shrink-0 mt-0.5">[✓]</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Conflicts or Tensions */}
            <div className="bg-[#0a0b0e] border border-white/5 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase text-[#8e8e93] tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#ff3b30]" />
                Dramatized Tensions & Disagreements
              </h4>
              {brief.conflictsOrTensions && brief.conflictsOrTensions.length > 0 ? (
                <ul className="space-y-2.5">
                  {brief.conflictsOrTensions.map((conflict, idx) => (
                    <li key={idx} className="text-sm text-slate-350 flex items-start gap-2.5">
                      <span className="text-[#ff3b30] font-bold shrink-0 mt-0.5">⚡</span>
                      <span>{conflict}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 italic">No explicit conflicts detected in this neutral document.</p>
              )}
            </div>

            {/* Surprising Details */}
            <div className="bg-[#0a0b0e] border border-white/5 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase text-[#8e8e93] tracking-wider flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                Surprising Anecdotes & Uncanny Details
              </h4>
              <ul className="space-y-2.5">
                {brief.surprisingDetails.map((detail, idx) => (
                  <li key={idx} className="text-sm text-slate-350 flex items-start gap-2.5">
                    <span className="text-sky-400 font-bold shrink-0 mt-0.5">✦</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Key Characters */}
          <div className="bg-[#0a0b0e] border border-white/5 p-4 rounded-xl">
            <h4 className="text-xs font-bold uppercase text-[#8e8e93] tracking-wider flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#ff9500]" />
              Influential Actors, Personalities or Viewpoints Mentioned
            </h4>
            <div className="flex flex-wrap gap-2">
              {brief.charactersOrVoices.map((char, idx) => (
                <span key={idx} className="text-xs font-medium bg-[#16181d] border border-white/5 text-[#ff9500] px-3 py-1.5 rounded-lg">
                  {char}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: SCHEDULE OUTLINE */}
      {activeTab === 'outline' && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center gap-2 text-[#8e8e93] text-xs">
            <Map className="w-4 h-4 text-[#ff9500]" />
            <span>Show Segment Roadmap</span>
          </div>

          <div className="space-y-3">
            {outline.map((seg, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-[#0a0b0e] hover:bg-black/30 transition duration-150"
              >
                {/* Visual Line Number */}
                <div className="w-8 h-8 rounded-lg bg-[#ff9500]/10 text-[#ff9500] font-bold text-xs flex items-center justify-center shrink-0 border border-[#ff9500]/20">
                  {idx + 1}
                </div>
                
                {/* Details */}
                <div className="flex-1 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-sm font-bold text-white tracking-wide">{seg.title}</h4>
                    <span className="text-[10px] text-[#ff9500] font-bold bg-[#ff9500]/10 border border-[#ff9500]/25 px-2.5 py-0.5 rounded-full uppercase tracking-wider self-start sm:self-center">
                      ⏱ {seg.durationEstimate}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-[#8e8e93] leading-relaxed">{seg.purpose}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CAST DIRECTORY */}
      {activeTab === 'hosts' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Host MALE */}
            <div className="bg-[#0a0b0e] border border-white/5 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-center sm:items-start text-center sm:text-left">
              {/* Avatar Mock */}
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-2xl font-bold shrink-0">
                🎙️
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h4 className="text-lg font-bold text-white tracking-wide">{hosts.host1.name}</h4>
                  <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md font-bold uppercase">
                    Host • {hosts.host1.voiceName}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-400">Role: Clever, dry, critical thinking host</p>
                <p className="text-xs text-slate-400 leading-relaxed pt-2">{hosts.host1.description}</p>
              </div>
            </div>

            {/* Host FEMALE */}
            <div className="bg-[#0a0b0e] border border-white/5 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-center sm:items-start text-center sm:text-left">
              {/* Avatar Mock */}
              <div className="w-16 h-16 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 text-2xl font-bold shrink-0">
                🎙️
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h4 className="text-lg font-bold text-white tracking-wide">{hosts.host2.name}</h4>
                  <span className="text-[10px] bg-pink-500/10 border border-pink-500/20 text-pink-400 px-2 py-0.5 rounded-md font-bold uppercase">
                    Host • {hosts.host2.voiceName}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-400">Role: Energetic, insightful, emotionally fluent host</p>
                <p className="text-xs text-slate-400 leading-relaxed pt-2">{hosts.host2.description}</p>
              </div>
            </div>
          </div>

          {/* Artificial Guests Disclaimer */}
          <div className="bg-white/2 p-4 rounded-xl border border-white/5 flex items-center gap-3 space-x-1">
            <ShieldAlert className="w-5 h-5 text-[#ff9500] shrink-0" />
            <div className="text-xs text-[#8e8e93] leading-normal font-light">
              <span className="font-bold text-slate-200 block mb-0.5">Dynamic Cast Adaptability:</span> Guests, expert commentators, and fictional call-in perspectives are systematically created on-the-fly and parsed based on concepts within your submitted text to support deep topical understanding.
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
