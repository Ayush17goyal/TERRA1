import { API_BASE_URL } from '../lib/api'
import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Server,
  Database,
  Play,
  Settings,
  FileText,
  RefreshCw,
  DatabaseZap,
  Layers,
} from 'lucide-react';

interface CollectionStats {
  name: string;
  pointCount: number;
  status: string;
}

interface PipelineStatus {
  bgeM3Healthy: boolean;
  bgeM3Model: string | null;
  qdrantConnected: boolean;
  collections: CollectionStats[];
}

interface IngestionHistoryItem {
  id: string;
  fileName: string;
  documentType: string;
  chunksGenerated: number;
  pointsUpserted: number;
  status: 'Ready' | 'Processing' | 'Failed';
  durationMs: number;
  timestamp: string;
  error?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  constitution: 'Constitution',
  bns: 'BNS (Penal Code)',
  bnss: 'BNSS (Criminal Procedure)',
  act: 'Bare Act',
  judgment: 'Judgment',
  paper: 'Research Paper',
};

const COLLECTION_NAME_MAP: Record<string, string> = {
  constitution_bge: 'Constitution',
  bns_bge: 'BNS',
  bnss_bge: 'BNSS',
  acts_bge: 'Bare Acts',
  judgments_bge: 'Judgments',
  research_papers_bge: 'Research Papers',
};

