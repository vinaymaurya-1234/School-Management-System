import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, Loader2, Plus, Trash2, X, Layers, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'
import './PrincipalSubjectsPage.css'

function PrincipalSubjectsPage() {
  const navigate = useNavigate()
  const [years, setYears] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(false)
  const [mode, setMode] = useState('create')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [expandedSubjects, setExpandedSubjects] = useState({})
  const [form, setForm] = useState({ name: '', subjectId: '', classIds: [], weeklyPeriods: 5, classFrequencies: {} })

  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0], [years])
  const catalog = useMemo(() => {
    const byId = new Map()
    subjects.forEach((mapping) => {
      const subject = mapping.subject
      if (!subject?._id) return
      if (!byId.has(subject._id)) byId.set(subject._id, { ...subject, mappings: [] })
      byId.get(subject._id).mappings.push(mapping)
    })
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [subjects])
  const filteredCatalog = catalog.filter((subject) => subject.name.toLowerCase().includes(search.toLowerCase()))
  const className = (id) => classes.find((item) => item._id === id)?.name || 'Class'

  const load = async () => {
    setLoading(true); setError('')
    try {
      const yearRes = await apiClient.get('/academic/years')
      const nextYears = yearRes.data.years || []
      setYears(nextYears)
      const year = nextYears.find((item) => item.isActive) || nextYears[0]
      if (!year) { setClasses([]); setSubjects([]); return }
      const [classRes, subjectRes] = await Promise.all([
        apiClient.get('/academic/classes', { params: { academicYear: year._id } }),
        apiClient.get('/subjects', { params: { academicYear: year._id } }),
      ])
      setClasses((classRes.data.classes || []).filter((item) => {
        const n = Number(item.name)
        return !Number.isFinite(n) || (n >= 1 && n <= 10)
      }).sort((a, b) => Number(a.name) - Number(b.name)))
      setSubjects(subjectRes.data.subjects || [])
    } catch (err) { setError(err.response?.data?.message || 'Unable to load subjects.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setMode('create')
    setForm({ name: '', subjectId: '', classIds: [], weeklyPeriods: 5, classFrequencies: {} })
    setError(''); setModal(true)
  }
  const openAssign = (subject) => {
    setMode('assign')
    setForm({ name: subject.name, subjectId: subject._id, classIds: [], weeklyPeriods: 5, classFrequencies: {} })
    setError(''); setModal(true)
  }
  const toggleClass = (id) => setForm((prev) => {
    const selected = prev.classIds.includes(id)
    return {
      ...prev,
      classIds: selected ? prev.classIds.filter((item) => item !== id) : [...prev.classIds, id],
      classFrequencies: selected
        ? Object.fromEntries(Object.entries(prev.classFrequencies || {}).filter(([classId]) => classId !== id))
        : { ...(prev.classFrequencies || {}), [id]: 5 },
    }
  })

  const save = async () => {
    if (!activeYear) return setError('Please configure an academic year first.')
    if (mode === 'create' && !form.name.trim()) return setError('Enter a subject name.')
    if (!form.classIds.length) return setError('Select at least one class.')
    const invalidFrequency = form.classIds.some((id) => !Number.isInteger(Number(form.classFrequencies?.[id] ?? 5)) || Number(form.classFrequencies?.[id] ?? 5) < 1 || Number(form.classFrequencies?.[id] ?? 5) > 36)
    if (invalidFrequency) return setError('Enter a whole number from 1 to 36 weekly lectures for every selected class.')
    setSaving(true); setError('')
    try {
      const payload = { academicYear: activeYear._id, classIds: form.classIds, weeklyPeriods: 5, classFrequencies: Object.fromEntries(form.classIds.map((id) => [id, Number(form.classFrequencies?.[id] ?? 5)])) }
      if (mode === 'create') await apiClient.post('/subjects', { ...payload, name: form.name.trim() })
      else await apiClient.post('/subjects/assign', { ...payload, subjectId: form.subjectId })
      setNotice(mode === 'create' ? `${form.name.trim()} created and assigned to ${form.classIds.length} class(es).` : `${form.name} assigned to ${form.classIds.length} class(es).`)
      setModal(false)
      await load()
    } catch (err) { setError(err.response?.data?.message || 'Unable to save subject changes.') }
    finally { setSaving(false) }
  }

  const editWeeklyPeriods = async (mapping, subjectName, classLabel) => {
    const current = Number(mapping.weeklyPeriods) || 5
    const answer = window.prompt(`Weekly lectures for ${subjectName} in Class ${classLabel} (1–36):`, String(current))
    if (answer === null) return
    const weeklyPeriods = Number(answer)
    if (!Number.isInteger(weeklyPeriods) || weeklyPeriods < 1 || weeklyPeriods > 36) {
      setError('Enter a whole number from 1 to 36.')
      return
    }
    try {
      setError('')
      const response = await apiClient.patch(`/subjects/${mapping._id}/weekly-periods`, { weeklyPeriods })
      setNotice(response.data.message || `Updated ${subjectName} for Class ${classLabel}.`)
      await load()
    } catch (err) { setError(err.response?.data?.message || 'Unable to update weekly lecture frequency.') }
  }

  const removeMapping = async (mapping, subjectName) => {
    const name = className(mapping.class?._id || mapping.class)
    if (!window.confirm(`Remove ${subjectName} from Class ${name}? This also removes its teacher assignment for that class.`)) return
    try {
      await apiClient.delete(`/subjects/${mapping._id}`)
      setNotice(`${subjectName} removed from Class ${name}.`)
      await load()
    } catch (err) { setError(err.response?.data?.message || 'Unable to remove subject from class.') }
  }

  return <main className="subjects-page">
    <header className="subjects-header">
      <div className="subjects-heading"><div className="subjects-icon"><BookOpen size={22}/></div><div><span>ACADEMICS / CURRICULUM</span><h1>Subject Library</h1><p>Create each subject once, then assign it to multiple classes from one place.</p></div></div>
      {loading && <span className="subjects-loading"><Loader2 size={15} className="subjects-spin"/> Loading</span>}
    </header>

    {error && <div className="subjects-alert subjects-error"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
    {notice && <div className="subjects-alert subjects-success"><Check size={16}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={16}/></button></div>}

    <section className="subjects-panel">
      <div className="subjects-toolbar">
        <div><span className="subjects-eyebrow">ACADEMIC YEAR</span><h2>{activeYear?.name || 'Not configured'}</h2><p>Classes 1–10 · One shared subject list</p></div>
        <div className="subjects-actions"><button className="subjects-btn subjects-btn-dark" onClick={openCreate}><Plus size={16}/> Create subject</button></div>
      </div>
      <div className="subjects-stats">
        <div><span>SUBJECTS</span><strong>{catalog.length}</strong><small>Unique subjects in your library</small></div>
        <div><span>CLASSES</span><strong>{classes.length}</strong><small>Available classes (1–10)</small></div>
        <div><span>ASSIGNMENTS</span><strong>{subjects.length}</strong><small>Subject-to-class links</small></div>
      </div>
      <div className="subjects-list-heading"><div><h2>All subjects</h2><p>Assign an existing subject to more classes whenever needed.</p></div><label className="subjects-search"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subjects…"/></label></div>
      <div className="subjects-grid">
        {filteredCatalog.map((subject) => {
          const assigned = subject.mappings.map((mapping) => ({ mapping, id: mapping.class?._id || mapping.class, name: mapping.class?.name || '—' }))
          return <article className="subjects-card" key={subject._id}>
            <div className="subjects-card-top"><div className="subjects-card-icon"><BookOpen size={19}/></div><span className="subjects-count">{assigned.length} {assigned.length === 1 ? 'class' : 'classes'}</span></div>
            <h3>{subject.name}</h3>
            <div className="subjects-card-summary">
              <span>{assigned.length ? `${assigned.length} classes assigned` : 'Not assigned to any class yet'}</span>
              <span>{assigned.reduce((total, item) => total + (Number(item.mapping.weeklyPeriods) || 5), 0)} lectures / week</span>
            </div>
            {expandedSubjects[subject._id] && <>
              <div className="subjects-assigned-label"><Layers size={14}/> ASSIGNED CLASSES</div>
              <div className="subjects-mapping-list">{assigned.sort((a, b) => Number(a.name) - Number(b.name)).map(({ mapping, id, name }) => <div className="subjects-mapping-row" key={mapping._id}><div className="subjects-mapping-label"><strong>Class {name}</strong><span>{mapping.weeklyPeriods || 5} lectures / week</span></div><div className="subjects-mapping-actions"><button type="button" title="Edit weekly lecture frequency" onClick={() => editWeeklyPeriods(mapping, subject.name, name)}>Edit frequency</button><button type="button" title={`Remove from Class ${name}`} onClick={() => removeMapping(mapping, subject.name)}><X size={13}/></button></div></div>)}</div>
            </>}
            <div className="subjects-card-footer">
              <button className="subjects-expand-btn" type="button" aria-expanded={Boolean(expandedSubjects[subject._id])} onClick={() => setExpandedSubjects((prev) => ({ ...prev, [subject._id]: !prev[subject._id] }))}>
                {expandedSubjects[subject._id] ? 'Hide classes' : 'Manage classes'} <span>{expandedSubjects[subject._id] ? '−' : '+'}</span>
              </button>
              <button className="subjects-assign-btn" onClick={() => openAssign(subject)}><Plus size={15}/> Assign classes</button>
            </div>
          </article>
        })}
        {!filteredCatalog.length && <div className="subjects-empty"><BookOpen size={27}/><strong>{search ? 'No matching subjects' : 'Your subject library is empty'}</strong><span>{search ? 'Try another subject name.' : 'Create a subject once and assign it to one or more classes.'}</span>{!search && <button className="subjects-btn subjects-btn-dark" onClick={openCreate}><Plus size={15}/> Create first subject</button>}</div>}
      </div>
    </section>

    {modal && <div className="subjects-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setModal(false) }}><section className="subjects-modal" role="dialog" aria-modal="true" aria-labelledby="subjects-modal-title">
      <div className="subjects-modal-head"><div><span className="subjects-eyebrow">{mode === 'create' ? 'NEW SUBJECT' : 'UPDATE CURRICULUM'}</span><h2 id="subjects-modal-title">{mode === 'create' ? 'Create a subject' : `Assign ${form.name}`}</h2><p>{mode === 'create' ? 'Create it once, then select every class that teaches it.' : 'Select only the additional classes where this subject should be taught.'}</p></div><button className="subjects-close" onClick={() => setModal(false)} disabled={saving}><X size={18}/></button></div>
      <div className="subjects-modal-body">
        {mode === 'create' && <label className="subjects-field"><span>SUBJECT NAME</span><input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics"/></label>}
        <div className="subjects-class-pick-head"><span>SELECT CLASSES</span><button type="button" onClick={() => setForm({ ...form, classIds: form.classIds.length === classes.length ? [] : classes.map((item) => item._id) })}>{form.classIds.length === classes.length ? 'Clear all' : 'Select all'}</button></div>
        <div className="subjects-class-grid">{classes.map((item) => <label className={`subjects-class-option ${form.classIds.includes(item._id) ? 'selected' : ''}`} key={item._id}><input type="checkbox" checked={form.classIds.includes(item._id)} onChange={() => toggleClass(item._id)}/><span className="subjects-check">{form.classIds.includes(item._id) && <Check size={13}/>}</span><span>Class {item.name}</span></label>)}</div>
        <div className="subjects-frequency-editor"><div className="subjects-class-pick-head"><span>WEEKLY LECTURES BY CLASS</span><small>Set 1–36 periods for each selected class</small></div>{form.classIds.map((id) => <label className="subjects-frequency-row" key={id}><span>Class {className(id)}</span><input type="number" min="1" max="36" step="1" value={form.classFrequencies?.[id] ?? 5} onChange={(e) => setForm((prev) => ({ ...prev, classFrequencies: { ...(prev.classFrequencies || {}), [id]: e.target.value } }))} aria-label={`Weekly lectures for Class ${className(id)}`} /><small>lectures / week</small></label>)}<p className="subjects-modal-note">Already-assigned classes are skipped. You can edit any class frequency later from its subject card.</p></div>
      </div>
      <div className="subjects-modal-foot"><button className="subjects-btn subjects-btn-light" onClick={() => setModal(false)} disabled={saving}>Cancel</button><button className="subjects-btn subjects-btn-dark" onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="subjects-spin"/> : <Check size={15}/>} {saving ? 'Saving…' : mode === 'create' ? 'Create & assign' : 'Assign subject'}</button></div>
    </section></div>}
  </main>
}

export default PrincipalSubjectsPage
