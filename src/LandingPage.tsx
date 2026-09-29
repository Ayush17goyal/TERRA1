import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Gavel,
  GraduationCap,
  Landmark,
  Minus,
  Plus,
  Scale,
  Search,
  Sparkles,
  Trophy,
  Workflow,
} from 'lucide-react'
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion'
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
  FloatingElement,
  LineReveal,
  useMousePosition,
  useIsMobile,
} from './components/animations'

const trademark = '\u2122'

const suites = [
  {
    label: 'Student Learning Suite',
    icon: GraduationCap,
    description: 'Master legal concepts faster with an intelligent study system built around your academic goals.',
    features: [
      `LexMentor AI${trademark}`,
      `Smart Study Forge${trademark}`,
      `Academic Navigator${trademark}`,
      `Exam Command Center${trademark}`,
      `Judgment Mastery Engine${trademark}`,
    ],
    benefits: ['Better understanding', 'Faster revision', 'Personalized learning', 'Improved exam performance'],
    accent: 'blue',
  },
  {
    label: 'Moot Court Suite',
    icon: Gavel,
    description: 'Prepare like a professional advocate, from first research note to the final rebuttal.',
    features: [
      `Memorial Architect AI${trademark}`,
      `AI Bench Simulator${trademark}`,
      'Oral Argument Generator',
      'Rebuttal Preparation Engine',
      'Moot Research Assistant',
    ],
    benefits: ['Stronger memorials', 'Better advocacy', 'Competition readiness', 'Professional drafting support'],
    accent: 'amber',
  },
  {
    label: 'Legal Research Suite',
    icon: Search,
    description: 'Move from a legal question to reliable authorities and persuasive reasoning in less time.',
    features: [
      `Legal Research Command Center${trademark}`,
      `Citation Navigator${trademark}`,
      `Case Impact Visualizer${trademark}`,
      `Precedent Intelligence Engine${trademark}`,
    ],
    benefits: ['Faster research', 'Better authorities', 'Stronger arguments', 'Reduced research time'],
    accent: 'violet',
  },
  {
    label: 'Professional & Corporate Suite',
    icon: Briefcase,
    description: 'A focused workspace for contract, compliance, policy, and legal-risk workflows.',
    features: [
      `Contract Intelligence AI${trademark}`,
      `NDA Guardian${trademark}`,
      `Compliance Copilot${trademark}`,
      `Policy Builder AI${trademark}`,
      `Legal Risk Analyzer${trademark}`,
    ],
    benefits: ['Increased efficiency', 'Reduced compliance risks', 'Better document management', 'Faster legal workflows'],
    accent: 'emerald',
  },
]

const highlights = [
  { icon: BrainCircuit, title: 'AI-Powered Learning', text: 'Learn smarter with adaptive legal guidance.' },
  { icon: FileSearch, title: 'Research Intelligence', text: 'Find and organize persuasive authorities faster.' },
  { icon: Trophy, title: 'Moot Court Excellence', text: 'Build arguments and compete with confidence.' },
  { icon: Briefcase, title: 'Professional Legal Tools', text: 'Move complex legal work forward efficiently.' },
  { icon: BarChart3, title: 'Progress Analytics', text: 'Measure mastery, momentum, and improvement.' },
  { icon: Workflow, title: 'Cloud Workspace', text: 'Access your legal knowledge wherever you work.' },
]

const audiences = [
  { icon: GraduationCap, label: 'Law Students' },
  { icon: Scale, label: 'Advocates' },
  { icon: FileSearch, label: 'Legal Researchers' },
  { icon: BookOpen, label: 'Academicians' },
  { icon: Building2, label: 'Law Firms' },
  { icon: Landmark, label: 'Universities' },
  { icon: Gavel, label: 'Judicial Aspirants' },
  { icon: Briefcase, label: 'Corporate Legal Teams' },
]

