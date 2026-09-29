import { Injectable } from '@nestjs/common';
import { LEXMENTOR_LEGAL_ONLY_REJECTION } from '../chat/lexmentor/lexmentor-policy';

export const LEXMENTOR_REJECTION_RESPONSE = LEXMENTOR_LEGAL_ONLY_REJECTION;

export const LEXMENTOR_WELCOME_MESSAGE = `Hello! Welcome to LEGATRIXON AI.

I am your AI legal learning and research assistant. I can help you with legal research, case analysis, judgments, Bare Acts, drafting, mock tests, legal concepts, and other features available within the LEGATRIXON platform.

My responses are grounded in the legal resources available in LEGATRIXON, and I use the appropriate module based on your query.

How can I assist you today?`;

type LegalClassification = {
  isLegal: boolean;
  confidence: number;
  reason: string;
};

@Injectable()
export class LegalDomainClassifierService {
  async classifySemantic(query: string): Promise<LegalClassification> {
    const normalized = (query || '').trim();
    if (!normalized) {
      return { isLegal: false, confidence: 0.99, reason: 'empty-query' };
    }

    if (this.isClearlyNonLegalDeliverable(normalized)) {
      return { isLegal: false, confidence: 0.9, reason: 'clearly-non-legal' };
    }

    if (this.hasLegalSignal(normalized)) {
      return { isLegal: true, confidence: 0.88, reason: 'legal-signal-detected' };
    }

    // Default: reject ambiguous queries that lack legal signals
    return { isLegal: false, confidence: 0.72, reason: 'no-legal-signal' };
  }

  classify(query: string): LegalClassification {
    if (!(query || '').trim()) {
      return { isLegal: false, confidence: 0.99, reason: 'empty-query' };
    }

    if (this.isClearlyNonLegalDeliverable(query)) {
      return { isLegal: false, confidence: 0.9, reason: 'clearly-non-legal' };
    }

    if (this.hasLegalSignal(query)) {
      return { isLegal: true, confidence: 0.85, reason: 'legal-signal-detected' };
    }

    return { isLegal: false, confidence: 0.7, reason: 'no-legal-signal' };
  }

  isLegalQuery(query: string): boolean {
    return this.classify(query).isLegal;
  }

  private isClearlyNonLegalDeliverable(query: string): boolean {
    const normalized = query.toLowerCase();
    if (this.hasLegalSignal(normalized)) return false;

    const patterns = [
      /\b(write|build|debug|fix|compile|run|implement|create)\b[\s\S]*\b(code|program|script|function|api|component|website|javascript|typescript|python|java|react|html|css)\b/,
      /\b(solve|calculate|find|differentiate|integrate)\b[\s\S]*\b(equation|integral|derivative|matrix|algebra|calculus|trigonometry|physics|chemistry|biology|math|mathematics)\b/,
      /\b(recipe|cook|cooking|meal|restaurant|travel itinerary|trip itinerary|hotel|flight|tourist|vacation)\b/,
      /\b(movie|music|song|gaming|video game|sports|cricket|football|score|celebrity|netflix)\b/,
      /\b(weather|temperature|forecast|joke|poem|story|horoscope|astrology)\b/,
      /\b(medical advice|diagnose|symptom|treatment|medicine|doctor)\b/,
      /\b(stock price|crypto|bitcoin|investment advice|portfolio)\b/,
      /\b(politics|election|vote for|political party)\b(?!.*\b(law|legal|constitution|statute|court)\b)/,
      /\b(capital of|who won|latest score|tell me a joke|write a poem|bedtime story)\b/,
      /\b(personal advice|relationship advice|dating|breakup)\b/,
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  private hasLegalSignal(query: string): boolean {
    const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
    
    const coreLegal = /\b(laws?|legal(ly)?|court(s)?|tribunals?|judges?|judiciary|constitution(al)?s?|articles?\s+\d+|sections?\s+\d+|statutes?|acts?|rules?|regulations?|legislat(ion|ive|ure))\b/;
    const roles = /\b(petitioners?|respondents?|plaintiffs?|defendants?|appellants?|accused|complainants?|witness(es)?|victims?|counsels?|advocates?|attorneys?|lawyers?)\b/;
    const maxims = /\b(mens\s+rea|actus\s+reus|ratio\s+decidendi|obiter\s+dicta|stare\s+decisis|ultra\s+vires|locus\s+standi|res\s+judicata)\b/;
    const remedies = /\b(judicial\s+reviews?|basic\s+structures?|fundamental\s+rights?|directive\s+principles?|writs?|habeas\s+corpus|mandamus|certiorari|prohibitions?|quo\s+warranto)\b/;
    const concepts = /\b(negligence|torts?|evidences?|bail(s)?|firs?|arbitrations?|mediations?|trademarks?|patents?|copyrights?|contracts?|agreements?|ndas?|compliance|warrants?)\b/;
    const activities = /\b(moots?|memorials?|drafting|legal\s+research|legal\s+drafting|legal\s+interpretation|legal\s+maxims?|legal\s+education|judgments?|judgements?|case\s+laws?|precedents?|doctrines?|liabilit(y|ies)|remed(y|ies)|injunctions?|damages?|notices?)\b/;
    const actsAndCodes = /\b(bns|bnss|bsa|ipc|crpc|cpc|companies\s+act|income\s+tax\s+act|gst|banking\s+laws?|cyber\s+laws?|labour\s+laws?|labor\s+laws?|tax\s+laws?|family\s+laws?|property\s+laws?|company\s+laws?|environmental\s+laws?|administrative\s+laws?|intellectual\s+propert(y|ies))\b/;
    const courses = /\b(bare\s+acts?|constitutional\s+law|criminal\s+laws?|civil\s+procedures?|contract\s+laws?|evidence\s+laws?|moot\s+courts?)\b/;
    const personalDisputes = /\b(divorce(s|d)?|custody|maintenance|marriages?|domestic\s+violence|abuse?s?|abusive|abusing|harass(ed|ing|s|ment)?|alimony|wills?|succession|inheritances?|property\s+disputes?)\b/;
    const housingDisputes = /\b(tenanc(y|ies)|tenants?|landlords?|evict(ed|ing|s|ion|ions)?|rent(al|s|ed)?|lease?s?|boundary|boundaries|encroachments?|occupied|stole|took|claims?\s+my\s+(land|property|plot))\b/;
    const employmentDisputes = /\b(wrongful\s+terminations?|employment\s+disputes?|labour\s+disputes?|salary|wages?|pay(ment|ments|ing)?|paid|unpaid|withheld|withholding|non-payment|fired|fire|firing|terminate|terminated|dismissed)\b/;
    const cyberDisputes = /\b(cyber\s+crimes?|hacked?|hacking|cyberattacks?|hackers?|scams?|scammed|cyber|fraud(ulent)?|security\s+breach|bank\s+accounts?)\b/;
    const criminalProcedure = /\b(police|cops?|arrest(ed|ing|s)?|warrants?|firs?|complaints?|legal\s+notice)\b/;
    const violencePatterns = /\b(husband|wife|spouse|partner|father|mother|brother|sister)\s+(hits|hit|hitting|abuses|abused|abusing|slapped|slap|slaps|assaulted|assaults|assaulting|beats|beat|beating)\b/;

    const patterns = [
      coreLegal, roles, maxims, remedies, concepts, activities,
      actsAndCodes, courses, personalDisputes, housingDisputes,
      employmentDisputes, cyberDisputes, criminalProcedure, violencePatterns
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

}
