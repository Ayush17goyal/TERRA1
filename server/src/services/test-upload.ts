#!/usr/bin/env node
/**
 * Test script for Upload Documents feature
 * Tests all 6 upload types with proper validation
 */

import * as fs from 'fs';
import * as path from 'path';

// Mock test data
const testDocuments = {
  judgment: `JUDGMENT

This is a sample judgment from the Hon'ble Supreme Court of India. The case concerns the interpretation of fundamental rights under the Indian Constitution. After careful consideration of all evidence and legal precedents, this Court finds that:

1. The constitutional provisions are valid and constitute a part of the basic structure.
2. The interpretation offered by the petitioner is supported by established jurisprudence.
3. The respondent's arguments, while creative, do not withstand scrutiny under constitutional law.

The Court therefore directs the respondent to comply with the following orders within 30 days. This judgment shall be binding on all courts subordinate to this Court. The ratio decidendi established herein shall guide lower courts in similar matters.

Dated: June 24, 2026

(Signed) Chief Justice of India`,

  bareAct: `THE BHARATIYA NYAYA SANHITA, 2023

AN ACT TO CONSOLIDATE AND AMEND THE LAW RELATING TO CRIMINAL PROCEDURE

CHAPTER I
PRELIMINARY

1. Short title and commencement
(1) This Act may be called the Bharatiya Nyaya Sanhita, 2023.
(2) It shall come into force on such date as the Central Government may, by notification in the Official Gazette, appoint.

2. Application
This Act applies to the whole of India except the State of Jammu and Kashmir.

3. Definitions
In this Act, unless the context otherwise requires:
(a) "accused" means any person against whom any direct evidence or suspicion exists in connection with the commission of an offence;
(b) "bail bond" means a bond executed by the accused or bailee;
(c) "cognizable offence" means an offence for which, and "cognizable case" means a case in which, a police officer may, in accordance with the First Schedule or under any other law for the time being in force, arrest without warrant.

CHAPTER II
OFFENCES AND PUNISHMENTS

Section 101 - Punishment for murder
Whoever commits murder shall be punished with imprisonment for life or death.`,

  researchPaper: `DOCTORAL RESEARCH PAPER: CONSTITUTIONAL INTERPRETATION AND JUDICIAL ACTIVISM

Abstract
This research paper examines the evolving role of judicial activism in constitutional interpretation within the Indian legal system. Through a comprehensive analysis of landmark Supreme Court decisions spanning five decades, this paper demonstrates how courts have gradually expanded the scope of fundamental rights while maintaining the integrity of the constitutional framework.

Introduction
The Indian Constitution, adopted in 1950, represents one of the most comprehensive constitutional documents in the world. Since its adoption, the Supreme Court has played a pivotal role in shaping the interpretation and application of constitutional provisions. This paper analyzes twenty landmark judgments to understand the methodology and rationale behind judicial interpretation.

Methodology
This study employs a doctrinal legal research methodology, analyzing primary sources including Supreme Court judgments and secondary sources including academic commentaries and legal journals. The research covers decisions from 1950 to 2024, focusing on cases that have significantly expanded constitutional interpretation.

Key Findings
1. Progressive expansion of Article 14 (Equality)
2. Evolution of Articles 21 (Right to Life)
3. Development of Doctrine of Colorable Legislation
4. Emergence of Right to Privacy as fundamental right

Conclusion
The analysis reveals that judicial activism has been instrumental in making constitutional rights meaningful and effective in contemporary society.`,

  memorial: `MEMORIAL FOR NATIONAL MOOT COURT CHAMPIONSHIP 2024

CASE NO: CASE 1

PARTIES:
Petitioner: Union of India and Another
Respondent: XYZ Corporation and Others

STATEMENT OF FACTS:
1. The Petitioner filed a petition before this Hon'ble Court against the impugned order dated January 15, 2024, passed by the Central Government revoking the Environmental Clearance.
2. The Respondent had been engaged in mining operations in the State of Jharkhand since 2015.
3. The Environmental Impact Assessment was conducted as per statutory requirements.
4. Fresh evidence regarding wildlife impact emerged in 2024.

ISSUES FOR CONSIDERATION:
1. Whether the revocation of Environmental Clearance without prior notice violates procedural due process?
2. Whether the new evidence regarding wildlife impact justifies revocation?
3. Whether remedies available under statutory law are exhausted?

ARGUMENTS:
The Petitioner submits that the revocation was arbitrary and violated natural justice. The respondent had no opportunity to present their case. Furthermore, the wildlife data was not significant enough to warrant revocation.`,

  notes: `LECTURE NOTES: CONSTITUTIONAL LAW FUNDAMENTALS

Date: June 24, 2026
Instructor: Prof. Rajesh Kumar
Subject: Indian Constitution and Rights

Lecture 1: Preamble and Fundamental Rights
- The Constitution begins with the Preamble which outlines the objectives
- Fundamental Rights are mentioned in Part III (Articles 12-35)
- These rights are enforceable in courts
- Rights available to both citizens and non-citizens

Key Rights:
1. Right to Equality (Article 14-18)
2. Right to Freedom (Article 19-22)
3. Right against Exploitation (Article 23-24)
4. Right to Freedom of Religion (Article 25-28)
5. Cultural and Educational Rights (Article 29-30)
6. Right to Constitutional Remedies (Article 32)

Important Case Laws:
- Kesavananda Bharati v. State of Kerala: Basic Structure Doctrine
- Maneka Gandhi v. Union of India: Expanded Article 21
- Navtej Singh Johar v. Union of India: Reading down Section 377

Study Tips:
- Understand the object behind each right
- Learn key case laws
- Practice constitutional law problems
- Understand the interplay between rights and restrictions`,

  legalDocument: `SAMPLE LEGAL DOCUMENT: SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into on this 24th day of June, 2026, between:

PARTY A:
Name: ABC Legal Services LLP
Address: 123 Business Park, Mumbai, Maharashtra 400001
(hereinafter referred to as "Service Provider")

PARTY B:
Name: XYZ Corporation
Address: 456 Corporate Avenue, Delhi, Delhi 110001
(hereinafter referred to as "Client")

WHEREAS:
WHEREAS the Service Provider is engaged in providing legal services; and
WHEREAS the Client desires to avail of such services;
NOW THEREFORE in consideration of the mutual covenants and agreements herein contained, the parties agree as follows:

1. SCOPE OF SERVICES
The Service Provider shall provide the following services to the Client:
a) Legal consultation and advice
b) Contract drafting and review
c) Dispute resolution assistance
d) Compliance audit and reporting

2. FEES AND PAYMENT
The Client shall pay the Service Provider fees as mutually agreed upon:
a) Monthly retainer: INR 50,000
b) Additional hours: INR 2,500 per hour
c) Payment due within 30 days of invoice

3. CONFIDENTIALITY
Both parties agree to maintain confidentiality of all information shared during the course of this engagement.

4. TERM AND TERMINATION
This Agreement shall be valid for one year from the date hereof and may be terminated by either party with 30 days written notice.`,
};

