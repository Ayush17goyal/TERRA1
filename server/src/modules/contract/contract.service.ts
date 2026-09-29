import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractConfig, ContractAcceptance } from './contract.entities';
const PDFDocument = require('pdfkit');

@Injectable()
export class ContractService {
  private contractsCache = new Map<string, any>();
  private risksCache = new Map<string, any[]>();

  constructor(
    @InjectRepository(ContractConfig)
    private readonly configRepo: Repository<ContractConfig>,
    @InjectRepository(ContractAcceptance)
    private readonly acceptanceRepo: Repository<ContractAcceptance>,
  ) {
    this.seedContracts();
    this.seedActiveContractConfig().catch(err =>
      console.error('[ContractService] Error seeding active contract config:', err)
    );
  }

  async seedActiveContractConfig() {
    const count = await this.configRepo.count();
    if (count === 0) {
      const config = this.configRepo.create({
        contractVersion: '1.0.0',
        contractContent: `By accessing, registering on, subscribing to, clicking “I Agree”, creating an account, or otherwise using the LEGATRIXON Platform, the user expressly acknowledges and agrees that they have read, understood, and accepted these Terms and Conditions, Privacy Policy, and all other policies published by LEGATRIXON, and such acceptance shall constitute a valid, legally binding, and enforceable electronic contract having the same legal effect as a written agreement signed physically. The user further agrees not to copy, reproduce, modify, distribute, sell, license, commercialize, scrape, extract, download, reverse engineer, decompile, disassemble, derive, or attempt to access the source code, software architecture, algorithms, databases, AI models, workflows, proprietary information, trade secrets, business methods, designs, functionalities, or any other intellectual or technological components of the Platform, nor create, develop, operate, support, or assist any website, software, application, platform, service, or product that is substantially similar to, derived from, competitive with, or intended to replicate any part of LEGATRIXON. Any unauthorized use, infringement, misuse, circumvention of security measures, or breach of this Agreement shall constitute a material violation entitling LEGATRIXON to immediately suspend or terminate access, seek injunctive relief, recover damages, legal costs, and pursue all civil, criminal, and statutory remedies available under applicable law without prejudice to any other rights or remedies available to it.`,
      });
      await this.configRepo.save(config);
      console.log('[ContractService] Seeded default active contract config successfully.');
    }
  }

  async getActiveConfig(): Promise<ContractConfig> {
    const configs = await this.configRepo.find({
      order: { lastUpdated: 'DESC' },
      take: 1
    });
    const config = configs[0];
    if (!config) {
      await this.seedActiveContractConfig();
      const recheck = await this.configRepo.find({
        order: { lastUpdated: 'DESC' },
        take: 1
      });
      return recheck[0];
    }
    return config;
  }

  async updateConfig(version: string, content: string): Promise<ContractConfig> {
    const config = this.configRepo.create({
      contractVersion: version,
      contractContent: content,
      lastUpdated: new Date()
    });
    return this.configRepo.save(config);
  }

  async recordAcceptance(
    userId: string | null,
    email: string | null,
    ipAddress: string | null,
    userAgent: string | null,
    version: string
  ): Promise<ContractAcceptance> {
    const acceptance = this.acceptanceRepo.create({
      userId,
      email,
      ipAddress,
      browserUserAgent: userAgent,
      contractVersion: version,
      accepted: true,
      timestamp: new Date()
    });
    return this.acceptanceRepo.save(acceptance);
  }

  async getAcceptanceStatus(userId: string, version: string): Promise<{ accepted: boolean }> {
    const acceptance = await this.acceptanceRepo.findOne({
      where: { userId, contractVersion: version, accepted: true }
    });
    return { accepted: !!acceptance };
  }

  async getAllAcceptances(): Promise<ContractAcceptance[]> {
    return this.acceptanceRepo.find({
      order: { timestamp: 'DESC' }
    });
  }

