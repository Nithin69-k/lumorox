export const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
] as const;

export type Genre = (typeof GENRES)[number];

export const MOODS = [
  { id: "happy", label: "Happy", emoji: "😊", genres: ["Comedy", "Animation", "Family", "Adventure"] },
  { id: "sad", label: "Sad", emoji: "😢", genres: ["Drama", "Romance"] },
  { id: "excited", label: "Excited", emoji: "🤩", genres: ["Action", "Adventure", "Science Fiction"] },
  { id: "romantic", label: "Romantic", emoji: "❤️", genres: ["Romance", "Drama"] },
  { id: "thriller", label: "Thriller", emoji: "😬", genres: ["Thriller", "Mystery", "Crime"] },
  { id: "action", label: "Action", emoji: "💥", genres: ["Action", "Adventure", "War"] },
  { id: "horror", label: "Horror", emoji: "👻", genres: ["Horror", "Mystery"] },
  { id: "mindbending", label: "Mind-Bending", emoji: "🌀", genres: ["Science Fiction", "Mystery", "Thriller"] },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];