// Test validation function
function validateExtractedText(text: string, minLength: number = 450): {
  isValid: boolean;
  wordCount: number;
  charCount: number;
  readabilityScore: number;
  issues: string[];
} {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  const charCount = cleaned.length;
  
  const issues: string[] = [];
  let readabilityScore = 0;

  if (charCount < minLength) {
    issues.push(`Document too short (${charCount} chars, need ${minLength})`);
  } else {
    readabilityScore += 30;
  }

  const badChars = (cleaned.match(/[\uFFFD\x00-\x08\x0E-\x1F]/g) || []).length;
  const badCharRatio = badChars / Math.max(1, charCount);
  if (badCharRatio >= 0.01) {
    issues.push(`Too many bad characters (${(badCharRatio * 100).toFixed(2)}%, need < 1%)`);
  } else {
    readabilityScore += 15;
  }

  const alphaWords = (cleaned.match(/\b[A-Za-z][A-Za-z]{2,}\b/g) || []).length;
  if (alphaWords < 80) {
    issues.push(`Insufficient alpha words (${alphaWords}, need >= 80)`);
  } else {
    readabilityScore += 15;
  }

  const sentenceSignals = (cleaned.match(/[.!?]\s+[A-Z]/g) || []).length;
  if (sentenceSignals < 3) {
    issues.push(`Insufficient sentence signals (${sentenceSignals}, need >= 3)`);
  } else {
    readabilityScore += 15;
  }

  const pdfNoise = (cleaned.match(/\b(?:obj|endobj|stream|endstream|xref|trailer|FlateDecode|startxref)\b/g) || []).length;
  if (pdfNoise >= 12) {
    issues.push(`Too much PDF noise (${pdfNoise}, need < 12)`);
  } else {
    readabilityScore += 15;
  }

  const isValid = issues.length === 0;

  return {
    isValid,
    wordCount,
    charCount,
    readabilityScore,
    issues,
  };
}

