// RichText.tsx
// Renders post captions and comment text with clickable #hashtags and @mentions.
// #tag   → violet chip → navigates to hashtag feed
// @user  → indigo chip → navigates to that user's profile

import React from 'react';

interface RichTextProps {
  text: string;
  onHashtag?: (tag: string) => void;
  onMention?: (username: string) => void;
  className?: string;
}

export function RichText({ text, onHashtag, onMention, className = '' }: RichTextProps) {
  if (!text) return null;

  // Split on #tag or @mention tokens while keeping delimiters
  const parts = text.split(/(#[\w]+|@[\w]+)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (/^#[\w]+$/.test(part)) {
          const tag = part.slice(1);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onHashtag?.(tag)}
              className="text-[#c9a96e] hover:text-[#e8c98a] font-medium transition-colors cursor-pointer"
            >
              {part}
            </button>
          );
        }
        if (/^@[\w]+$/.test(part)) {
          const username = part.slice(1);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMention?.(username)}
              className="text-[#c9a96e] hover:text-[#e8c98a] font-medium transition-colors cursor-pointer"
            >
              {part}
            </button>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}

// ── Extract hashtags from a string ──────────────────────────────────────────
export const extractHashtags = (text: string): string[] =>
  [...new Set((text.match(/#([\w]+)/g) || []).map(t => t.slice(1).toLowerCase()))];

// ── Extract @mentions from a string ─────────────────────────────────────────
export const extractMentions = (text: string): string[] =>
  [...new Set((text.match(/@([\w]+)/g) || []).map(m => m.slice(1).toLowerCase()))];