const faqs = [
  {
    question: 'Is LEGATRIXON only for law students?',
    answer: 'No. LEGATRIXON is designed for students, advocates, researchers, legal educators, law firms, universities, and legal teams.',
  },
  {
    question: 'Does LEGATRIXON use AI?',
    answer: 'Yes. Multiple AI systems support learning, research, drafting assistance, analytics, and professional legal-intelligence workflows.',
  },
  {
    question: 'Can I use LEGATRIXON for moot court preparation?',
    answer: 'Absolutely. The Moot Court Suite supports memorial development, oral arguments, bench simulations, rebuttals, and focused legal research.',
  },
  {
    question: 'Can legal professionals use LEGATRIXON?',
    answer: 'Yes. Professional tools cover legal research, contracts, compliance, policy building, document intelligence, and risk analysis.',
  },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(0)
  const isMobile = useIsMobile()
  const shouldReduceMotion = useReducedMotion()

  // Track mouse coordinates for Hero section parallax
  const mouse = useMousePosition(!isMobile && !shouldReduceMotion)

  // Track page scroll progress
  const { scrollYProgress: pageScrollY } = useScroll()

  // Track LexMentor section scroll progress for depth parallax
  const lexmentorRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: lexmentorScrollY } = useScroll({
    target: lexmentorRef,
    offset: ['start end', 'end start'],
  })

  // Smooth scroll transformations for LexMentor elements
  const lexmentorRawY = useTransform(lexmentorScrollY, [0, 1], [-20, 20])
  const lexmentorParallaxY = useSpring(lexmentorRawY, { stiffness: 100, damping: 25 })

  const orbitalRawY1 = useTransform(lexmentorScrollY, [0, 1], [-12, 12])
  const orbitalRawY2 = useTransform(lexmentorScrollY, [0, 1], [10, -10])
  const orbitalRawY3 = useTransform(lexmentorScrollY, [0, 1], [-16, 16])

  const orbitalSpringY1 = useSpring(orbitalRawY1, { stiffness: 100, damping: 25 })
  const orbitalSpringY2 = useSpring(orbitalRawY2, { stiffness: 100, damping: 25 })
  const orbitalSpringY3 = useSpring(orbitalRawY3, { stiffness: 100, damping: 25 })

  return (
    <>
      {/* Scroll Progress Bar */}
      {!shouldReduceMotion && (
        <motion.div
          className="scroll-progress-bar"
          style={{ scaleX: pageScrollY }}
        />
      )}

      <motion.main
        className="landing-page"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <section className="landing-hero">
          <div className="landing-hero-glow landing-hero-glow-left" />
          <div className="landing-hero-glow landing-hero-glow-right" />
          <div className="landing-hero-copy">
            <motion.div
              className="landing-kicker"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.0, ease: 'easeOut' }}
            >
              <Sparkles size={15} /> India's AI-powered legal ecosystem
            </motion.div>
            
            <h1 style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ display: 'block', overflow: 'hidden' }}>
                <motion.span
                  style={{ display: 'block' }}
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  Learn law.
                </motion.span>
              </span>
              <span style={{ display: 'block', overflow: 'hidden' }}>
                <motion.span
                  style={{ display: 'block' }}
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  Build arguments.
                </motion.span>
              </span>
              <span style={{ display: 'block', overflow: 'hidden' }}>
                <motion.span
                  style={{ display: 'block' }}
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span>Lead with intelligence.</span>
                </motion.span>
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
            >
              LEGATRIXON is the next-generation workspace for law students, advocates, researchers,
              mooters, educators, and institutions.
            </motion.p>
            
            <motion.div
              className="landing-hero-actions"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65, ease: 'easeOut' }}
            >
              <Link to="/signup" className="btn btn-primary landing-primary-cta">
                Start Learning <ChevronRight size={18} />
              </Link>
              <a href="#ecosystem" className="btn btn-ghost landing-secondary-cta">Explore Features</a>
            </motion.div>

            <motion.div
              className="landing-trust-line"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8, ease: 'easeOut' }}
            >
              <span className="landing-avatar-stack"><i>LS</i><i>AD</i><i>LR</i><i>+1k</i></span>
              <span>Trusted by future lawyers, researchers, and legal innovators.</span>
            </motion.div>
          </div>

          <motion.div
            className="landing-hero-visual"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            aria-label="LEGATRIXON platform preview"
          >
            <motion.div style={{ x: mouse.x * 3, y: mouse.y * 3 }} className="landing-orbit landing-orbit-one" />
            <motion.div style={{ x: mouse.x * -3, y: mouse.y * -3 }} className="landing-orbit landing-orbit-two" />

            <motion.div
              style={{ x: mouse.x * 8, y: mouse.y * 8 }}
              className="landing-command-card-wrapper"
            >
              <FloatingElement yRange={[-5, 5]} rotateRange={[-0.8, 0.8]} duration={6.5}>
                <div className="landing-command-card" style={{ animation: 'none' }}>
                  <div className="landing-command-top">
                    <span className="legatrixon-logo-circle" />
                    <div><strong>LEGAL INTELLIGENCE</strong><small>Unified command center</small></div>
                    <span className="landing-live-dot">LIVE</span>
                  </div>
                  <div className="landing-command-score">
                    <div className="landing-score-ring"><span>87</span><small>Mastery</small></div>
                    <div>
                      <span className="landing-mini-label">Current focus</span>
                      <strong>Constitutional Law</strong>
                      <p>Strong momentum across research, revision, and case analysis.</p>
                    </div>
                  </div>
                  <div className="landing-command-grid">
                    <div><BrainCircuit size={18} /><span>LexMentor</span><strong>Ready</strong></div>
                    <div><FileSearch size={18} /><span>Research</span><strong>12 sources</strong></div>
                    <div><Gavel size={18} /><span>Moot Prep</span><strong>84%</strong></div>
                    <div><BarChart3 size={18} /><span>Progress</span><strong>+18%</strong></div>
                  </div>
                </div>
              </FloatingElement>
            </motion.div>

            <motion.div
              style={{ x: mouse.x * 6, y: mouse.y * 6, position: 'absolute', left: '-5%', bottom: '13%', zIndex: 10 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.8, ease: 'easeOut' }}
            >
              <FloatingElement yRange={[-6, 6]} rotateRange={[0, 0]} duration={5.2} delay={0.5} style={{ display: 'block' }}>
                <div className="landing-float-card" style={{ position: 'static', animation: 'none' }}>
                  <CheckCircle2 size={16} /> Citation verified
                </div>
              </FloatingElement>
            </motion.div>

            <motion.div
              style={{ x: mouse.x * -6, y: mouse.y * -6, position: 'absolute', top: '5%', right: '-4%', zIndex: 10 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.8, ease: 'easeOut' }}
            >
              <FloatingElement xRange={[-5, 5]} yRange={[0, 0]} rotateRange={[0, 0]} duration={5.8} delay={1.2} style={{ display: 'block' }}>
                <div className="landing-float-card" style={{ position: 'static', animation: 'none' }}>
                  <Sparkles size={16} /> Study kit generated
                </div>
              </FloatingElement>
            </motion.div>
          </motion.div>
        </section>

        <section className="landing-why landing-section">
          <div className="landing-section-copy">
            <ScrollReveal delay={0.0} y={15}>
              <p className="landing-overline">Why LEGATRIXON?</p>
            </ScrollReveal>
            <h2>
              <LineReveal delay={0.15}>Legal education is evolving.</LineReveal>
              <LineReveal delay={0.3}>Your tools should too.</LineReveal>
            </h2>
          </div>
          <div className="landing-why-content">
            <ScrollReveal delay={0.2} y={20}>
              <p>
                Traditional legal learning is slow, fragmented, and difficult to scale. LEGATRIXON combines
                artificial intelligence, research, academic planning, moot preparation, and professional tools
                inside one connected platform.
              </p>
            </ScrollReveal>
            
            <StaggerContainer staggerChildren={0.1} delayChildren={0.35} className="landing-why-points">
              <StaggerItem y={12}>
                <span><CheckCircle2 size={17} /> One intelligent legal workspace</span>
              </StaggerItem>
              <StaggerItem y={12}>
                <span><CheckCircle2 size={17} /> Built for Indian legal education</span>
              </StaggerItem>
              <StaggerItem y={12}>
                <span><CheckCircle2 size={17} /> From classroom to courtroom</span>
              </StaggerItem>
            </StaggerContainer>
          </div>
        </section>

        <section className="landing-section" id="ecosystem">
          <div className="landing-section-heading">
            <ScrollReveal delay={0.0} y={20}>
              <p className="landing-overline">One Legal Ecosystem</p>
            </ScrollReveal>
            <ScrollReveal delay={0.15} y={25}>
              <h2>Everything you need to move from learning to leading.</h2>
            </ScrollReveal>
            <ScrollReveal delay={0.3} y={20}>
              <p>Specialized intelligence suites, connected through one secure legal workspace.</p>
            </ScrollReveal>
          </div>

          <StaggerContainer staggerChildren={0.12} className="landing-suite-grid">
            {suites.map((suite, index) => {
              const Icon = suite.icon
              return (
                <StaggerItem key={suite.label} y={25} style={{ height: '100%' }}>
                  <article className={`landing-suite-card landing-accent-${suite.accent}`} style={{ height: '100%' }}>
                    <div className="landing-suite-icon"><Icon size={24} /></div>
                    <p className="landing-suite-number">0{index + 1}</p>
                    <h3>{suite.label}</h3>
                    <p className="landing-suite-description">{suite.description}</p>
                    <div className="landing-suite-columns">
                      <div>
                        <span className="landing-mini-label">Core tools</span>
                        <ul>{suite.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                      </div>
                      <div>
                        <span className="landing-mini-label">Outcomes</span>
                        <ul className="landing-benefit-list">
                          {suite.benefits.map((benefit) => <li key={benefit}><CheckCircle2 size={13} />{benefit}</li>)}
                        </ul>
                      </div>
                    </div>
                  </article>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        </section>

        <section className="landing-lexmentor landing-section" id="lexmentor" ref={lexmentorRef}>
          <div className="landing-lexmentor-visual">
            <motion.div
              className="landing-ai-core"
              style={{ y: lexmentorParallaxY, animation: 'none' }}
            >
              <FloatingElement
                yRange={[-6, 6]}
                rotateRange={[-1, 1]}
                duration={7}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
              >
                <BrainCircuit size={42} />
              </FloatingElement>
            </motion.div>

            <motion.div
              className="landing-ai-ring landing-ai-ring-one"
              style={{ y: orbitalSpringY1 }}
            />
            <motion.div
              className="landing-ai-ring landing-ai-ring-two"
              style={{ y: orbitalSpringY2 }}
            />

            <motion.div
              className="landing-prompt-card landing-prompt-one"
              style={{ y: orbitalSpringY3, animation: 'none' }}
            >
              <FloatingElement yRange={[-4, 4]} rotateRange={[-0.5, 0.5]} duration={5.2} delay={0.2}>
                Explain Article 21 like a professor.
              </FloatingElement>
            </motion.div>

            <motion.div
              className="landing-prompt-card landing-prompt-two"
              style={{ y: orbitalSpringY2, animation: 'none' }}
            >
              <FloatingElement xRange={[-5, 5]} yRange={[-2, 2]} rotateRange={[0, 0]} duration={5.8} delay={0.8}>
                Build a revision kit from this judgment.
              </FloatingElement>
            </motion.div>

            <motion.div
              className="landing-prompt-card landing-prompt-three"
              style={{ y: orbitalSpringY1, animation: 'none' }}
            >
              <FloatingElement yRange={[-5, 5]} rotateRange={[0.5, -0.5]} duration={6.4} delay={1.4}>
                Test my legal reasoning.
              </FloatingElement>
            </motion.div>
          </div>

          <div className="landing-lexmentor-copy">
            <ScrollReveal delay={0.0} y={20}>
              <p className="landing-overline">Meet LexMentor AI{trademark}</p>
            </ScrollReveal>
            <ScrollReveal delay={0.15} y={25}>
              <h2>Your personal legal intelligence partner.</h2>
            </ScrollReveal>
            <ScrollReveal delay={0.3} y={20}>
              <p>
                Ask questions, analyze judgments, create study material, prepare for exams, and develop
                sharper legal reasoning with an AI system designed specifically for legal work.
              </p>
            </ScrollReveal>

            <StaggerContainer staggerChildren={0.08} delayChildren={0.45} className="landing-capability-list">
              {['Analyze judgments', 'Generate study material', 'Create research summaries', 'Prepare for exams', 'Develop legal reasoning'].map((item) => (
                <StaggerItem key={item} y={10}>
                  <span><Sparkles size={15} />{item}</span>
                </StaggerItem>
              ))}
            </StaggerContainer>

            <ScrollReveal delay={0.6} y={10}>
              <Link to="/signup" className="landing-text-link">Start with LexMentor <ChevronRight size={17} /></Link>
            </ScrollReveal>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-heading">
            <ScrollReveal delay={0.0} y={20}>
              <p className="landing-overline">Platform Highlights</p>
            </ScrollReveal>
            <ScrollReveal delay={0.15} y={25}>
              <h2>Legal intelligence that compounds with every session.</h2>
            </ScrollReveal>
          </div>

          <StaggerContainer staggerChildren={0.08} className="landing-highlight-grid">
            {highlights.map((highlight) => {
              const Icon = highlight.icon
              return (
                <StaggerItem key={highlight.title} y={20}>
                  <article>
                    <span><Icon size={22} /></span>
                    <h3>{highlight.title}</h3>
                    <p>{highlight.text}</p>
                  </article>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        </section>

        <section className="landing-audiences landing-section" id="audiences">
          <div className="landing-section-heading">
            <ScrollReveal delay={0.0} y={20}>
              <p className="landing-overline">Built For</p>
            </ScrollReveal>
            <ScrollReveal delay={0.15} y={25}>
              <h2>One platform. Every legal ambition.</h2>
            </ScrollReveal>
          </div>

          <StaggerContainer staggerChildren={0.05} className="landing-audience-grid">
            {audiences.map((audience) => {
              const Icon = audience.icon
              return (
                <StaggerItem key={audience.label} y={15}>
                  <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center' }}>
                    <Icon size={20} />
                    <span>{audience.label}</span>
                  </div>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        </section>

        <motion.section
          className="landing-metrics"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.15 },
            },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <motion.strong
              initial={{ scale: 0.8 }}
              whileInView={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.1 }}
            >
              01
            </motion.strong>
            <span>Unified legal<br />knowledge workspace</span>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <motion.strong
              initial={{ scale: 0.8 }}
              whileInView={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.2 }}
            >
              20+
            </motion.strong>
            <span>Legal intelligence<br />modules</span>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <motion.strong
              initial={{ scale: 0.8 }}
              whileInView={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.3 }}
            >
              AI
            </motion.strong>
            <span>Powered learning<br />ecosystem</span>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <motion.strong
              initial={{ scale: 0.8 }}
              whileInView={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.4 }}
            >
              24/7
            </motion.strong>
            <span>Cloud-based<br />access</span>
          </motion.div>
        </motion.section>

        <section className="landing-faq landing-section" id="faq">
          <div className="landing-section-copy">
            <ScrollReveal delay={0.0} y={20}>
              <p className="landing-overline">Frequently Asked Questions</p>
            </ScrollReveal>
            <ScrollReveal delay={0.15} y={25}>
              <h2>What legal minds ask before they begin.</h2>
            </ScrollReveal>
            <ScrollReveal delay={0.3} y={20}>
              <p>Everything you need to know about the LEGATRIXON ecosystem.</p>
            </ScrollReveal>
          </div>
          
          <div className="landing-faq-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <article className={isOpen ? 'open' : ''} key={faq.question}>
                  <button type="button" onClick={() => setOpenFaq(isOpen ? -1 : index)} aria-expanded={isOpen}>
                    <span>{faq.question}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      style={{ display: 'inline-flex' }}
                    >
                      {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <p>{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </article>
              )
            })}
          </div>
        </section>

        <section className="landing-final-cta">
          <div>
            <ScrollReveal delay={0.0} duration={0.8} y={15}>
              <p className="landing-overline">The Future Is Already In Session</p>
            </ScrollReveal>
            <ScrollReveal delay={0.15} duration={0.8} y={20}>
              <h2>Build the legal mind your ambition demands.</h2>
            </ScrollReveal>
            <ScrollReveal delay={0.3} duration={0.8} y={15}>
              <p>Prepare for your next exam, moot, research paper, or professional challenge with LEGATRIXON.</p>
            </ScrollReveal>
          </div>
          
          <motion.div
            className="landing-final-actions"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.12, delayChildren: 0.45 },
              },
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              <Link to="/signup" className="btn btn-primary" style={{ width: '100%' }}>
                Get Started Today <ChevronRight size={18} />
              </Link>
            </motion.div>
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              <Link to="/product" className="btn btn-ghost" style={{ width: '100%' }}>
                Explore LEGATRIXON
              </Link>
            </motion.div>
          </motion.div>
        </section>

        <motion.footer
          className="landing-footer"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.08 },
            },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          <motion.div
            className="landing-footer-brand"
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <Link to="/" className="brand landing-footer-logo">
              <span className="landing-footer-emblem">
                <img src="/Legatrixon logo.jpg" alt="LEGATRIXON logo" />
              </span>
              <span>LEGATRIXON</span>
            </Link>
            <p>The future of legal learning, research, and professional excellence.</p>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <strong>Products</strong>
            <a href="#lexmentor">LexMentor AI{trademark}</a>
            <a href="#ecosystem">Academic Navigator{trademark}</a>
            <a href="#ecosystem">Moot Court Suite{trademark}</a>
            <a href="#ecosystem">Legal Research Suite{trademark}</a>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <strong>Company</strong>
            <a href="#audiences">About Us</a>
            <a href="mailto:legatrixon2026@gmail.com">Contact Us</a>
            <Link to="/product">Platform</Link>
            <Link to="/pricing">Pricing</Link>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <strong>Support</strong>
            <a href="#faq">Help Center</a>
            <a href="#faq">Documentation</a>
            <a href="mailto:legatrixon2026@gmail.com">Feedback</a>
            <a href="mailto:legatrixon2026@gmail.com">legatrixon2026@gmail.com</a>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <strong>Legal</strong>
            <a href="/terms-of-service.pdf" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            <a href="/refund-policy">Refund Policy</a>
            <a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </motion.div>

          <motion.div
            className="landing-footer-bottom"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { duration: 0.6 } },
            }}
          >
            <span>{'\u00A9'} 2026 LEGATRIXON. All rights reserved.</span>
            <span>Designed, developed & powered by <strong>N-CYPHER Pvt. Ltd.</strong></span>
          </motion.div>
        </motion.footer>
      </motion.main>
    </>
  )
}