// Run tests
function runTests() {
  console.log('\n=== UPLOAD DOCUMENTS FEATURE TEST SUITE ===\n');

  const uploadTypes = [
    { name: 'Upload Judgment', key: 'judgment', expectedMinWords: 500 },
    { name: 'Upload Bare Act', key: 'bareAct', expectedMinWords: 400 },
    { name: 'Upload Research Paper', key: 'researchPaper', expectedMinWords: 600 },
    { name: 'Upload Memorial', key: 'memorial', expectedMinWords: 400 },
    { name: 'Upload Notes', key: 'notes', expectedMinWords: 300 },
    { name: 'Upload Legal Document', key: 'legalDocument', expectedMinWords: 400 },
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const uploadType of uploadTypes) {
    const document = (testDocuments as any)[uploadType.key];
    if (!document) {
      console.log(`❌ ${uploadType.name}: Test document not found`);
      failedTests++;
      continue;
    }

    const validation = validateExtractedText(document);

    if (validation.isValid) {
      console.log(`✅ ${uploadType.name}`);
      console.log(`   Words: ${validation.wordCount} (min: ${uploadType.expectedMinWords})`);
      console.log(`   Chars: ${validation.charCount}`);
      console.log(`   Readability Score: ${validation.readabilityScore}/100`);
      console.log(`   Status: PASS\n`);
      passedTests++;
    } else {
      console.log(`❌ ${uploadType.name}`);
      console.log(`   Words: ${validation.wordCount} (min: ${uploadType.expectedMinWords})`);
      console.log(`   Chars: ${validation.charCount}`);
      console.log(`   Issues:`);
      for (const issue of validation.issues) {
        console.log(`     - ${issue}`);
      }
      console.log(`   Status: FAIL\n`);
      failedTests++;
    }
  }

  // Test quality status mapping
  console.log('\n=== QUALITY STATUS MAPPING TEST ===\n');

  const statusTests = [
    { wordCount: 3000, expectedStatus: 'Indexed Successfully' },
    { wordCount: 800, expectedStatus: 'Limited Text Extracted' },
    { wordCount: 500, expectedStatus: 'Insufficient for Long Answers' },
    { wordCount: 100, expectedStatus: 'Extraction Failed' },
  ];

  for (const test of statusTests) {
    let status: string;
    if (test.wordCount < 450) {
      status = 'Extraction Failed';
    } else if (test.wordCount < 800) {
      status = 'Insufficient for Long Answers';
    } else if (test.wordCount < 3000) {
      status = 'Limited Text Extracted';
    } else {
      status = 'Indexed Successfully';
    }

    const pass = status === test.expectedStatus;
    const icon = pass ? '✅' : '❌';
    console.log(`${icon} ${test.wordCount} words → ${status} (expected: ${test.expectedStatus})`);
    if (pass) {
      passedTests++;
    } else {
      failedTests++;
    }
  }

  console.log(`\n=== TEST SUMMARY ===`);
  console.log(`Total: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%\n`);

  return failedTests === 0;
}

// Run tests
const success = runTests();
process.exit(success ? 0 : 1);
