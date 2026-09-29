export interface VectorPayload {
  document_type: string;
  text: string;
  [key: string]: any;
}

export interface JudgmentPayload extends VectorPayload {
  title: string;
  court: string;
  citation: string;
  year: string;
  judges: string[];
  source_url: string;
  document_type: 'judgment';
}

export interface ActPayload extends VectorPayload {
  title: string;
  act_name: string;
  section: string;
  chapter: string;
  source_url: string;
  document_type: 'act';
}

export interface ResearchPaperPayload extends VectorPayload {
  title: string;
  authors: string[];
  year: string;
  journal: string;
  source_url: string;
  document_type: 'paper';
}

export interface LawCommissionPayload extends VectorPayload {
  title: string;
  report_number: string;
  year: string;
  source_url: string;
  document_type: 'report';
}

export interface UserDocumentPayload extends VectorPayload {
  user_id: string;
  file_name: string;
  document_type: string;
  uploaded_at: string;
}