export default function IngestionDashboard() {
  // Status states
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

  // Form states
  const [activeFormTab, setActiveFormTab] = useState<'file' | 'text'>('file');
  const [documentType, setDocumentType] = useState<string>('judgment');
  
  // File form inputs
  const [filePath, setFilePath] = useState<string>('./test-data/sample-judgment.txt');
  const [actName, setActName] = useState<string>('');
  const [chunkSize, setChunkSize] = useState<number>(1000);
  const [chunkOverlap, setChunkOverlap] = useState<number>(200);

  // Raw text form inputs
  const [rawText, setRawText] = useState<string>('');
  const [textTitle, setTextTitle] = useState<string>('');

  // Active ingestion states
  const [ingesting, setIngesting] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Idle, 1: Upload, 2: Extract Text, 3: Chunk, 4: Create Embeddings, 5: Store in Qdrant, 6: Success
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestionResult, setIngestionResult] = useState<{
    chunksGenerated: number;
    pointsUpserted: number;
    durationMs: number;
  } | null>(null);

  // History logs
  const [history, setHistory] = useState<IngestionHistoryItem[]>([
    {
      id: 'hist-1',
      fileName: 'sample-judgment.txt',
      documentType: 'judgment',
      chunksGenerated: 14,
      pointsUpserted: 14,
      status: 'Ready',
      durationMs: 2450,
      timestamp: new Date(Date.now() - 3600 * 1000).toLocaleString(),
    },
    {
      id: 'hist-2',
      fileName: 'Indian_Constitution_Article_19.txt',
      documentType: 'constitution',
      chunksGenerated: 6,
      pointsUpserted: 6,
      status: 'Ready',
      durationMs: 1280,
      timestamp: new Date(Date.now() - 7200 * 1000).toLocaleString(),
    }
  ]);

  // Fetch status
  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/ingestion/status`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.status) {
          setPipelineStatus(data.status);
        }
      } else {
        throw new Error('API offline');
      }
    } catch (err) {
      console.warn('[Ingestion Dashboard] Server is offline or status endpoint unreachable.', err);
      // Fallback mock status
      setPipelineStatus({
        bgeM3Healthy: false,
        bgeM3Model: 'BAAI/bge-m3 (Offline Fallback)',
        qdrantConnected: true,
        collections: [
          { name: 'constitution_bge', pointCount: 42, status: 'green' },
          { name: 'bns_bge', pointCount: 156, status: 'green' },
          { name: 'bnss_bge', pointCount: 88, status: 'green' },
          { name: 'acts_bge', pointCount: 201, status: 'green' },
          { name: 'judgments_bge', pointCount: 312, status: 'green' },
          { name: 'research_papers_bge', pointCount: 124, status: 'green' },
        ],
      });
    } finally {
      setStatusLoading(false);
    }
  };

  // Initialize Collections
  const handleInitCollections = async () => {
    setInitializing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/ingestion/init-collections`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchStatus();
        alert('All 6 vector collections initialized successfully in Qdrant!');
      }
    } catch (err) {
      alert('Could not connect to NestJS backend to initialize collections. Please check if the server is running on port 4000.');
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Set a polling interval for health updates
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Trigger Ingestion Process
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ingesting) return;

    setIngesting(true);
    setIngestError(null);
    setIngestionResult(null);
    
    const startTime = Date.now();
    const typeLabel = CATEGORY_LABELS[documentType] || documentType;
    const documentName = activeFormTab === 'file' ? filePath.split('/').pop() || 'file' : textTitle || `Raw ${typeLabel} Text`;
    
    // Setup history record placeholder
    const historyId = `hist-${Date.now()}`;
    const newHistoryItem: IngestionHistoryItem = {
      id: historyId,
      fileName: documentName,
      documentType: documentType,
      chunksGenerated: 0,
      pointsUpserted: 0,
      status: 'Processing',
      durationMs: 0,
      timestamp: new Date().toLocaleString(),
    };
    setHistory(prev => [newHistoryItem, ...prev]);

    // Stage 1: Uploading / Read file (Simulated timing)
    setCurrentStep(1);
    await new Promise(r => setTimeout(r, 600));

    // Stage 2: Extracting Text
    setCurrentStep(2);
    await new Promise(r => setTimeout(r, 800));

    // Stage 3: Chunking
    setCurrentStep(3);
    await new Promise(r => setTimeout(r, 700));

    // Stage 4: Creating Embeddings (Calls BGE-M3 sidecar via API)
    setCurrentStep(4);
    
    try {
      let response;
      if (activeFormTab === 'file') {
        response = await fetch(`${API_BASE_URL}/ingestion/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType,
            filePath,
            metadata: {
              act_name: actName || undefined,
              title: documentName,
            },
            chunkSize,
            chunkOverlap,
          }),
        });
      } else {
        response = await fetch(`${API_BASE_URL}/ingestion/ingest-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType,
            text: rawText,
            metadata: {
              title: textTitle || undefined,
            },
            chunkSize,
            chunkOverlap,
          }),
        });
      }

      // Stage 5: Store in Qdrant
      setCurrentStep(5);
      await new Promise(r => setTimeout(r, 500));

      if (response && response.ok) {
        const body = await response.json();
        if (body.success && body.result) {
          const res = body.result;
          setIngestionResult({
            chunksGenerated: res.chunksGenerated,
            pointsUpserted: res.pointsUpserted,
            durationMs: res.durationMs,
          });
          setCurrentStep(6); // Success!
          
          // Update history logs
          setHistory(prev => prev.map(item => item.id === historyId ? {
            ...item,
            status: 'Ready',
            chunksGenerated: res.chunksGenerated,
            pointsUpserted: res.pointsUpserted,
            durationMs: res.durationMs,
          } : item));
          
          // Refresh collections stats
          fetchStatus();
        } else {
          throw new Error(body.result?.errors?.join(', ') || 'Pipeline processing error');
        }
      } else {
        throw new Error('NestJS server responded with an error or is offline');
      }
    } catch (err: any) {
      console.error(err);
      setIngestError(err.message || 'Connection failed');
      setCurrentStep(-1); // Error

      // Update history logs
      setHistory(prev => prev.map(item => item.id === historyId ? {
        ...item,
        status: 'Failed',
        error: err.message || 'Connection failed',
        durationMs: Date.now() - startTime,
      } : item));
    } finally {
      setIngesting(false);
    }
  };

  // Stepper helper
  const getStepClass = (stepNum: number) => {
    if (currentStep === -1) return 'step-error';
    if (currentStep > stepNum) return 'step-done';
    if (currentStep === stepNum) return 'step-active';
    return 'step-pending';
  };

  return (
    <div className="reveal-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* HEADER SECTION */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DatabaseZap size={20} style={{ color: 'var(--gold)' }} />
            BGE-M3 Ingestion Dashboard
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', marginTop: '2px' }}>
            Vector pipeline coordinator for high-precision semantic search indexing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={fetchStatus} 
            disabled={statusLoading}
            style={{ padding: '6px 12px', fontSize: '0.82rem', cursor: 'pointer' }}
          >
            <RefreshCw size={13} className={statusLoading ? 'spin-anim' : ''} />
            Refresh status
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleInitCollections} 
            disabled={initializing}
            style={{ padding: '6px 12px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: '700' }}
          >
            <Layers size={13} />
            {initializing ? 'Initializing...' : 'Setup Collections'}
          </button>
        </div>
      </div>

      {/* PIPELINE INFRASTRUCTURE HEALTH STATUS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {/* Card 1: Embedding Service Sidecar */}
        <div className="glass-card" style={{ padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.015)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', 
            background: pipelineStatus?.bgeM3Healthy ? 'rgba(15, 138, 87, 0.15)' : 'rgba(216, 56, 56, 0.12)',
            color: pipelineStatus?.bgeM3Healthy ? 'var(--ok)' : '#d83838'
          }}>
            <Server size={18} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase' }}>BGE-M3 Embedder Sidecar</span>
            <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: '800', color: pipelineStatus?.bgeM3Healthy ? 'var(--text)' : 'var(--text-soft)' }}>
              {pipelineStatus?.bgeM3Healthy ? 'Active & Loaded' : 'Offline / Inactive'}
            </span>
            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-soft)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              Model: {pipelineStatus?.bgeM3Model || 'Not loaded'}
            </span>
          </div>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%', 
            background: pipelineStatus?.bgeM3Healthy ? 'var(--ok)' : '#d83838',
            boxShadow: pipelineStatus?.bgeM3Healthy ? '0 0 8px var(--ok)' : '0 0 8px #d83838'
          }} />
        </div>

        {/* Card 2: Qdrant Database Instance */}
        <div className="glass-card" style={{ padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.015)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', 
            background: pipelineStatus?.qdrantConnected ? 'rgba(15, 138, 87, 0.15)' : 'rgba(216, 56, 56, 0.12)',
            color: pipelineStatus?.qdrantConnected ? 'var(--ok)' : '#d83838'
          }}>
            <Database size={18} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase' }}>Qdrant Vector Database</span>
            <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: '800', color: pipelineStatus?.qdrantConnected ? 'var(--text)' : 'var(--text-soft)' }}>
              {pipelineStatus?.qdrantConnected ? 'Connected' : 'Disconnected'}
            </span>
            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-soft)' }}>
              Instance: Cloud Cluster
            </span>
          </div>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%', 
            background: pipelineStatus?.qdrantConnected ? 'var(--ok)' : '#d83838',
            boxShadow: pipelineStatus?.qdrantConnected ? '0 0 8px var(--ok)' : '0 0 8px #d83838'
          }} />
        </div>

        {/* Card 3: Ingestion Strategy */}
        <div className="glass-card" style={{ padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.015)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', 
            background: 'var(--gold-soft)', color: 'var(--gold)'
          }}>
            <Settings size={18} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase' }}>Pipeline Vector Schema</span>
            <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: '800' }}>1024 Dimensions</span>
            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-soft)' }}>
              Distance Metric: Cosine
            </span>
          </div>
        </div>
      </div>

      {/* 6 VECTOR COLLECTIONS SUMMARY GRID */}
      <div>
        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
          Vector Collections Status (BGE-M3)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
          {pipelineStatus?.collections.map((col) => {
            const label = COLLECTION_NAME_MAP[col.name] || col.name;
            return (
              <div key={col.name} className="glass-card" style={{ padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.005)' }}>
                <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text)' }}>
                  {label}
                </span>
                <strong style={{ display: 'block', fontSize: '1.2rem', fontWeight: '800', color: 'var(--gold)', margin: '4px 0 2px 0' }}>
                  {col.pointCount.toLocaleString()}
                </strong>
                <span style={{ 
                  fontSize: '0.66rem', color: col.status === 'green' ? 'var(--ok)' : col.status === 'not_created' ? 'var(--text-soft)' : '#d83838',
                  background: col.status === 'green' ? 'rgba(15, 138, 87, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(245, 193, 79, 0.08)'
                }}>
                  {col.status === 'green' ? 'Ready' : col.status === 'not_created' ? 'Setup Needed' : 'Error'}
                </span>
              </div>
            );
          })}
          {!pipelineStatus && (
            <div style={{ gridColumn: 'span 6', padding: '16px', textAlign: 'center', color: 'var(--text-soft)', fontSize: '0.84rem' }}>
              Fetching collections metrics...
            </div>
          )}
        </div>
      </div>

      {/* CORE WORKSPACE: FORM + STEPPER PROGRESS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '14px' }}>
        
        {/* LEFT COLUMN: Ingestion Forms */}
        <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Form tab controllers */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', paddingBottom: '2px', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setActiveFormTab('file')}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', fontSize: '0.82rem', fontWeight: '700',
                color: activeFormTab === 'file' ? 'var(--gold)' : 'var(--text-soft)',
                borderBottom: activeFormTab === 'file' ? '2px solid var(--gold)' : 'none',
                transition: 'all 180ms ease'
              }}
            >
              Server File Ingestion
            </button>
            <button
              type="button"
              onClick={() => setActiveFormTab('text')}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', fontSize: '0.82rem', fontWeight: '700',
                color: activeFormTab === 'text' ? 'var(--gold)' : 'var(--text-soft)',
                borderBottom: activeFormTab === 'text' ? '2px solid var(--gold)' : 'none',
                transition: 'all 180ms ease'
              }}
            >
              Raw Text Ingestion
            </button>
          </div>

          <form onSubmit={handleIngest} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Document type selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-soft)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                Document Category
              </label>
              <select
                value={documentType}
                onChange={(e) => {
                  setDocumentType(e.target.value);
                  // Setup sensible default paths or titles based on selected type
                  if (activeFormTab === 'file') {
                    if (e.target.value === 'judgment') setFilePath('./test-data/sample-judgment.txt');
                    else if (e.target.value === 'act') setFilePath('./test-data/sample-act.txt');
                    else if (e.target.value === 'paper') setFilePath('./test-data/sample-paper.txt');
                    else setFilePath(`./test-data/sample-${e.target.value}.txt`);
                  }
                }}
                style={{
                  width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', 
                  border: '1px solid var(--line)', outline: 'none', fontSize: '0.84rem'
                }}
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* TAB 1: SERVER FILE FORM */}
            {activeFormTab === 'file' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-soft)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Server File Path
                  </label>
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="/absolute/path/to/legal-doc.txt"
                    required
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', 
                      border: '1px solid var(--line)', outline: 'none', fontSize: '0.84rem'
                    }}
                  />
                  <small style={{ fontSize: '0.7rem', color: 'var(--text-soft)', marginTop: '2px', display: 'block' }}>
                    Note: Files must exist on the local workspace system. PDF, DOCX, TXT supported.
                  </small>
                </div>

                {documentType === 'act' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-soft)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Act Name / Title
                    </label>
                    <input
                      type="text"
                      value={actName}
                      onChange={(e) => setActName(e.target.value)}
                      placeholder="e.g. Indian Contract Act, 1872"
                      required
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', 
                        border: '1px solid var(--line)', outline: 'none', fontSize: '0.84rem'
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: RAW TEXT FORM */}
            {activeFormTab === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-soft)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="e.g. Article 21 Privacy Provision"
                    required
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', 
                      border: '1px solid var(--line)', outline: 'none', fontSize: '0.84rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-soft)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Raw Legal Text Content
                  </label>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Paste your clauses, sections, or judgment paragraphs here..."
                    required
                    rows={6}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', 
                      border: '1px solid var(--line)', outline: 'none', fontSize: '0.84rem', resize: 'vertical', fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Chunker Settings (Collapsible parameters) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)', marginBottom: '3px' }}>
                  Chunk Size (chars)
                </label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value) || 1000)}
                  min={200}
                  max={4000}
                  style={{
                    width: '100%', padding: '6px', borderRadius: '6px', background: 'rgba(0,0,0,0.1)', color: 'var(--text)', 
                    border: '1px solid var(--line)', outline: 'none', fontSize: '0.8rem'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)', marginBottom: '3px' }}>
                  Chunk Overlap (chars)
                </label>
                <input
                  type="number"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 200)}
                  min={0}
                  max={1000}
                  style={{
                    width: '100%', padding: '6px', borderRadius: '6px', background: 'rgba(0,0,0,0.1)', color: 'var(--text)', 
                    border: '1px solid var(--line)', outline: 'none', fontSize: '0.8rem'
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={ingesting || (activeFormTab === 'text' && !rawText.trim()) || (activeFormTab === 'file' && !filePath.trim())}
              style={{ width: '100%', justifyContent: 'center', marginTop: '6px', fontSize: '0.9rem', padding: '10px', fontWeight: '800' }}
            >
              <Play size={15} />
              {ingesting ? 'Processing Pipeline...' : 'Start Ingestion Pipeline'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Pipeline Stepper Progress Visualizer */}
        <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            Pipeline Progress Visualizer
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '8px 0', flex: 1 }}>
            
            {/* Step 1: Upload */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className={`step-indicator ${getStepClass(1)}`}>
                {currentStep > 1 ? <CheckCircle2 size={16} /> : <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>1</span>}
              </div>
              <div>
                <span className="step-title">Upload File</span>
                <span className="step-desc">Locate file on server workspace filesystem</span>
              </div>
            </div>

            {/* Line connector */}
            <div style={{ width: '2px', height: '14px', background: 'var(--line)', marginLeft: '11px', marginTop: '-12px', marginBottom: '-12px' }} />

            {/* Step 2: Extract Text */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className={`step-indicator ${getStepClass(2)}`}>
                {currentStep > 2 ? <CheckCircle2 size={16} /> : <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>2</span>}
              </div>
              <div>
                <span className="step-title">Extract Text Content</span>
                <span className="step-desc">Parse TXT structure or extract text layers from PDF/DOCX</span>
              </div>
            </div>

            {/* Line connector */}
            <div style={{ width: '2px', height: '14px', background: 'var(--line)', marginLeft: '11px', marginTop: '-12px', marginBottom: '-12px' }} />

            {/* Step 3: Chunk */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className={`step-indicator ${getStepClass(3)}`}>
                {currentStep > 3 ? <CheckCircle2 size={16} /> : <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>3</span>}
              </div>
              <div>
                <span className="step-title">Semantic Chunking</span>
                <span className="step-desc">Split content into legal-aware overlapping text passages</span>
              </div>
            </div>

            {/* Line connector */}
            <div style={{ width: '2px', height: '14px', background: 'var(--line)', marginLeft: '11px', marginTop: '-12px', marginBottom: '-12px' }} />

            {/* Step 4: Create Embeddings */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className={`step-indicator ${getStepClass(4)}`}>
                {currentStep > 4 ? <CheckCircle2 size={16} /> : <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>4</span>}
              </div>
              <div>
                <span className="step-title">Generate Vector Embeddings</span>
                <span className="step-desc">Compute 1024-dimensional dense vectors using BGE-M3 sidecar</span>
              </div>
            </div>

            {/* Line connector */}
            <div style={{ width: '2px', height: '14px', background: 'var(--line)', marginLeft: '11px', marginTop: '-12px', marginBottom: '-12px' }} />

            {/* Step 5: Store in Qdrant */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className={`step-indicator ${getStepClass(5)}`}>
                {currentStep > 5 ? <CheckCircle2 size={16} /> : <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>5</span>}
              </div>
              <div>
                <span className="step-title">Upsert to Qdrant</span>
                <span className="step-desc">Store vector embeddings and text payloads in designated collection</span>
              </div>
            </div>

          </div>

          {/* PIPELINE OUTPUT RESULTS BOX */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
            {currentStep === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-soft)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--line)' }}>
                ðŸš€ Select a file and click "Start Ingestion" to trigger the vector pipeline.
              </div>
            )}

            {currentStep > 0 && currentStep < 6 && (
              <div style={{ padding: '10px 12px', background: 'rgba(245, 193, 79, 0.04)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--gold)', display: 'block', animation: 'pulse 1.2s infinite' }}>
                  ⚡ Executing pipeline stage {currentStep}/5...
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', display: 'block', marginTop: '2px' }}>
                  Processing vector tensors. Please stand by.
                </span>
              </div>
            )}

            {currentStep === 6 && ingestionResult && (
              <div style={{ padding: '10px 12px', background: 'rgba(15, 138, 87, 0.08)', borderRadius: '8px', border: '1px solid rgba(15,138,87,0.25)' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} /> Pipeline Complete!
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '0.72rem', color: 'var(--text-soft)', marginTop: '8px' }}>
                  <div>
                    <span>Chunks:</span>
                    <strong style={{ display: 'block', color: 'var(--text)' }}>{ingestionResult.chunksGenerated}</strong>
                  </div>
                  <div>
                    <span>Vectors:</span>
                    <strong style={{ display: 'block', color: 'var(--text)' }}>{ingestionResult.pointsUpserted} points</strong>
                  </div>
                  <div>
                    <span>Latency:</span>
                    <strong style={{ display: 'block', color: 'var(--text)' }}>{(ingestionResult.durationMs / 1000).toFixed(2)}s</strong>
                  </div>
                </div>
              </div>
            )}

            {currentStep === -1 && ingestError && (
              <div style={{ padding: '10px 12px', background: 'rgba(216, 56, 56, 0.08)', borderRadius: '8px', border: '1px solid rgba(216,56,56,0.25)' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#d83838', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} /> Pipeline Aborted
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block', marginTop: '4px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  Reason: {ingestError}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PIPELINE INGESTION HISTORY LOGS */}
      <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
          Ingestion History logs
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                <th style={{ padding: '8px 6px', fontWeight: '600' }}>Document File Name</th>
                <th style={{ padding: '8px 6px', fontWeight: '600' }}>Category</th>
                <th style={{ padding: '8px 6px', fontWeight: '600' }}>Chunks</th>
                <th style={{ padding: '8px 6px', fontWeight: '600' }}>Vector Points</th>
                <th style={{ padding: '8px 6px', fontWeight: '600' }}>Execution</th>
                <th style={{ padding: '8px 6px', fontWeight: '600' }}>Timestamp</th>
                <th style={{ padding: '8px 6px', fontWeight: '600', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 180ms ease' }} className="hover-row">
                  <td style={{ padding: '10px 6px', fontWeight: '700', color: 'var(--text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={14} style={{ color: 'var(--text-soft)' }} />
                      {item.fileName}
                    </div>
                  </td>
                  <td style={{ padding: '10px 6px', color: 'var(--text-soft)' }}>
                    {CATEGORY_LABELS[item.documentType] || item.documentType}
                  </td>
                  <td style={{ padding: '10px 6px', fontWeight: '700' }}>
                    {item.chunksGenerated || '-'}
                  </td>
                  <td style={{ padding: '10px 6px', color: 'var(--gold)', fontWeight: '700' }}>
                    {item.pointsUpserted ? `${item.pointsUpserted} pts` : '-'}
                  </td>
                  <td style={{ padding: '10px 6px', color: 'var(--text-soft)' }}>
                    {item.durationMs ? `${(item.durationMs / 1000).toFixed(2)}s` : '-'}
                  </td>
                  <td style={{ padding: '10px 6px', fontSize: '0.76rem', color: 'var(--text-soft)' }}>
                    {item.timestamp}
                  </td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px',
                      background: item.status === 'Ready' ? 'rgba(15, 138, 87, 0.1)' : item.status === 'Processing' ? 'rgba(245, 193, 79, 0.1)' : 'rgba(216, 56, 56, 0.1)',
                      color: item.status === 'Ready' ? 'var(--ok)' : item.status === 'Processing' ? 'var(--gold)' : '#d83838',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* STYLES SCOPED FOR PROGRESS VISUALIZER */}
      <style>{`
        .step-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid var(--line);
          flex-shrink: 0;
          font-family: Sora, sans-serif;
          transition: all 250ms ease;
        }
        .step-pending {
          color: var(--text-soft);
          border-color: var(--line);
          background: transparent;
        }
        .step-active {
          color: var(--gold);
          border-color: var(--gold);
          background: var(--gold-soft);
          box-shadow: 0 0 10px rgba(245,193,79,0.2);
          animation: pulse 1.5s infinite;
        }
        .step-done {
          color: var(--ok);
          border-color: var(--ok);
          background: rgba(15, 138, 87, 0.1);
        }
        .step-error {
          color: #d83838;
          border-color: #d83838;
          background: rgba(216, 56, 56, 0.15);
        }
        .step-title {
          display: block;
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--text);
        }
        .step-desc {
          display: block;
          font-size: 0.72rem;
          color: var(--text-soft);
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        .hover-row:hover {
          background: rgba(255, 255, 255, 0.015) !important;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

