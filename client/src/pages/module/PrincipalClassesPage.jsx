import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'
import './PrincipalModulePage.css'

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
  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0] || null, [years])

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

  useEffect(() => { load() }, [])

  const createClass = async () => {
    if (!activeYear) return setError('Create an academic year first.')
    const std = String(form.std).trim()
    const order = Number(std)
    if (!std || !Number.isInteger(order) || order < 1 || order > 12) return setError('Enter a valid standard from 1 to 12.')
    if (!form.section) return setError('Select the initial section.')

    setSaving(true)
    setError('')
    try {
      const response = await apiClient.post('/academic/classes', { academicYear: activeYear._id, name: std, order })
      const createdClass = response.data.class
      const targetIndex = SECTION_OPTIONS.indexOf(form.section)
      if (createdClass?._id && targetIndex > 0) {
        for (let index = 1; index <= targetIndex; index += 1) await apiClient.post(`/academic/classes/${createdClass._id}/sections`, {})
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

  return <div className="principal-module-page">
    <header className="module-page-header">
      <button className="back-btn" onClick={() => navigate('/dashboard/principal')}><ArrowLeft size={16}/> Dashboard</button>
      <div className="module-title-row">
        <div className="module-title-icon"><Plus size={20}/></div>
        <div><span>ACADEMICS</span><h1>Classes</h1><p>Manage the real academic structure for the active school year.</p></div>
      </div>
      {loading && <span className="loading-label"><Loader2 size={14} className="spin"/> Loading</span>}
    </header>

    {error && <div className="module-alert error"><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}
    {notice && <div className="module-alert success"><span>{notice}</span><button onClick={() => setNotice('')}><X size={15}/></button></div>}

    <section className="module-surface">
      <div className="structure-toolbar">
        <div><span>ACTIVE ACADEMIC YEAR</span><strong>{activeYear?.name || 'Not configured'}</strong></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary-btn" onClick={load}><RefreshCw size={15}/> Refresh</button>
          <button className="primary-btn" onClick={() => { setShowCreate(true); setError('') }}><Plus size={15}/> Create class</button>
        </div>
      </div>

      <div className="class-grid">
        {classes.map((schoolClass) => {
          const classSections = sections.filter((section) => (section.class?._id || section.class) === schoolClass._id)
          return <article className="class-card" key={schoolClass._id}>
            <div className="class-card-top">
              <span>STD {schoolClass.name}</span>
              <strong>Standard {schoolClass.name}</strong>
              <button className="icon-btn danger" onClick={() => deleteClass(schoolClass)} title="Delete standard"><Trash2 size={14}/></button>
            </div>
            <div className="section-list">
              {classSections.map((section) => <span key={section._id} className="section-chip">Section {section.name}<button type="button" onClick={() => deleteSection(section)} title={`Delete Section ${section.name}`}><Trash2 size={12}/></button></span>)}
            </div>
            <button className="text-btn" onClick={() => addSection(schoolClass._id)}><Plus size={14}/> Add next section</button>
          </article>
        })}
      </div>

      {!classes.length && !loading && <div className="empty-state"><strong>No standards in {activeYear?.name || 'the current year'}.</strong><span>Create the first standard and choose its starting section.</span></div>}
    </section>

    {showCreate && <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <div><span>ACADEMIC SETUP</span><h2>Create standard</h2></div>
          <button className="icon-btn" onClick={() => setShowCreate(false)}><X size={17}/></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="form-field">
              <span>STD</span>
              <input value={form.std} onChange={(e) => setForm({ ...form, std: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" placeholder="8" autoFocus/>
            </label>
            <label className="form-field">
              <span>Section</span>
              <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
                {SECTION_OPTIONS.map((section) => <option key={section} value={section}>Section {section}</option>)}
              </select>
            </label>
            <div className="form-help full">The backend creates Section A with every new standard. If you choose B/C/D etc., the missing sections are created automatically up to your selected section.</div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="secondary-btn" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button>
          <button className="primary-btn" onClick={createClass} disabled={saving}>{saving ? <Loader2 size={15} className="spin"/> : <Plus size={15}/>} {saving ? 'Creating...' : 'Create standard'}</button>
        </div>
      </div>
    </div>}
  </div>
}

export default PrincipalClassesPage
