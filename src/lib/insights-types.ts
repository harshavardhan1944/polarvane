export type Sentiment = "positive" | "neutral" | "negative";

export type CommentRow = {
  id: string;
  analysis_id: string;
  text: string;
  author_username: string | null;
  posted_at: string | null;
  like_count: number | null;
  sentiment: Sentiment | null;
  sentiment_confidence: number | null;
  topics: string[];
};
