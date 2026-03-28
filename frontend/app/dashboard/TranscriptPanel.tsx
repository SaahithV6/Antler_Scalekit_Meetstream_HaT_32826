'use client';

import { useEffect, useRef } from 'react';
import { TranscriptChunk } from '../../lib/types';

interface TranscriptPanelProps {
  chunks: TranscriptChunk[];
}

const SPEAKER_COLORS = [
  'text-blue-600',
  'text-purple-600',
  'text-orange-600',
  'text-teal-600',
  'text-pink-600',
  'text-indigo-600',
  'text-cyan-600',
  'text-rose-600',
];

const speakerColorMap = new Map<string, string>();
let colorIndex = 0;

function getSpeakerColor(name: string): string {
  if (!speakerColorMap.has(name)) {
    speakerColorMap.set(name, SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length]);
    colorIndex++;
  }
  return speakerColorMap.get(name)!;
}

export default function TranscriptPanel({ chunks }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks]);

  if (chunks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Waiting for transcript…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto h-full px-2">
      {chunks.map((chunk, i) => (
        <div key={i} className="text-sm py-0.5">
          <span className={`font-bold mr-1 ${getSpeakerColor(chunk.speakerName)}`}>
            {chunk.speakerName}:
          </span>
          <span className="text-gray-800">{chunk.text}</span>
          {chunk.isEndOfTurn && <span className="ml-1 text-gray-300 text-xs">●</span>}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
