import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MemorialArchitect from '../../modules/moot-court/MemorialArchitect'

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue(null), isSignedIn: false }),
}))

vi.mock('../../modules/moot-court/MootSuiteContext', () => ({
  useMootSuite: () => ({ setActiveSubTab: vi.fn(), setSelectedSimilarityQuery: vi.fn() }),
}))

describe('MemorialArchitect layout safety', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline test')))
  })

  it('contains an extremely long filename without expanding the Memorial tab', async () => {
    const { container } = render(<MemorialArchitect />)
    const fileName = 'Moot_Court_Memorial_Competition_2026_Final_Petitioner_Reference_Document_Version_03_Approved_With_An_Extremely_Long_Unbroken_Suffix.pdf'
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['proposal'], fileName, { type: 'application/pdf' })] } })

    const badge = await waitFor(() => container.querySelector(`[title="${fileName}"]`) as HTMLElement)
    expect(badge).toBeTruthy()
    expect(badge.style.overflow).toBe('hidden')
    expect(badge.style.textOverflow).toBe('ellipsis')
    expect(badge.style.whiteSpace).toBe('nowrap')
    expect(container.firstElementChild).toHaveStyle({ overflowX: 'hidden', minWidth: '0' })
  })

  it('keeps export controls wrapped and disables real exports until generation succeeds', () => {
    render(<MemorialArchitect />)
    expect(screen.getByRole('button', { name: /Petitioner PDF/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Respondent DOCX/i })).toBeDisabled()
    const toolbar = screen.getByText('Appellate Memorials Workspace').parentElement?.parentElement as HTMLElement
    expect(toolbar).toHaveStyle({ flexWrap: 'wrap', minWidth: '0' })
  })
})
