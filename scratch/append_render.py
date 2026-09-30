# Script to append JSX render to MockTestPlatform.tsx
import sys

jsx_code = r'''
  const panel = 'var(--panel)', panelStrong = 'var(--panel-strong)', bgElev = 'var(--bg-elev)', cardAlt = 'var(--card-alt)'
  const line = 'var(--line)', text = 'var(--text)', textSoft = 'var(--text-soft)', gold = 'var(--gold)', bg = 'var(--bg)'

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, padding: '24px', fontFamily: 'inherit', boxSizing: 'border-box' }}>
      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }} />
      <input type="file" ref={sheetInputRef} onChange={handleHandwrittenUpload} accept="image/*,.pdf" style={{ display: 'none' }} />

      {/* Floating Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
          background: notification.type === 'error' ? '#ef4444' : notification.type === 'info' ? '#3b82f6' : '#10b981',
          color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontWeight: 600, fontSize: 14
        }}>
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: bgElev, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${line}` }}>
            <Sparkles size={24} color={gold} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
              Mock Test Studio & Exam Platform
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 12, background: bgElev, color: gold, border: `1px solid ${line}` }}>
                {flowState}
              </span>
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: textSoft }}>
              Dynamic Section Blueprints • Multi-Type Exams • Grounded in Legal Sources • AI Evaluation
            </p>
          </div>
        </div>

        {/* Top Navigation Tabs */}
        {flowState !== 'ATTEMPT' && (
          <div style={{ display: 'flex', gap: 8, background: bgElev, padding: 4, borderRadius: 10, border: `1px solid ${line}` }}>
            <button
              onClick={() => setActiveMainTab('studio')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: activeMainTab === 'studio' ? panelStrong : 'transparent',
                color: activeMainTab === 'studio' ? text : textSoft,
                boxShadow: activeMainTab === 'studio' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <Layers size={16} /> Studio
            </button>
            <button
              onClick={() => setActiveMainTab('my-tests')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: activeMainTab === 'my-tests' ? panelStrong : 'transparent',
                color: activeMainTab === 'my-tests' ? text : textSoft,
                boxShadow: activeMainTab === 'my-tests' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <BookOpen size={16} /> My Tests ({mockTests.length})
            </button>
          </div>
        )}
      </div>

      {/* TAB: MY TESTS */}
      {activeMainTab === 'my-tests' && flowState !== 'ATTEMPT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Saved Mock Tests & Archives</h2>
            <button
              onClick={() => { setActiveMainTab('studio'); setFlowState('IDLE') }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: gold, color: '#000', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={16} /> Create New Test
            </button>
          </div>

          {mockTests.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', background: panel, borderRadius: 12, border: `1px solid ${line}` }}>
              <BookOpen size={36} color={textSoft} style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>No mock tests generated yet</h3>
              <p style={{ margin: 0, fontSize: 13, color: textSoft }}>Create tests in Studio grounded in legal papers or custom blueprints.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {mockTests.map(t => (
                <div key={t.id} style={{ background: panel, border: `1px solid ${line}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: bgElev, color: gold }}>
                        {t.difficulty || 'Custom'}
                      </span>
                      <span style={{ fontSize: 11, color: textSoft }}>
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>
                      {t.scoreReport?.examTitle || t.topic}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: textSoft, marginBottom: 14 }}>
                      <span>• {t.questions?.length || t.questionCount} Questions</span>
                      <span>• {t.scoreReport?.durationMinutes || 45} mins</span>
                      <span>• {t.scoreReport?.totalMarks || 100} Marks</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${line}` }}>
                    <button
                      onClick={() => handleSelectPastTest(t)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: bgElev, color: text, border: `1px solid ${line}`, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Eye size={15} /> Preview & Practice
                    </button>
                    <button
                      onClick={() => handleDeleteTest(t.id)}
                      style={{ padding: '8px 12px', borderRadius: 8, background: bgElev, color: '#ef4444', border: `1px solid ${line}`, cursor: 'pointer' }}
                      title="Delete Test"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: STUDIO */}
      {activeMainTab === 'studio' && (
        <>
          {/* FLOW: IDLE or GENERATING */}
          {(flowState === 'IDLE' || flowState === 'GENERATING') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* AI Prompt & Generation Panel */}
              <div style={{ background: panel, border: `1px solid ${line}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BrainCircuit size={20} color={gold} />
                    <span style={{ fontWeight: 700, fontSize: 15 }}>AI Test Generator Prompt</span>
                  </div>
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '6px 12px', color: text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Settings2 size={14} /> {showConfig ? 'Hide Blueprint' : 'Configure Blueprint & Rules'}
                  </button>
                </div>

                {/* Prompt Presets */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {PROMPT_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAiPrompt(p.prompt)}
                      style={{ background: bgElev, border: `1px solid ${line}`, borderRadius: 20, padding: '4px 12px', color: textSoft, fontSize: 12, cursor: 'pointer' }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Describe your desired exam (e.g. 'Create a 50-Q Constitutional Law paper with 3 sections...'), or leave blank to generate from your selected reference sources & blueprint."
                    rows={3}
                    style={{ flex: 1, background: bgElev, border: `1px solid ${line}`, borderRadius: 10, padding: 12, color: text, fontSize: 14, resize: 'vertical' }}
                  />
                  <button
                    onClick={handleGenerateTest}
                    disabled={flowState === 'GENERATING' || selectedSourceIds.length === 0}
                    style={{
                      width: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                      background: selectedSourceIds.length > 0 ? gold : bgElev,
                      color: selectedSourceIds.length > 0 ? '#000000' : textSoft,
                      border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
                      cursor: selectedSourceIds.length > 0 && flowState !== 'GENERATING' ? 'pointer' : 'not-allowed',
                      opacity: flowState === 'GENERATING' ? 0.7 : 1
                    }}
                  >
                    {flowState === 'GENERATING' ? (
                      <>
                        <RefreshCw size={22} className="animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={22} />
                        <span>Generate Test</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Blueprint & Configuration Accordion */}
                {showConfig && (
                  <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${line}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: textSoft, marginBottom: 6, fontWeight: 600 }}>Topic / Subject</label>
                        <input
                          type="text"
                          value={testTopic}
                          onChange={e => setTestTopic(e.target.value)}
                          style={{ width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '8px 12px', color: text, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: textSoft, marginBottom: 6, fontWeight: 600 }}>Difficulty</label>
                        <select
                          value={difficulty}
                          onChange={e => setDifficulty(e.target.value)}
                          style={{ width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '8px 12px', color: text, boxSizing: 'border-box' }}
                        >
                          <option value="Beginner">Beginner / Foundational</option>
                          <option value="Intermediate">Intermediate / Degree Level</option>
                          <option value="Advanced">Advanced / Bar Exam</option>
                          <option value="Judiciary">Judiciary / Master Level</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: textSoft, marginBottom: 6, fontWeight: 600 }}>Duration (Minutes)</label>
                        <input
                          type="number"
                          min={5}
                          max={300}
                          value={durationMinutes}
                          onChange={e => setDurationMinutes(parseInt(e.target.value) || 45)}
                          style={{ width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '8px 12px', color: text, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: textSoft, marginBottom: 6, fontWeight: 600 }}>Negative Marking Rate</label>
                        <select
                          value={negativeMarkingRate === null ? 'none' : negativeMarkingRate.toString()}
                          onChange={e => setNegativeMarkingRate(e.target.value === 'none' ? null : parseFloat(e.target.value))}
                          style={{ width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '8px 12px', color: text, boxSizing: 'border-box' }}
                        >
                          <option value="none">No Negative Marking</option>
                          <option value="0.25">0.25 (1/4th Marks)</option>
                          <option value="0.33">0.33 (1/3rd Marks)</option>
                          <option value="0.5">0.5 (Half Mark)</option>
                        </select>
                      </div>
                    </div>

                    {/* Structure Mode Switcher */}
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: textSoft, marginBottom: 8, fontWeight: 600 }}>Section Structure Mode</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[
                          { id: 'reference', label: 'Follow Reference Paper Structure' },
                          { id: 'custom', label: 'Custom Blueprint (Multi-Section)' },
                          { id: 'default', label: 'Standard 3-Tier Exam (A, B, C)' }
                        ].map(m => (
                          <button
                            key={m.id}
                            onClick={() => setStructureMode(m.id as any)}
                            style={{
                              padding: '8px 16px', borderRadius: 8, border: `1px solid ${structureMode === m.id ? gold : line}`,
                              background: structureMode === m.id ? bgElev : 'transparent',
                              color: structureMode === m.id ? text : textSoft,
                              fontWeight: 600, fontSize: 12, cursor: 'pointer'
                            }}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Section Builder (Custom or Reference View) */}
                    <div style={{ background: bgElev, padding: 16, borderRadius: 10, border: `1px solid ${line}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>Exam Sections Blueprint</span>
                          <span style={{ marginLeft: 12, fontSize: 12, color: textSoft }}>
                            Total Max Marks: <strong>{maxMarks(activeSections)}</strong> • Questions: <strong>{activeSections.reduce((s, x) => s + x.questionsGenerated, 0)}</strong>
                          </span>
                        </div>
                        {structureMode === 'custom' && (
                          <button
                            onClick={addSection}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: panel, border: `1px solid ${line}`, padding: '4px 10px', borderRadius: 6, color: text, fontSize: 12, cursor: 'pointer' }}
                          >
                            <Plus size={14} /> Add Section
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {activeSections.map((sec, idx) => (
                          <div key={sec.id} style={{ background: panel, border: `1px solid ${line}`, borderRadius: 8, padding: 14 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                              <input
                                type="text"
                                value={sec.name}
                                disabled={structureMode === 'reference'}
                                onChange={e => updateSection(sec.id, { name: e.target.value })}
                                style={{ fontWeight: 700, fontSize: 14, background: bgElev, border: `1px solid ${line}`, borderRadius: 6, padding: '4px 8px', color: text, width: 140 }}
                              />
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: textSoft, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={sec.isCompulsory}
                                  disabled={structureMode === 'reference'}
                                  onChange={e => updateSection(sec.id, { isCompulsory: e.target.checked })}
                                />
                                Compulsory Section
                              </label>
                              <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12, alignItems: 'center' }}>
                                <span>Generate:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={sec.questionsGenerated}
                                  disabled={structureMode === 'reference'}
                                  onChange={e => updateSection(sec.id, { questionsGenerated: parseInt(e.target.value) || 1 })}
                                  style={{ width: 50, background: bgElev, border: `1px solid ${line}`, borderRadius: 4, padding: '2px 6px', color: text }}
                                />
                                <span>Attempt:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={sec.questionsGenerated}
                                  value={sec.questionsToAttempt}
                                  disabled={structureMode === 'reference'}
                                  onChange={e => updateSection(sec.id, { questionsToAttempt: parseInt(e.target.value) || 1 })}
                                  style={{ width: 50, background: bgElev, border: `1px solid ${line}`, borderRadius: 4, padding: '2px 6px', color: text }}
                                />
                                <span>Marks/Q:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={sec.marksPerQuestion}
                                  disabled={structureMode === 'reference'}
                                  onChange={e => updateSection(sec.id, { marksPerQuestion: parseInt(e.target.value) || 1 })}
                                  style={{ width: 50, background: bgElev, border: `1px solid ${line}`, borderRadius: 4, padding: '2px 6px', color: text }}
                                />
                                {structureMode === 'custom' && activeSections.length > 1 && (
                                  <button
                                    onClick={() => removeSection(sec.id)}
                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Question Types Multi-Select Checkboxes */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: `1px solid ${line}` }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: textSoft }}>Question Types:</span>
                              {QUESTION_TYPE_OPTIONS.map(opt => {
                                const isChecked = sec.questionTypes.includes(opt)
                                return (
                                  <label
                                    key={opt}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4,
                                      background: isChecked ? bgElev : 'transparent',
                                      border: `1px solid ${isChecked ? gold : line}`,
                                      fontSize: 11, cursor: 'pointer', color: isChecked ? text : textSoft
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={structureMode === 'reference'}
                                      onChange={() => toggleSectionType(sec.id, opt)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    {opt}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Source Documents Grid & Grounding Panel */}
              <div style={{ display: 'grid', gridTemplateColumns: inspectingSource ? '1fr 1fr' : '1fr', gap: 20 }}>
                {/* Left: Sources List */}
                <div style={{ background: panel, border: `1px solid ${line}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Reference Documents & Question Papers</h2>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: textSoft }}>Select documents to ground exam questions and mirror reference paper structure.</p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loadingSources}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <UploadCloud size={16} /> Upload Document
                    </button>
                  </div>

                  {loadingSources ? (
                    <div style={{ padding: 32, textAlign: 'center', color: textSoft }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      <span>Loading workspace documents...</span>
                    </div>
                  ) : sources.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', background: bgElev, borderRadius: 10, border: `1px dashed ${line}` }}>
                      <FileUp size={32} color={textSoft} style={{ margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, fontSize: 13, color: textSoft }}>No reference documents in workspace. Upload a syllabus or past question paper to ground your mock test.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sources.map(src => {
                        const isSelected = selectedSourceIds.includes(src.id)
                        return (
                          <div
                            key={src.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8,
                              background: isSelected ? bgElev : 'transparent',
                              border: `1px solid ${isSelected ? gold : line}`
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSourceSelection(src.id)}
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                              />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <FileText size={15} color={gold} /> {src.name}
                                </div>
                                <div style={{ fontSize: 11, color: textSoft, marginTop: 2 }}>
                                  {src.kind} • {src.textLength ? `${Math.round(src.textLength / 1000)}k chars` : 'Indexed'}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => handleInspectSource(src.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 12, cursor: 'pointer' }}
                              >
                                <Eye size={13} /> Inspect
                              </button>
                              <button
                                onClick={() => handleAnalyzeReferenceStructure(src.id)}
                                disabled={isAnalyzingStructure}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: bgElev, border: `1px solid ${line}`, color: gold, fontSize: 12, cursor: 'pointer' }}
                              >
                                <Target size={13} /> Extract Blueprint
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right: Inspect Panel */}
                {inspectingSource && (
                  <div style={{ background: panel, border: `1px solid ${line}`, borderRadius: 14, padding: 20, maxHeight: 600, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${line}` }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        Source: {inspectingSource.name}
                      </div>
                      <button
                        onClick={() => setInspectingSource(null)}
                        style={{ background: 'transparent', border: 'none', color: textSoft, cursor: 'pointer', fontSize: 18 }}
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: textSoft, marginBottom: 12 }}>
                      Kind: {inspectingSource.kind} • Status: {inspectingSource.status} • Total Length: {inspectingSource.textLength || 0} characters
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: bgElev, padding: 12, borderRadius: 8, border: `1px solid ${line}`, color: text, fontFamily: 'monospace', maxHeight: 450, overflowY: 'auto' }}>
                      {inspectingSource.fullText || inspectingSource.text || 'No text extracted for this source.'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FLOW: PREVIEW */}
          {flowState === 'PREVIEW' && activeTest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Test Action Bar */}
              <div style={{ background: panel, border: `1px solid ${line}`, borderRadius: 14, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <button
                    onClick={() => setFlowState('IDLE')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: textSoft, fontSize: 13, cursor: 'pointer', marginBottom: 6 }}
                  >
                    <ArrowLeft size={16} /> Back to Studio
                  </button>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                    {activeTest.scoreReport?.examTitle || activeTest.topic}
                  </h2>
                  <div style={{ display: 'flex', gap: 14, fontSize: 13, color: textSoft, marginTop: 4 }}>
                    <span>Total Questions: <strong>{activeTest.questions?.length || 0}</strong></span>
                    <span>Total Marks: <strong>{activeTest.scoreReport?.totalMarks || 100}</strong></span>
                    <span>Duration: <strong>{activeTest.scoreReport?.durationMinutes || 45} mins</strong></span>
                    <span>Difficulty: <strong>{activeTest.difficulty}</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleStartAttempt}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 8, background: '#10b981', color: '#ffffff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Play size={18} /> Start Exam Attempt
                  </button>
                  <button
                    onClick={() => handleDeleteTest(activeTest.id)}
                    style={{ padding: '10px 14px', borderRadius: 8, background: bgElev, color: '#ef4444', border: `1px solid ${line}`, cursor: 'pointer' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Instructions if any */}
              {activeTest.scoreReport?.instructions && activeTest.scoreReport.instructions.length > 0 && (
                <div style={{ background: bgElev, border: `1px solid ${line}`, borderRadius: 10, padding: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: gold, display: 'block', marginBottom: 6 }}>General Exam Instructions:</span>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: textSoft }}>
                    {activeTest.scoreReport.instructions.map((ins, i) => (
                      <li key={i}>{ins}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Question Preview Carousel */}
              {currentPreviewQ && (
                <div style={{ background: panel, border: `1px solid ${line}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: bgElev, color: gold, border: `1px solid ${line}` }}>
                        Question {previewQuestionIndex + 1} of {activeTest.questions.length}
                      </span>
                      {currentPreviewQ.sectionName && (
                        <span style={{ fontSize: 12, color: textSoft }}>• {currentPreviewQ.sectionName}</span>
                      )}
                      <span style={{ fontSize: 12, color: textSoft }}>• Type: {currentPreviewQ.type}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: gold }}>
                      +{currentPreviewQ.marks} Marks {currentPreviewQ.negativeMarks ? `(-${currentPreviewQ.negativeMarks})` : ''}
                    </span>
                  </div>

                  <p style={{ fontSize: 16, lineHeight: 1.6, fontWeight: 500, margin: '0 0 20px' }}>
                    {currentPreviewQ.question || currentPreviewQ.questionText}
                  </p>

                  {/* MCQ Options preview if applicable */}
                  {currentPreviewQ.options && currentPreviewQ.options.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      {currentPreviewQ.options.map((opt, oIdx) => (
                        <div key={oIdx} style={{ padding: '10px 14px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, fontSize: 14 }}>
                          <strong style={{ marginRight: 8 }}>{String.fromCharCode(65 + oIdx)}.</strong> {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grounding Citations */}
                  {currentPreviewQ.citations && currentPreviewQ.citations.length > 0 && (
                    <div style={{ background: bgElev, padding: 12, borderRadius: 8, border: `1px solid ${line}`, marginTop: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: gold, display: 'block', marginBottom: 4 }}>Grounded Legal Citation:</span>
                      {currentPreviewQ.citations.map((c, cIdx) => (
                        <div key={cIdx} style={{ fontSize: 12, color: textSoft }}>
                          • <strong>{c.sourceName}</strong> {c.section ? `[${c.section}]` : ''}: {c.supportingText || ''}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Navigation in Preview */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: `1px solid ${line}` }}>
                    <button
                      onClick={() => setPreviewQuestionIndex(prev => Math.max(0, prev - 1))}
                      disabled={previewQuestionIndex === 0}
                      style={{ padding: '8px 16px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, cursor: previewQuestionIndex === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      Previous
                    </button>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 400 }}>
                      {activeTest.questions.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPreviewQuestionIndex(i)}
                          style={{
                            width: 32, height: 32, borderRadius: 6, border: `1px solid ${i === previewQuestionIndex ? gold : line}`,
                            background: i === previewQuestionIndex ? gold : bgElev,
                            color: i === previewQuestionIndex ? '#000000' : text,
                            fontSize: 12, fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setPreviewQuestionIndex(prev => Math.min(activeTest.questions.length - 1, prev + 1))}
                      disabled={previewQuestionIndex === activeTest.questions.length - 1}
                      style={{ padding: '8px 16px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, cursor: previewQuestionIndex === activeTest.questions.length - 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FLOW: ATTEMPT */}
          {flowState === 'ATTEMPT' && activeTest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Sticky Exam Top Bar */}
              <div style={{ background: panelStrong, border: `1px solid ${line}`, borderRadius: 14, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 12, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {activeTest.scoreReport?.examTitle || activeTest.topic}
                  </h2>
                  <span style={{ fontSize: 12, color: textSoft }}>
                    Answered: <strong>{answeredCount}</strong> / {activeTest.questions.length} • Marked: <strong>{markedCount}</strong>
                  </span>
                </div>

                {/* Center Timer */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20,
                  background: timeRemainingSeconds < 300 ? '#ef4444' : bgElev,
                  color: timeRemainingSeconds < 300 ? '#ffffff' : text,
                  border: `1px solid ${line}`, fontWeight: 700, fontSize: 16
                }}>
                  <Clock size={18} />
                  <span>{formatTime(timeRemainingSeconds)}</span>
                </div>

                {/* Right Actions: OCR upload & Submit */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => sheetInputRef.current?.click()}
                    disabled={isUploadingSheet}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    title="Upload handwritten answer sheet for AI OCR transcription"
                  >
                    <UploadCloud size={16} color={gold} />
                    {isUploadingSheet ? 'Scanning...' : 'Upload Sheet (OCR)'}
                  </button>
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    style={{ padding: '8px 18px', borderRadius: 8, background: '#10b981', color: '#ffffff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Submit Test
                  </button>
                </div>
              </div>

              {/* Main Attempt Split View */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
                {/* Left: Active Question Card */}
                {currentAttemptQ && (
                  <div style={{ background: panel, border: `1px solid ${line}`, borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 460 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: bgElev, color: gold }}>
                            Question {attemptQuestionIndex + 1}
                          </span>
                          {currentAttemptQ.sectionName && (
                            <span style={{ fontSize: 13, color: textSoft }}>• {currentAttemptQ.sectionName}</span>
                          )}
                          <span style={{ fontSize: 12, color: textSoft }}>({currentAttemptQ.type})</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: gold }}>
                          +{currentAttemptQ.marks} Marks {currentAttemptQ.negativeMarks ? `(-${currentAttemptQ.negativeMarks})` : ''}
                        </span>
                      </div>

                      <p style={{ fontSize: 16, lineHeight: 1.6, fontWeight: 500, margin: '0 0 24px' }}>
                        {currentAttemptQ.question || currentAttemptQ.questionText}
                      </p>

                      {/* ANSWER INPUT INTERFACES */}
                      {/* 1. MCQ Radio Options */}
                      {currentAttemptQ.type === 'MCQ' && currentAttemptQ.options && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {currentAttemptQ.options.map((opt, oIdx) => {
                            const isSelected = answers[currentAttemptQ.id] === oIdx
                            return (
                              <div
                                key={oIdx}
                                onClick={() => handleSelectOption(currentAttemptQ.id, oIdx)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8,
                                  background: isSelected ? bgElev : 'transparent',
                                  border: `1px solid ${isSelected ? gold : line}`,
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{
                                  width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isSelected ? gold : line}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                                  background: isSelected ? gold : 'transparent', color: isSelected ? '#000000' : text
                                }}>
                                  {String.fromCharCode(65 + oIdx)}
                                </div>
                                <span style={{ fontSize: 14 }}>{opt}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* 2. Multiple-Select Checkbox Options */}
                      {currentAttemptQ.type === 'Multiple-Select' && currentAttemptQ.options && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {currentAttemptQ.options.map((opt, oIdx) => {
                            const currentArr = Array.isArray(answers[currentAttemptQ.id]) ? answers[currentAttemptQ.id] : []
                            const isChecked = currentArr.includes(opt)
                            return (
                              <div
                                key={oIdx}
                                onClick={() => handleMultipleSelectOption(currentAttemptQ.id, opt)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8,
                                  background: isChecked ? bgElev : 'transparent',
                                  border: `1px solid ${isChecked ? gold : line}`,
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isChecked ? gold : line}`, background: isChecked ? gold : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {isChecked && <CheckCircle2 size={14} color="#000000" />}
                                </div>
                                <span style={{ fontSize: 14 }}>{opt}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* 3. True / False */}
                      {currentAttemptQ.type === 'True/False' && (
                        <div style={{ display: 'flex', gap: 16 }}>
                          {['True', 'False'].map(val => {
                            const isSelected = answers[currentAttemptQ.id] === val
                            return (
                              <button
                                key={val}
                                onClick={() => setAnswers(prev => ({ ...prev, [currentAttemptQ.id]: val }))}
                                style={{
                                  flex: 1, padding: '14px', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer',
                                  background: isSelected ? bgElev : 'transparent',
                                  border: `2px solid ${isSelected ? gold : line}`,
                                  color: isSelected ? gold : text
                                }}
                              >
                                {val}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* 4. Descriptive / Long Answer / Case Based */}
                      {currentAttemptQ.type !== 'MCQ' && currentAttemptQ.type !== 'Multiple-Select' && currentAttemptQ.type !== 'True/False' && (
                        <div>
                          <textarea
                            value={answers[currentAttemptQ.id] || ''}
                            onChange={e => handleTextAnswer(currentAttemptQ.id, e.target.value)}
                            placeholder="Draft your structured legal answer here (Issue, Rule/Statutory Provision, Legal Analysis, and Conclusion)..."
                            rows={10}
                            style={{ width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 10, padding: 14, color: text, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: textSoft, marginTop: 6 }}>
                            <span>Words: {(answers[currentAttemptQ.id] || '').trim().split(/\s+/).filter(Boolean).length}</span>
                            <span>Chars: {(answers[currentAttemptQ.id] || '').length}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Question Bottom Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: `1px solid ${line}` }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => setMarkedForReview(prev => ({ ...prev, [currentAttemptQ.id]: !prev[currentAttemptQ.id] }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                            background: markedForReview[currentAttemptQ.id] ? '#8b5cf6' : bgElev,
                            color: markedForReview[currentAttemptQ.id] ? '#ffffff' : text,
                            border: `1px solid ${line}`, fontSize: 13, fontWeight: 600
                          }}
                        >
                          <BookmarkCheck size={16} />
                          {markedForReview[currentAttemptQ.id] ? 'Marked for Review' : 'Mark for Review'}
                        </button>
                        <button
                          onClick={() => setAnswers(prev => { const n = { ...prev }; delete n[currentAttemptQ.id]; return n })}
                          style={{ padding: '8px 12px', borderRadius: 8, background: bgElev, color: textSoft, border: `1px solid ${line}`, fontSize: 13, cursor: 'pointer' }}
                        >
                          Clear Response
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => setAttemptQuestionIndex(prev => Math.max(0, prev - 1))}
                          disabled={attemptQuestionIndex === 0}
                          style={{ padding: '8px 16px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, cursor: attemptQuestionIndex === 0 ? 'not-allowed' : 'pointer' }}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setAttemptQuestionIndex(prev => Math.min(activeTest.questions.length - 1, prev + 1))}
                          disabled={attemptQuestionIndex === activeTest.questions.length - 1}
                          style={{ padding: '8px 16px', borderRadius: 8, background: gold, color: '#000000', border: 'none', fontWeight: 600, cursor: attemptQuestionIndex === activeTest.questions.length - 1 ? 'not-allowed' : 'pointer' }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Right: Question Palette & Navigation */}
                <div style={{ background: panel, border: `1px solid ${line}`, borderRadius: 14, padding: 18, height: 'fit-content' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Question Palette</h3>

                  {/* Legend */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: textSoft, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981' }} /> Answered
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: '#8b5cf6' }} /> Marked
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: bgElev, border: `1px solid ${line}` }} /> Unanswered
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${gold}` }} /> Current
                    </div>
                  </div>

                  {/* Palette Numbers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {activeTest.questions.map((q, idx) => {
                      const isAnswered = answers[q.id] !== undefined && answers[q.id] !== ''
                      const isMarked = markedForReview[q.id]
                      const isCurrent = idx === attemptQuestionIndex

                      let bgCol = bgElev
                      let textCol = text
                      if (isMarked) { bgCol = '#8b5cf6'; textCol = '#ffffff' }
                      else if (isAnswered) { bgCol = '#10b981'; textCol = '#ffffff' }

                      return (
                        <button
                          key={q.id}
                          onClick={() => setAttemptQuestionIndex(idx)}
                          style={{
                            height: 38, borderRadius: 6, cursor: 'pointer',
                            background: bgCol, color: textCol,
                            border: isCurrent ? `2px solid ${gold}` : `1px solid ${line}`,
                            fontWeight: 700, fontSize: 12
                          }}
                        >
                          {idx + 1}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FLOW: EVALUATING */}
          {flowState === 'EVALUATING' && (
            <div style={{ padding: 64, textAlign: 'center', background: panel, borderRadius: 14, border: `1px solid ${line}` }}>
              <RefreshCw size={48} className="animate-spin" color={gold} style={{ margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Evaluating Exam Submission...</h2>
              <p style={{ margin: 0, fontSize: 14, color: textSoft }}>
                Applying legal grading rubrics, computing negative marks, and transcribing AI analytical feedback.
              </p>
            </div>
          )}

          {/* FLOW: RESULT */}
          {flowState === 'RESULT' && activeAttempt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Score Overview Card */}
              <div style={{ background: panel, border: `1px solid ${line}`, borderRadius: 14, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Examination Scorecard & Rubric Analysis</h2>
                    <span style={{ fontSize: 13, color: textSoft }}>
                      Completed on {new Date(activeAttempt.createdAt || Date.now()).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={handleRetakeTest}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <RotateCcw size={15} /> Retake Test
                    </button>
                    <button
                      onClick={() => setFlowState('IDLE')}
                      style={{ padding: '8px 16px', borderRadius: 8, background: gold, color: '#000000', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Return to Studio
                    </button>
                  </div>
                </div>

                {/* Score Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                  <div style={{ background: bgElev, padding: 16, borderRadius: 10, border: `1px solid ${line}`, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: textSoft, display: 'block', marginBottom: 4 }}>Score</span>
                    <strong style={{ fontSize: 24, color: gold }}>{activeAttempt.score} / {activeAttempt.total}</strong>
                  </div>
                  <div style={{ background: bgElev, padding: 16, borderRadius: 10, border: `1px solid ${line}`, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: textSoft, display: 'block', marginBottom: 4 }}>Percentage</span>
                    <strong style={{ fontSize: 24, color: activeAttempt.percentage >= 50 ? '#10b981' : '#ef4444' }}>{activeAttempt.percentage}%</strong>
                  </div>
                  <div style={{ background: bgElev, padding: 16, borderRadius: 10, border: `1px solid ${line}`, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: textSoft, display: 'block', marginBottom: 4 }}>Accuracy</span>
                    <strong style={{ fontSize: 24, color: text }}>{activeAttempt.accuracy}%</strong>
                  </div>
                  <div style={{ background: bgElev, padding: 16, borderRadius: 10, border: `1px solid ${line}`, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: textSoft, display: 'block', marginBottom: 4 }}>Time Taken</span>
                    <strong style={{ fontSize: 24, color: text }}>{Math.round((activeAttempt.timeTaken || 0) / 60)}m</strong>
                  </div>
                </div>

                {/* Strong & Weak Areas */}
                {(activeAttempt.answers?.strongAreas?.length || activeAttempt.answers?.weakAreas?.length) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
                    {activeAttempt.answers?.strongAreas && (
                      <div style={{ background: bgElev, padding: 14, borderRadius: 8, border: `1px solid ${line}` }}>
                        <strong style={{ fontSize: 13, color: '#10b981', display: 'block', marginBottom: 6 }}>Key Strengths:</strong>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: textSoft }}>
                          {activeAttempt.answers.strongAreas.map((s, idx) => <li key={idx}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {activeAttempt.answers?.weakAreas && (
                      <div style={{ background: bgElev, padding: 14, borderRadius: 8, border: `1px solid ${line}` }}>
                        <strong style={{ fontSize: 13, color: '#ef4444', display: 'block', marginBottom: 6 }}>Areas for Improvement:</strong>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: textSoft }}>
                          {activeAttempt.answers.weakAreas.map((w, idx) => <li key={idx}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Question Level Evaluation Filters */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'all', label: 'All Questions' },
                  { id: 'correct', label: 'Correct' },
                  { id: 'incorrect', label: 'Incorrect' },
                  { id: 'unanswered', label: 'Unanswered' },
                  { id: 'subjective', label: 'Subjective / Graded' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setEvalFilter(f.id as any)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: `1px solid ${evalFilter === f.id ? gold : line}`,
                      background: evalFilter === f.id ? bgElev : 'transparent',
                      color: evalFilter === f.id ? text : textSoft,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Question Evaluations List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredEvaluations.map((ev, idx) => (
                  <div key={idx} style={{ background: panel, border: `1px solid ${line}`, borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: bgElev, color: text }}>
                          Q{ev.questionNumber}
                        </span>
                        <span style={{ fontSize: 12, color: textSoft }}>({ev.type})</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                          background: ev.isCorrect === true ? 'rgba(16, 185, 129, 0.2)' : ev.isCorrect === false ? 'rgba(239, 68, 68, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                          color: ev.isCorrect === true ? '#10b981' : ev.isCorrect === false ? '#ef4444' : '#8b5cf6'
                        }}>
                          {ev.result || (ev.isCorrect ? 'Correct' : 'Incorrect')}
                        </span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: gold }}>
                        {ev.awardedMarks} / {ev.marks} Marks
                      </span>
                    </div>

                    <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 14px' }}>
                      {ev.questionText}
                    </p>

                    <div style={{ background: bgElev, padding: 12, borderRadius: 8, border: `1px solid ${line}`, fontSize: 13, marginBottom: 10 }}>
                      <strong style={{ color: textSoft, display: 'block', marginBottom: 4 }}>Your Answer:</strong>
                      <span>{ev.userAnswer || 'No response provided.'}</span>
                    </div>

                    {ev.correctAnswer && (
                      <div style={{ background: bgElev, padding: 12, borderRadius: 8, border: `1px solid ${line}`, fontSize: 13, marginBottom: 10 }}>
                        <strong style={{ color: gold, display: 'block', marginBottom: 4 }}>Model / Correct Answer:</strong>
                        <span>{ev.correctAnswer}</span>
                      </div>
                    )}

                    {ev.explanation && (
                      <div style={{ fontSize: 12, color: textSoft, lineHeight: 1.5, marginTop: 10 }}>
                        <strong>Explanation:</strong> {ev.explanation}
                      </div>
                    )}

                    {/* Rubric Breakdown for descriptive questions */}
                    {ev.rubricBreakdown && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${line}` }}>
                        <div style={{ fontSize: 11, color: textSoft }}>Legal Accuracy: <strong>{ev.rubricBreakdown.legalAccuracy}%</strong></div>
                        <div style={{ fontSize: 11, color: textSoft }}>Issue Identification: <strong>{ev.rubricBreakdown.issueIdentification}%</strong></div>
                        <div style={{ fontSize: 11, color: textSoft }}>Reasoning & Analysis: <strong>{ev.rubricBreakdown.reasoningAnalysis}%</strong></div>
                        <div style={{ fontSize: 11, color: textSoft }}>Use of Authorities: <strong>{ev.rubricBreakdown.useOfAuthorities}%</strong></div>
                        <div style={{ fontSize: 11, color: textSoft }}>Structure & Clarity: <strong>{ev.rubricBreakdown.structureClarity}%</strong></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: SUBMIT CONFIRMATION */}
      {showSubmitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: panelStrong, border: `1px solid ${line}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Confirm Test Submission</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: textSoft }}>
              Are you sure you want to end and submit your examination? Once submitted, your answers will be finalized and evaluated by AI.
            </p>
            <div style={{ background: bgElev, padding: 14, borderRadius: 8, border: `1px solid ${line}`, marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Answered:</span> <strong>{answeredCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Marked for Review:</span> <strong>{markedCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Unanswered:</span> <strong>{(activeTest?.questions?.length || 0) - answeredCount}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                style={{ padding: '8px 16px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 13, cursor: 'pointer' }}
              >
                Continue Exam
              </button>
              <button
                onClick={handleSubmitAttempt}
                style={{ padding: '8px 18px', borderRadius: 8, background: '#10b981', color: '#ffffff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HANDWRITTEN OCR REVIEW */}
      {ocrModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: panelStrong, border: `1px solid ${line}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>Review OCR Detected Answers</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: textSoft }}>
              AI transcribed responses from "{ocrFileName}". Verify and edit before applying them to your exam.
            </p>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {detectedAnswers.map(ans => (
                <div key={ans.questionId} style={{ background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Q{ans.questionNumber}: {ans.questionText?.slice(0, 60)}...</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: ans.confidenceLevel === 'High' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: ans.confidenceLevel === 'High' ? '#10b981' : '#f59e0b'
                    }}>
                      {ans.confidenceLevel} Confidence ({ans.confidence}%)
                    </span>
                  </div>

                  {editingOcrQId === ans.questionId ? (
                    <div>
                      <textarea
                        value={editOcrText}
                        onChange={e => setEditOcrText(e.target.value)}
                        rows={3}
                        style={{ width: '100%', background: panel, border: `1px solid ${line}`, borderRadius: 6, padding: 8, color: text, fontSize: 13, boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                        <button
                          onClick={() => setEditingOcrQId(null)}
                          style={{ padding: '4px 10px', borderRadius: 4, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 12, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveOcrCorrection(ans.questionId, editOcrText)}
                          style={{ padding: '4px 10px', borderRadius: 4, background: gold, color: '#000000', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: text }}>"{ans.detectedAnswer}"</p>
                      <button
                        onClick={() => { setEditingOcrQId(ans.questionId); setEditOcrText(ans.detectedAnswer) }}
                        style={{ padding: '2px 8px', borderRadius: 4, background: panel, border: `1px solid ${line}`, color: textSoft, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setOcrModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 13, cursor: 'pointer' }}
              >
                Discard
              </button>
              <button
                onClick={handleConfirmOcrAnswers}
                style={{ padding: '8px 18px', borderRadius: 8, background: '#10b981', color: '#ffffff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Apply Answers to Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'''

with open(r'src\modules\MockTestPlatform.tsx', 'a', encoding='utf-8') as f:
    f.write(jsx_code)

print("Successfully appended JSX to src/modules/MockTestPlatform.tsx")
