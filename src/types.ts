export type EpisodeLength = '5' | '15' | '30' | '60';

export type RadioTone = 'funny' | 'serious' | 'investigative' | 'dramatic' | 'educational' | 'chaotic';

export type TargetAudience = 'general' | 'students' | 'experts' | 'kids' | 'executives';

export type GuestIntensity = 'none' | 'few' | 'many';

export type OutputFormat = 'script' | 'outline_script' | 'json_script' | 'audio_ready';

export interface SpeakerConfig {
  name: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  description: string;
  role: 'host1' | 'host2' | 'guest' | 'caller';
}

export interface ScriptLine {
  id: string; // unique identifier
  speaker: string; // Name of speaker
  role: 'host1' | 'host2' | 'guest' | 'caller';
  text: string; // The dialogue text
  cues?: string; // Optional sound effects like [LAUGHTER], [INTRO MUSIC]
}

export interface ShowOutlineSegment {
  title: string;
  durationEstimate: string;
  purpose: string;
}

export interface EpisodeBrief {
  documentTitle: string;
  keyIdeas: string[];
  factsAndFactsSheet: string[];
  conflictsOrTensions: string[];
  charactersOrVoices: string[];
  surprisingDetails: string[];
  summary: string;
}

export interface RadioShowEpisode {
  brief: EpisodeBrief;
  outline: ShowOutlineSegment[];
  script: ScriptLine[];
  hosts: {
    host1: SpeakerConfig;
    host2: SpeakerConfig;
  };
}

export interface GenerationRequest {
  pastedText?: string;
  files?: Array<{ name: string; content: string; type: string }>;
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
}
