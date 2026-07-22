export type PreferenceOption = {
  id: string;
  label: string;
  type: "genre" | "language";
  color: string;
  image?: string;
};

export type ArtistOption = {
  id: string;
  name: string;
  tags: string[];
  color: string;
  image?: string;
};

export const PREFERENCE_OPTIONS: PreferenceOption[] = [
  { id: "pop", label: "Pop", type: "genre", color: "#E8115B" },
  { id: "hip-hop", label: "Hip-Hop", type: "genre", color: "#BA5D07" },
  { id: "rnb", label: "R&B", type: "genre", color: "#8D67AB" },
  { id: "rock", label: "Rock", type: "genre", color: "#E13300" },
  { id: "electronic", label: "Electronic", type: "genre", color: "#0D73EC" },
  { id: "indie", label: "Indie", type: "genre", color: "#537AA1" },
  { id: "jazz", label: "Jazz", type: "genre", color: "#5B2A86" },
  { id: "classical", label: "Classical", type: "genre", color: "#8C1932" },
  { id: "bollywood", label: "Bollywood", type: "genre", color: "#D84000" },
  { id: "afrobeats", label: "Afrobeats", type: "genre", color: "#148A08" },
  { id: "k-pop", label: "K-Pop", type: "genre", color: "#B02897" },
  { id: "latin", label: "Latin", type: "genre", color: "#DC148C" },
  { id: "english", label: "English", type: "language", color: "#27856A" },
  { id: "hindi", label: "Hindi", type: "language", color: "#1E3264" },
  { id: "spanish", label: "Spanish", type: "language", color: "#777777" },
  { id: "korean", label: "Korean", type: "language", color: "#4A2F82" },
];

export const ARTIST_OPTIONS: ArtistOption[] = [
  { id: "taylor-swift", name: "Taylor Swift", tags: ["Pop"], color: "#E8115B" },
  { id: "the-weeknd", name: "The Weeknd", tags: ["R&B", "Pop"], color: "#8D67AB" },
  { id: "drake", name: "Drake", tags: ["Hip-Hop"], color: "#BA5D07" },
  { id: "kendrick-lamar", name: "Kendrick Lamar", tags: ["Hip-Hop"], color: "#333333" },
  { id: "billie-eilish", name: "Billie Eilish", tags: ["Pop", "Indie"], color: "#537AA1" },
  { id: "sza", name: "SZA", tags: ["R&B"], color: "#8D67AB" },
  { id: "bad-bunny", name: "Bad Bunny", tags: ["Latin"], color: "#DC148C" },
  { id: "arijit-singh", name: "Arijit Singh", tags: ["Bollywood"], color: "#D84000" },
  { id: "ariana-grande", name: "Ariana Grande", tags: ["Pop"], color: "#E8115B" },
  { id: "frank-ocean", name: "Frank Ocean", tags: ["R&B", "Indie"], color: "#27856A" },
  { id: "bts", name: "BTS", tags: ["K-Pop"], color: "#B02897" },
  { id: "ar-rahman", name: "A. R. Rahman", tags: ["Bollywood"], color: "#8C1932" },
  { id: "dua-lipa", name: "Dua Lipa", tags: ["Pop", "Electronic"], color: "#0D73EC" },
  { id: "travis-scott", name: "Travis Scott", tags: ["Hip-Hop"], color: "#BA5D07" },
  { id: "burna-boy", name: "Burna Boy", tags: ["Afrobeats"], color: "#148A08" },
  { id: "olivia-rodrigo", name: "Olivia Rodrigo", tags: ["Pop", "Rock"], color: "#E13300" },
  { id: "daft-punk", name: "Daft Punk", tags: ["Electronic"], color: "#0D73EC" },
  { id: "adele", name: "Adele", tags: ["Pop", "R&B"], color: "#777777" },
];

export const ARTIST_FILTER_TAGS: string[] = [
  "All",
  ...Array.from(new Set(ARTIST_OPTIONS.flatMap((artist) => artist.tags))).sort(),
];