  async generatePdf(content: string, version: string, res: any) {
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="LEGATRIXON_IP_Contract_v${version}.pdf"`
    );

    doc.pipe(res);

    // Draw header
    doc.fillColor('#B59410').fontSize(24).text('LEGATRIXON', { align: 'center' });
    doc.fillColor('#111827').fontSize(14).text('INTELLECTUAL PROPERTY & ELECTRONIC CONTRACT', { align: 'center' });
    doc.moveDown(1);
    
    // Metadata block
    doc.fillColor('#6b7280').fontSize(10);
    doc.text(`Version: ${version}`);
    doc.text(`Downloaded: ${new Date().toLocaleDateString()}`);
    doc.moveDown(0.5);
    
    // Draw separator line
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1.5);

    // Split content by paragraphs/newlines and write
    const paragraphs = content.split('\n');
    doc.fillColor('#1f2937').fontSize(10.5);
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        doc.text(paragraph.trim(), {
          align: 'justify',
          lineGap: 4
        });
        doc.moveDown(0.8);
      } else {
        doc.moveDown(0.5);
      }
    }

    doc.end();
  }

  async review(userId: string, fileName: string, fileUrl: string) {
    const id = `contract_${Math.random().toString(36).substring(2, 11)}`;
    const newContract = {
      id,
      userId,
      fileName,
      fileUrl,
      overallRiskScore: 72,
      createdAt: new Date(),
    };
    this.contractsCache.set(id, newContract);

    const clauses = [
      {
        title: 'Indemnity',
        risk: 'High',
        originalText: 'The receiving party agrees to indemnify and hold harmless the disclosing party for any and all intellectual property violations without limitation.',
        advice: 'Add a reasonable liability cap equal to 1x contract value, and exclude indirect or consequential damages.',
        redlineSuggestion: 'The receiving party agrees to indemnify the disclosing party up to a maximum aggregate amount equal to the fees paid under this agreement...',
      },
      {
        title: 'Governing Law',
        risk: 'Medium',
        originalText: 'This agreement shall be governed and interpreted solely under the courts of New York, USA.',
        advice: 'Change jurisdiction to New Delhi, India to minimize international legal counsel costs.',
        redlineSuggestion: 'This agreement shall be governed by and construed in accordance with the laws of India, with courts at New Delhi having exclusive jurisdiction...',
      }
    ];

    this.risksCache.set(id, clauses);

    return { contractId: id, status: 'completed', overallRiskScore: 72 };
  }

  async getRisks(id: string) {
    const risks = this.risksCache.get(id);
    if (!risks) {
      throw new NotFoundException(`Contract risks for ID ${id} not found`);
    }
    return {
      contractId: id,
      clauses: risks,
    };
  }

  async recommendClause(id: string, clauseTitle: string) {
    const risks = this.risksCache.get(id);
    if (!risks) {
      throw new NotFoundException(`Contract risks for ID ${id} not found`);
    }

    const clause = risks.find(c => c.title.toLowerCase() === clauseTitle.toLowerCase());
    if (!clause) {
      throw new NotFoundException(`Clause with title ${clauseTitle} not found in this contract`);
    }

    return {
      title: clause.title,
      recommendation: clause.redlineSuggestion,
      reconciliationAdvice: clause.advice,
    };
  }

  private seedContracts() {
    this.contractsCache.set('nda', {
      id: 'nda',
      fileName: 'Mutual NDA Draft.pdf',
      overallRiskScore: 65,
    });
    this.risksCache.set('nda', [
      {
        title: 'Indemnity',
        risk: 'High',
        originalText: 'The receiving party agrees to indemnify and hold harmless the disclosing party for any and all intellectual property violations without limitation.',
        advice: 'Add a reasonable liability cap equal to 1x contract value, and exclude indirect or consequential damages.',
        redlineSuggestion: 'The receiving party agrees to indemnify the disclosing party up to a maximum aggregate amount equal to the fees paid under this agreement...',
      },
      {
        title: 'Governing Law',
        risk: 'Medium',
        originalText: 'This agreement shall be governed and interpreted solely under the courts of New York, USA.',
        advice: 'Since both parties are operating in India, suggest changing jurisdiction to New Delhi, India to reduce arbitration costs.',
        redlineSuggestion: 'This agreement shall be governed by and construed in accordance with the laws of India, with courts at New Delhi having exclusive jurisdiction...',
      }
    ]);
  }
}
