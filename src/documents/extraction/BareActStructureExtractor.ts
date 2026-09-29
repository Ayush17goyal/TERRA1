import type { BareActComponentType, BareActStructureComponent } from '../types';

const componentPatterns: Array<[BareActComponentType, RegExp]> = [
  ['preamble', /\bpreamble\b|whereas\b/i],
  ['part', /^\s*part\s+[ivx\d]+/i],
  ['chapter', /^\s*chapter\s+[ivx\d]+/i],
  ['schedule', /^\s*(the\s+)?schedule\b/i],
  ['definition', /\bdefinitions?\b|\bmeans\b|\bincludes\b/i],
  ['rule_making_power', /\bpower to make rules\b|\bmake rules\b|\brules may provide\b/i],
  ['offence', /\boffence\b|\bpunishable\b/i],
  ['penalty', /\bpenalty\b|\bfine\b|\bimprisonment\b/i],
  ['savings', /\bsaving\b|\bsavings\b/i],
  ['repeal', /\brepeal\b|\brepealed\b/i],
  ['commencement', /\bcommencement\b|\bcome into force\b/i],
  ['extent', /\bextent\b|\bextends to\b/i],
];

export class BareActStructureExtractor {
  extract(text: string): BareActStructureComponent[] {
    const blocks = this.splitIntoBlocks(text);
    return blocks.map((block, index) => {
      const sectionNumber = this.sectionNumber(block);
      const componentType = sectionNumber ? this.classifyBlock(block) : this.classifyBlock(block, index);
      return {
        id: `component-${index}`,
        componentType,
        title: index === 0 ? this.title(text) : undefined,
        heading: this.heading(block),
        sectionNumber,
        text: block,
        order: index,
      };
    });
  }

  private splitIntoBlocks(text: string): string[] {
    const sectionSplit = text.split(/(?=\n\s*(?:section\s+)?\d+[A-Z]?\.\s+)/i).map((part) => part.trim()).filter(Boolean);
    if (sectionSplit.length > 1) return sectionSplit;
    return text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  }

  private classifyBlock(block: string, index = -1): BareActComponentType {
    if (index === 0) return 'title';
    for (const [type, pattern] of componentPatterns) {
      if (pattern.test(block)) return type;
    }
    if (/^\s*(?:section\s+)?\d+[A-Z]?\./i.test(block)) return 'section';
    if (/^\s*\(\d+\)/.test(block)) return 'sub_section';
    return 'general';
  }

  private sectionNumber(block: string): string | undefined {
    return block.match(/^\s*(?:section\s+)?(\d+[A-Z]?)\./i)?.[1];
  }

  private heading(block: string): string | undefined {
    const firstLine = block.split('\n')[0]?.trim();
    return firstLine?.slice(0, 160);
  }

  private title(text: string): string | undefined {
    return text.split('\n').map((line) => line.trim()).find(Boolean)?.slice(0, 200);
  }
}
