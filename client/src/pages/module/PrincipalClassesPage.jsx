import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Layers3, Loader2, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'
import './ClassesPageRedesign.css'

const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F']

function PrincipalClassesPage() {
  const navigate = useNavigate()
  const [years, setYears] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ std: '', section: 'A' })

  const activeYear = useMemo(
    () => years.find((year) => year.isActive) || years[0] || null,
    [years],
  )

  const totalSections = sections.length

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const yearResponse = await apiClient.get('/academic/years')
      const nextYears = yearResponse.data.years || []
      setYears(nextYears)

      const year = nextYears.find((item) => item.isActive) || nextYears[0]
      if (!year) {
        setClasses([])
        setSections([])
        return
      }

      const [classResponse, sectionResponse] = await Promise.all([
        apiClient.get('/academic/classes', { params: { academicYear: year._id } }),
        apiClient.get('/academic/sections', { params: { academicYear: year._id } }),
      ])

      setClasses(classResponse.data.classes || [])
      setSections(sectionResponse.data.sections || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load classes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createClass = async () => {
    if (!activeYear) return setError('Create an academic year first.')

    const std = String(form.std).trim()
    const order = Number(std)

    if (!std || !Number.isInteger(order) || order < 1 || order > 12) {
      return setError('Enter a valid standard from 1 to 12.')
    }

    if (!form.section) return setError('Select the initial section.')

    setSaving(true)
    setError('')

    try {
      const response = await apiClient.post('/academic/classes', {
        academicYear: activeYear._id,
        name: std,
        order,
      })

      const createdClass = response.data.class
      const targetIndex = SECTION_OPTIONS.indexOf(form.section)

      if (createdClass?._id && targetIndex > 0) {
        for (let index = 1; index <= targetIndex; index += 1) {
          await apiClient.post(`/academic/classes/${createdClass._id}/sections`, {})
        }
      }

      setNotice(response.data.message || `Standard ${std} created with sections up to ${form.section}.`)
      setForm({ std: '', section: 'A' })
      setShowCreate(false)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create class.')
    } finally {
      setSaving(false)
    }
  }

  const addSection = async (classId) => {
    try {
      const response = await apiClient.post(`/academic/classes/${classId}/sections`, {})
      setNotice(response.data.message || 'Next section created successfully.')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create section.')
    }
  }

  const deleteSection = async (section) => {
    if (!window.confirm(`Delete Section ${section.name}? This is only allowed when no active students are enrolled.`)) return

    try {
      const response = await apiClient.delete(`/academic/sections/${section._id}`)
      setNotice(response.data.message || 'Section deleted.')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete section.')
    }
  }

  const deleteClass = async (schoolClass) => {
    if (!window.confirm(`Delete Standard ${schoolClass.name} and its empty sections? Active student classes cannot be deleted.`)) return

    try {
      const response = await apiClient.delete(`/academic/classes/${schoolClass._id}`)
      setNotice(response.data.message || 'Class deleted.')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete class.')
    }
  }

  return (
    <div className="classes-redesign">
      <header className="classes-hero">
        <div>
          <span className="classes-kicker">Academic structure</span>
          <h1>Classes & sections</h1>
          <p>
            Build the school structure for the active academic year. Each standard has its own
            section lane, so the complete structure stays visible without turning every class into a card.
          </p>
        </div>

        <div className="classes-actions">
          <button className="classes-btn" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'classes-spin' : ''} />
            Refresh
          </button>
          <button
            className="classes-btn primary"
            onClick={() => {
              setShowCreate(true)
              setError('')
            }}
          >
            <Plus size={16} />
            Add class
          </button>
        </div>
      </header>

      {error && (
        <div className="classes-alert error">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="classes-alert success">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss notice">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="classes-overview">
        <div className="classes-overview-item">
          <span>Active academic year</span>
          <strong>{activeYear?.name || 'Not configured'}</strong>
          <small>The structure below is connected to this academic year.</small>
        </div>
        <div className="classes-overview-item">
          <span>Standards</span>
          <strong>{classes.length}</strong>
          <small>Configured levels</small>
        </div>
        <div className="classes-overview-item">
          <span>Sections</span>
          <strong>{totalSections}</strong>
          <small>Across all standards</small>
        </div>
        <div className="classes-overview-item">
          <span>Structure</span>
          <strong>{classes.length ? 'Ready' : 'Empty'}</strong>
          <small>{classes.length ? 'Ready for enrollment' : 'Add the first class'}</small>
        </div>
      </section>

      <section className="classes-board">
        <div className="classes-board-head">
          <div>
            <h2>Academic map</h2>
            <p>Every standard and its sections in one clean view.</p>
          </div>
          <span className="year-pill">
            <Layers3 size={14} />
            {activeYear?.name || 'No academic year'}
          </span>
        </div>

        {loading ? (
          <div className="classes-loading">
            <Loader2 size={22} className="classes-spin" />
          </div>
        ) : classes.length ? (
          classes.map((schoolClass) => {
            const classSections = sections.filter(
              (section) => (section.class?._id || section.class) === schoolClass._id,
            )

            return (
              <article className="class-lane" key={schoolClass._id}>
                <div className="class-number">
                  <span>Standard</span>
                  <strong>{schoolClass.name}</strong>
                </div>

                <div className="class-name">
                  <h3>Class {schoolClass.name}</h3>
                  <p>
                    {classSections.length
                      ? `${classSections.length} section${classSections.length > 1 ? 's' : ''} configured`
                      : 'No sections configured yet'}
                  </p>
                </div>

                <div className="section-area">
                  <span className="section-label">Sections</span>
                  {classSections.map((section) => (
                    <span className="section-pill" key={section._id}>
                      Section {section.name}
                      <button
                        type="button"
                        onClick={() => deleteSection(section)}
                        title={`Delete Section ${section.name}`}
                        aria-label={`Delete Section ${section.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                  <button className="section-add" onClick={() => addSection(schoolClass._id)}>
                    <Plus size={13} />
                    Add section
                    <ChevronRight size={13} />
                  </button>
                </div>

                <button
                  className="class-delete"
                  onClick={() => deleteClass(schoolClass)}
                  title="Delete standard"
                  aria-label={`Delete Standard ${schoolClass.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </article>
            )
          })
        ) : (
          <div className="classes-empty">
            <Users size={28} />
            <strong>No standards in {activeYear?.name || 'the current academic year'}.</strong>
            <span>Create the first standard to start building your academic structure.</span>
          </div>
        )}
      </section>

      {showCreate && (
        <div className="classes-modal-backdrop">
          <div className="classes-modal">
            <div className="classes-modal-head">
              <div>
                <span>ACADEMIC SETUP</span>
                <h2>Add a new standard</h2>
              </div>
              <button
                className="classes-modal-close"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <div className="classes-modal-body">
              <div className="classes-form-grid">
                <label className="classes-field">
                  <span>Standard</span>
                  <input
                    value={form.std}
                    onChange={(e) =>
                      setForm({ ...form, std: e.target.value.replace(/\D/g, '').slice(0, 2) })
                    }
                    inputMode="numeric"
                    placeholder="8"
                    autoFocus
                  />
                </label>

                <label className="classes-field">
                  <span>Starting section</span>
                  <select
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                  >
                    {SECTION_OPTIONS.map((section) => (
                      <option key={section} value={section}>
                        Section {section}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="classes-help">
                  Every new standard starts with Section A. If you choose B/C/D etc., the missing
                  sections are created automatically up to your selected section.
                </div>
              </div>
            </div>

            <div className="classes-modal-foot">
              <button className="classes-btn" onClick={() => setShowCreate(false)} disabled={saving}>
                Cancel
              </button>
              <button className="classes-btn primary" onClick={createClass} disabled={saving}>
                {saving ? <Loader2 size={15} className="classes-spin" /> : <Plus size={15} />}
                {saving ? 'Creating...' : 'Create standard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PrincipalClassesPage
