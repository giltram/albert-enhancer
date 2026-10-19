export interface CampusPreference {
  readonly enabled: boolean;
  /** The exact option value learned from Albert, never a hard-coded campus default. */
  readonly preferredValue?: string;
}

export interface CustomAbbreviation {
  readonly abbreviation: string;
  readonly expansion: string;
  readonly enabled: boolean;
}

export interface HighlightSettings {
  readonly time: boolean;
  readonly location: boolean;
  readonly instructor: boolean;
  readonly prerequisites: boolean;
  readonly extraFees: boolean;
  readonly specialRules: boolean;
  readonly conflicts: boolean;
  readonly degreeClassification: boolean;
}

export interface AlbertEnhancerSettings {
  readonly enabled: boolean;
  readonly campus: CampusPreference;
  /** Visible semester tab label, e.g. Spring 2027. Empty means no automatic selection. */
  readonly preferredTerm?: string;
  readonly abbreviationExpansion: boolean;
  readonly keepSessionAlive: boolean;
  readonly customAbbreviations: readonly CustomAbbreviation[];
  readonly highlights: HighlightSettings;
  readonly experimentalStatusDetection: boolean;
}

export const defaultSettings: AlbertEnhancerSettings = {
  enabled: true,
  campus: { enabled: false },
  preferredTerm: '',
  abbreviationExpansion: true,
  keepSessionAlive: false,
  customAbbreviations: [],
  highlights: {
    time: true,
    location: true,
    instructor: true,
    prerequisites: true,
    extraFees: true,
    specialRules: true,
    conflicts: true,
    degreeClassification: true,
  },
  experimentalStatusDetection: false,
};
