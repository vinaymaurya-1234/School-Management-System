import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Bell, ChevronRight, GraduationCap, Plus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './PrincipalDashboard.css'

function PrincipalDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0] || 'Principal'
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [academicYear, setAcademicYear] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const loadDashboard = async () => {
      setLoading(true); setError('')
      const requests = await Promise.allSettled([
        apiClient.get('/students'),
        apiClient.get('/teachers'),
        apiClient.get('/academic/years'),
        apiClient.get('/academic/classes'),
        apiClient.get('/academic/sections'),
      ])
      if (!mounted) return
      const [studentResult, teacherResult, yearResult, classResult, sectionResult] = requests
      if (studentResult.status === 'fulfilled') setStudents(studentResult.value?.data?.students || [])
      if (teacherResult.status === 'fulfilled') setTeachers(teacherResult.value?.data?.teachers || [])
      if (yearResult.status === 'fulfilled') {
        const years = yearResult.value?.data?.years || []
        setAcademicYear(years.find((year) => year.isActive) || years[0] || null)
      }
      if (classResult.status === 'fulfilled') setClasses(classResult.value?.data?.classes || [])
      if (sectionResult.status === 'fulfilled') setSections(sectionResult.value?.data?.sections || [])
      if (requests.some((result) => result.status === 'rejected')) setError('Some dashboard data could not be loaded. Refresh and try again.')
      setLoading(false)
    }
    loadDashboard()
    return () => { mounted = false }
  }, [])

  const activeStudents = useMemo(() => students.filter((student) => student.active !== false), [students])
  const activeTeachers = useMemo(() => teachers.filter((teacher) => teacher.active !== false), [teachers])

  return (
    <div className="principal-dashboard">
      <section className="principal-hero">
        <div className="hero-copy">
          <div className="principal-kicker-row"><span className="principal-kicker">SCHOOL OVERVIEW</span><span className="live-dot"><i /> Live</span></div>
          <h1>Good morning, {firstName}.</h1>
          <p>{academicYear?.name ? `Academic Year ${academicYear.name}` : 'Here is the current overview of your school.'}</p>
        </div>
        <div className="hero-actions"><Link className="dashboard-icon-button" to="/module/notices" aria-label="Notices"><Bell size={18} /></Link><Link className="dashboard-primary-button" to="/module/students"><Plus size={17} /> Add student</Link></div>
      </section>

      {error && <div className="principal-panel" style={{ padding: '14px', color: '#92400e', background: '#fffbeb' }}>{error}</div>}

      <section className="principal-stat-grid">
        <StatCard label="Active students" value={loading ? '—' : activeStudents.length} icon={Users} />
        <StatCard label="Active teachers" value={loading ? '—' : activeTeachers.length} icon={GraduationCap} />
        <StatCard label="Classes" value={loading ? '—' : classes.length} />
        <StatCard label="Sections" value={loading ? '—' : sections.length} />
      </section>

      <section className="principal-content-grid">
        <article className="principal-panel">
          <div className="principal-panel-header"><div><span>ACADEMIC STRUCTURE</span><h2>Classes & sections</h2><p>Configured for the current school year</p></div><Link className="panel-link" to="/module/classes">Manage <ChevronRight size={14} /></Link></div>
          <div className="quick-action-grid">
            {classes.length === 0 && !loading && <p>No classes configured yet.</p>}
            {classes.map((schoolClass) => {
              const classId = schoolClass._id || schoolClass.id
              const classSections = sections.filter((section) => (section.class?._id || section.class?.id || section.class) === classId)
              return <Link key={classId} to="/module/classes" className="principal-panel" style={{ padding: '16px' }}><b>Class {schoolClass.name}</b><p style={{ margin: '6px 0 0', color: '#64748b' }}>{classSections.length ? classSections.map((section) => `Section ${section.name}`).join(' • ') : 'No sections'}</p></Link>
            })}
          </div>
        </article>

        <article className="principal-panel">
          <div className="principal-panel-header"><div><span>RECENT STUDENTS</span><h2>Student records</h2><p>Active students from the backend</p></div><Link className="panel-link" to="/module/students">View all <ChevronRight size={14} /></Link></div>
          <div className="principal-activity-list">
            {activeStudents.slice(0, 5).map((student) => <Link to="/module/students" className="principal-activity-row" key={student.id || student._id}><div className="activity-marker green" /><div className="activity-copy"><strong>{student.name}</strong><span>{student.admissionNumber || 'No admission number'}</span></div><time>Active</time></Link>)}
            {!loading && activeStudents.length === 0 && <p>No active students found.</p>}
          </div>
        </article>
      </section>

      <section className="principal-panel quick-panel">
        <div className="principal-panel-header"><div><span>SHORTCUTS</span><h2>Principal actions</h2><p>Common administrative tasks</p></div></div>
        <div className="quick-action-grid">
          <Link to="/module/students"><b>Add / manage students</b><ChevronRight size={15} /></Link>
          <Link to="/module/teachers"><b>Manage teachers</b><ChevronRight size={15} /></Link>
          <Link to="/module/classes"><b>Academic setup</b><ChevronRight size={15} /></Link>
          <Link to="/module/attendance"><b>Record attendance</b><ChevronRight size={15} /></Link>
        </div>
      </section>

      <div className="principal-insight"><div><span className="insight-label">REAL BACKEND DATA</span><strong>Dashboard numbers are coming from the school APIs.</strong><p>Modules now use MongoDB-backed records. Empty modules stay empty until the principal adds real records.</p></div></div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon }) { return <article className="principal-stat-card"><div className="principal-stat-top"><div className="principal-stat-icon indigo">{Icon ? <Icon size={19} /> : <ArrowUpRight size={19} />}</div><span className="stat-period">Live</span></div><p>{label}</p><div className="principal-stat-value-row"><strong>{value}</strong></div><small>From current backend records</small></article> }
export default PrincipalDashboard
