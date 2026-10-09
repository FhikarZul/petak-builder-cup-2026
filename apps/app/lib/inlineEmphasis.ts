import type { MessageBlock } from './blocks';

/** Only inline strong text; all other characters remain ordinary text. */
export function inlineEmphasis(body: string, category?: string, keywords: readonly string[] = []): { text: string; bold: boolean }[] {
  let text = body;
  if (category) {
    // Structured category metadata identifies the filing label, never a
    // matching merchant word. Prefer explicit "under/as" context and
    // otherwise the drawn leading category shape.
    const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [...body.matchAll(new RegExp(`\\b${escaped}\\b`, 'gi'))];
    const contextual = matches.find((m) => /(?:·|under|as)\s*$/i.test(body.slice(0, m.index ?? 0)));
    const leading = body.match(new RegExp(`^Filed\\.\\s+(${escaped})\\s+—`, 'i'));
    const chosen = contextual ?? (leading ? matches[0] : undefined);
    if (chosen?.index !== undefined && !(body.slice(chosen.index - 2, chosen.index) === '**' && body.slice(chosen.index + chosen[0].length, chosen.index + chosen[0].length + 2) === '**')) {
      text = `${body.slice(0, chosen.index)}**${body.slice(chosen.index, chosen.index + chosen[0].length)}**${body.slice(chosen.index + chosen[0].length)}`;
    }
  }
  const segments: { text: string; bold: boolean }[] = [];
  const pattern = /\*\*([^*\n]+)\*\*/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index!;
    if (at > offset) segments.push({ text: text.slice(offset, at), bold: false });
    segments.push({ text: match[1]!, bold: true });
    offset = at + match[0].length;
  }
  if (offset < text.length) segments.push({ text: text.slice(offset), bold: false });
  const terms=[...new Set(keywords.map(k=>k.trim()).filter(k=>k.length>1 && k.length<=100))];
  if (!terms.length) return segments;
  const escaped=terms.sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const semantic=new RegExp(`(^|[^\\p{L}\\p{N}_])(${escaped.join('|')})(?=$|[^\\p{L}\\p{N}_])`,'giu');
  return segments.flatMap(part=>{
    if(part.bold)return [part];
    const out:{text:string;bold:boolean}[]=[];
    let offset=0;
    for(const match of part.text.matchAll(semantic)){
      const start=match.index!+match[1].length;
      if(start>offset)out.push({text:part.text.slice(offset,start),bold:false});
      out.push({text:match[2],bold:true});offset=start+match[2].length;
    }
    if(offset<part.text.length)out.push({text:part.text.slice(offset),bold:false});
    return out;
  });
}


/** Emphasis comes from the same typed cards as the facts, not guesses about prose. */
export function neighbourKeywords(blocks: readonly MessageBlock[]): string[] {
  return blocks.flatMap(block=>{
    if(block.kind==='meal_detail')return [block.dish];
    if(block.kind==='entry_card' && block.entryKind==='meal' && block.title)return [block.title];
    if(block.kind==='objective_table')return ['calories','protein','carbs','fat','food target','estimated burn'];
    if(block.kind==='task_actions')return block.labels;
    return [];
  });
}

/** Numeric spans remain legible Jakarta, including model-marked amounts. */
export function keywordStyle(text: string) {
  return /[\d$€£¥₹]/u.test(text)
    ? { fontFamily: 'PlusJakartaSans_500Medium', fontWeight: '500' as const, fontVariant: ['tabular-nums' as const] }
    : { fontFamily: 'Petak Pixel Bold', fontSize: 20 };
}
