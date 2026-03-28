interface BufferEntry {
  speakerName: string;
  text: string;
  timestamp: Date;
}

class TranscriptBuffer {
  private buffers: Map<string, BufferEntry[]> = new Map();
  private readonly MAX_ENTRIES = 100;

  append(botId: string, speakerName: string, text: string): void {
    if (!this.buffers.has(botId)) {
      this.buffers.set(botId, []);
    }
    const entries = this.buffers.get(botId)!;
    entries.push({ speakerName, text, timestamp: new Date() });

    if (entries.length > this.MAX_ENTRIES) {
      entries.splice(0, entries.length - this.MAX_ENTRIES);
    }
  }

  getFormattedBuffer(botId: string): string {
    const entries = this.buffers.get(botId) ?? [];
    // Keep last 60 entries as rough ~2000 token estimate
    const recent = entries.slice(-60);
    return recent.map((e) => `[${e.speakerName}]: ${e.text}`).join('\n');
  }

  clear(botId: string): void {
    this.buffers.delete(botId);
  }

  getRecentEntries(
    botId: string,
    n: number
  ): Array<{ speakerName: string; text: string; timestamp: Date }> {
    const entries = this.buffers.get(botId) ?? [];
    return entries.slice(-n);
  }
}

export const transcriptBuffer = new TranscriptBuffer();
