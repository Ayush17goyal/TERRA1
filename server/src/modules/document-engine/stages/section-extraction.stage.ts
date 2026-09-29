import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { CleanedDocument, DocumentTree, DocumentTreeNode, SectionNode, SectionType, SourceDocumentType } from '../types/document-graph.types';

interface FlattenedNode {
  node: DocumentTreeNode;
  hierarchyPath: string;
}

const SECTION_TYPE_BY_DOC_TYPE: Record<SourceDocumentType, SectionType> = {
  bare_act: 'statutory_provision',
  case_compilation: 'case_paragraph',
  notes: 'notes_block',
  textbook: 'notes_block',
  unknown: 'unclassified',
};

// architecture.md §3 Stage 4 (Section Extraction):
// "Materialize the actual content belonging to each skeleton node as an addressable unit ...
// Handles: assigning body text to the correct tree node, handling orphaned text (routed to a
// needsReview bucket rather than silently mis-attached), resolving split sections."
@Injectable()
export class SectionExtractionStage {
  extract(doc: CleanedDocument, tree: DocumentTree): SectionNode[] {
    const flattened = this.flatten(tree.root);
    const defaultSectionType = SECTION_TYPE_BY_DOC_TYPE[tree.documentType];

    const sections: SectionNode[] = [];
    const bodyBySection = new Map<string, string[]>();
    const orphanedText: string[] = [];

    let offset = 0;
    for (const block of doc.blocks) {
      const blockStart = offset;
      offset += block.text.length + 1;

      // Skip lines that are themselves headings — they were already captured as tree node
      // titles and shouldn't be duplicated as body content.
      const isHeadingLine = flattened.some((f) => f.node.startOffset === blockStart);
      if (isHeadingLine) continue;

      const active = this.findActiveNode(flattened, blockStart);
      if (!active) {
        orphanedText.push(block.text);
        continue;
      }
      const list = bodyBySection.get(active.node.id) || [];
      list.push(block.text);
      bodyBySection.set(active.node.id, list);
    }

    for (const { node, hierarchyPath } of flattened) {
      const text = (bodyBySection.get(node.id) || []).join('\n\n');
      const confidence = node.confidence * (text.length > 0 ? 1 : 0.5);
      sections.push({
        id: node.id,
        treeNodeId: node.id,
        hierarchyPath,
        sectionType: defaultSectionType,
        text: text || node.title,
        confidence,
        needsReview: confidence < 0.4,
      });
    }

    // Orphaned text (before the first detected heading, or when heading detection had low
    // confidence anywhere in the document) is preserved, not dropped — routed as its own
    // review-flagged section per architecture.md §3 Stage 4.
    if (orphanedText.length > 0) {
      sections.unshift({
        id: crypto.randomUUID(),
        treeNodeId: null,
        hierarchyPath: '(unclassified)',
        sectionType: 'unclassified',
        text: orphanedText.join('\n\n'),
        confidence: 0.2,
        needsReview: true,
      });
    }

    return sections;
  }

  private flatten(nodes: DocumentTreeNode[], parentPath = ''): FlattenedNode[] {
    const result: FlattenedNode[] = [];
    for (const node of nodes) {
      const path = parentPath ? `${parentPath} > ${node.title}` : node.title;
      result.push({ node, hierarchyPath: path });
      result.push(...this.flatten(node.children, path));
    }
    // Document order == increasing startOffset, since headings are encountered in reading order
    // during Stage 3's traversal; sorting here makes findActiveNode's linear scan correct
    // regardless of DFS push order.
    return result.sort((a, b) => a.node.startOffset - b.node.startOffset);
  }

  private findActiveNode(flattened: FlattenedNode[], blockStart: number): FlattenedNode | null {
    let active: FlattenedNode | null = null;
    for (const entry of flattened) {
      if (entry.node.startOffset <= blockStart) {
        active = entry;
      } else {
        break;
      }
    }
    return active;
  }
}
