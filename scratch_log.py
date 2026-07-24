import json
import sys

transcript_path = r'C:\Users\Arshid.Wani\.gemini\antigravity\brain\b5d78c8e-7414-46fd-8052-bb684569884e\.system_generated\logs\transcript_full.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in reversed(lines):
    if '"type":"USER_INPUT"' in line:
        data = json.loads(line)
        content = data.get('content', '')
        for c_line in content.split('\n'):
            if 'WebRTC' in c_line or 'media=' in c_line or 'offer:' in c_line or 'handleStartCall' in c_line or 'attachLocalStreamTracks' in c_line:
                print(c_line)
        break
