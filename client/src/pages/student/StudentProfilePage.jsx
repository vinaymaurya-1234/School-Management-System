import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, FileText, GraduationCap, IdCard, KeyRound, LoaderCircle, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, UserRound, Users, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './StudentProfilePage.css'

const TABS = [
  { id: 'personal', label: 'Personal details', Icon: UserRound },
  { id: 'academic', label: 'Academic information', Icon: GraduationCap },
  { id: 'guardian', label: 'Parent / Guardian', Icon: Users },
  { id: 'documents', label: 'Documents', Icon: FileText },
  { id: 'security', label: 'Account & security', Icon: LockKeyhole },
]
const QUICK_LINKS = [
  { label: 'Attendance', detail: 'Attendance record', href: '/module/attendance', Icon: CalendarDays },
  { label: 'Timetable', detail: 'Class schedule', href: '/module/timetable', Icon: BookOpen },
  { label: 'Exams & results', detail: 'Published assessments', href: '/module/exams', Icon: GraduationCap },
  { label: 'Assignments', detail: 'Homework from teachers', href: '/module/assignments', Icon: FileText },
  { label: 'Fees & receipts', detail: 'Your fee account', href: '/module/fees', Icon: IdCard },
]

function displayDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function Field({ label, value, hint }) {
  return <div className="sp-field"><span>{label}</span><strong>{value || 'Not recorded'}</strong>{hint && <small>{hint}</small>}</div>
}
function StudentProfilePage() {
  const { user, updateUser } = useAuth()
  const [activeTab, setActiveTab] = useState('personal')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [contact, setContact] = useState({ address: '', guardianPhone: '', guardianEmail: '' })
  const [account, setAccount] = useState({ email: user?.email || '', currentPassword: '', newPassword: '' })

  const loadProfile = async () => {
    setLoading(true); setError('')
    try {
      const { data } = await apiClient.get('/students/me/profile')
      setProfile(data)
      setContact({ address: data.profile?.address || '', guardianPhone: data.profile?.guardianPhone || '', guardianEmail: data.profile?.guardianEmail || '' })
      setAccount((current) => ({ ...current, email: data.account?.email || user?.email || '' }))
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your student profile.')
    } finally { setLoading(false) }
  }
  useEffect(() => { loadProfile() }, [])

  const student = profile?.profile || {}
  const academics = profile?.academics || null
  const completion = useMemo(() => {
    const fields = [student.name, student.admissionNumber, student.dateOfBirth, student.gender, student.address, academics?.class?.name, academics?.section?.name, student.guardianName, student.guardianPhone]
    return Math.round(fields.filter(Boolean).length / fields.length * 100)
  }, [student, academics])

  const saveContact = async () => {
    const { data } = await apiClient.put('/students/me/profile', contact)
    setProfile((current) => ({ ...current, profile: data.profile }))
    setContact({ address: data.profile?.address || '', guardianPhone: data.profile?.guardianPhone || '', guardianEmail: data.profile?.guardianEmail || '' })
  }
  const saveAccount = async () => {
    if (!account.email.trim()) throw new Error('Email address is required.')
    if (account.newPassword && account.newPassword.length < 6) throw new Error('New password must be at least 6 characters.')
    if (account.newPassword && !account.currentPassword) throw new Error('Enter your current password to change your password.')
    const payload = { email: account.email.trim().toLowerCase() }
    if (account.newPassword) { payload.currentPassword = account.currentPassword; payload.password = account.newPassword }
    const { data } = await apiClient.put('/auth/me', payload)
    if (data.user && updateUser) updateUser(data.user)
    setProfile((current) => ({ ...current, account: data.user || current.account }))
    setAccount((current) => ({ ...current, email: data.user?.email || current.email, currentPassword: '', newPassword: '' }))
  }
  const handleSave = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      if (activeTab === 'personal' || activeTab === 'guardian') await saveContact()
      else if (activeTab === 'security') await saveAccount()
      else return
      setSuccess(activeTab === 'security' ? 'Account settings updated successfully.' : 'Your permitted contact details have been saved.')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save changes.')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="student-profile-page"><div className="sp-state"><LoaderCircle className="sp-spin" size={24}/><strong>Loading your profile</strong><span>Getting your saved school and academic records.</span></div></div>

  return <main className="student-profile-page">
    <header className="sp-hero">
      <div className="sp-hero-top"><span className="sp-eyebrow">STUDENT ACCOUNT</span><span className="sp-status"><CheckCircle2 size={14}/>{student.active === false || profile?.account?.active === false ? 'Inactive' : 'Active account'}</span></div>
      <div className="sp-identity">
        <div className="sp-avatar">{(student.name || profile?.account?.name || user?.name || 'S').trim().charAt(0).toUpperCase()}</div>
        <div className="sp-identity-copy"><h1>{student.name || profile?.account?.name || user?.name || 'Student profile'}</h1><p>{profile?.school?.name || 'School'} · {academics?.class?.name ? `Class ${academics.class.name}${academics.section?.name ? `-${academics.section.name}` : ''}` : 'Class not assigned'}</p><div className="sp-identity-tags"><span><IdCard size={13}/> Admission no. {student.admissionNumber || 'Not assigned'}</span><span><CalendarDays size={13}/> {academics?.academicYear?.name || 'Academic year not assigned'}</span></div></div>
        <div className="sp-completion"><div className="sp-completion-label"><span>Profile completion</span><strong>{completion}%</strong></div><div className="sp-progress"><span style={{ width: `${completion}%` }}/></div><small>Based on information recorded by your school</small></div>
      </div>
    </header>

    <section className="sp-summary-grid">
      <article><span>Admission number</span><strong>{student.admissionNumber || '—'}</strong><small><IdCard size={13}/> Student identity</small></article>
      <article><span>Class & section</span><strong>{academics?.class?.name ? `${academics.class.name}${academics.section?.name ? ` - ${academics.section.name}` : ''}` : 'Not assigned'}</strong><small><GraduationCap size={13}/> Current enrollment</small></article>
      <article><span>Academic year</span><strong>{academics?.academicYear?.name || 'Not assigned'}</strong><small><CalendarDays size={13}/> {academics?.academicYear?.isActive ? 'Active session' : 'School record'}</small></article>
      <article><span>Enrollment status</span><strong>{academics?.enrollmentStatus ? academics.enrollmentStatus.charAt(0).toUpperCase() + academics.enrollmentStatus.slice(1) : 'Not recorded'}</strong><small><ShieldCheck size={13}/> School-managed record</small></article>
    </section>

    {error && <div className="sp-message error" role="alert">{error}<button type="button" onClick={() => setError('')}>Dismiss</button></div>}
    {success && <div className="sp-message success" role="status">{success}<button type="button" onClick={() => setSuccess('')}>Dismiss</button></div>}

    <div className="sp-main-grid">
      <section className="sp-card sp-profile-card">
        <div className="sp-card-heading"><div><span className="sp-eyebrow">YOUR INFORMATION</span><h2>Student profile</h2><p>Review your school record and update permitted contact details.</p></div><button className="sp-icon-button" type="button" title="Refresh profile" onClick={loadProfile}><RefreshCw size={16}/></button></div>
        <nav className="sp-tabs" aria-label="Profile sections">{TABS.map(({id,label,Icon}) => <button key={id} type="button" className={activeTab===id?'active':''} onClick={() => {setActiveTab(id);setError('');setSuccess('')}}><Icon size={16}/><span>{label}</span></button>)}</nav>

        {activeTab === 'personal' && <form onSubmit={handleSave} className="sp-tab-content">
          <div className="sp-section-title"><h3>Personal details</h3><p>Official identity fields are maintained by your school. Address can be updated here.</p></div>
          <div className="sp-fields-grid"><Field label="Full name" value={student.name || profile?.account?.name}/><Field label="Date of birth" value={displayDate(student.dateOfBirth)}/><Field label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase()+student.gender.slice(1) : ''}/><Field label="Admission date" value={displayDate(student.admissionDate)}/><Field label="Admission number" value={student.admissionNumber}/><label className="sp-input-field sp-wide">Residential address<textarea rows={3} maxLength={500} value={contact.address} onChange={(event)=>setContact({...contact,address:event.target.value})} placeholder="Add your current address"/></label></div>
          <div className="sp-form-footer"><span>Official student details can only be changed by an authorized school administrator.</span><button className="sp-primary-button" disabled={saving} type="submit">{saving?'Saving…':'Save contact details'}</button></div>
        </form>}

        {activeTab === 'academic' && <div className="sp-tab-content"><div className="sp-section-title"><h3>Academic information</h3><p>Enrollment details linked to the school's academic-year records.</p></div><div className="sp-fields-grid"><Field label="Academic year" value={academics?.academicYear?.name}/><Field label="Class / standard" value={academics?.class?.name}/><Field label="Division / section" value={academics?.section?.name}/><Field label="Enrollment status" value={academics?.enrollmentStatus}/><Field label="Enrollment date" value={displayDate(academics?.enrolledAt)}/><Field label="School" value={profile?.school?.name}/><Field label="School code" value={profile?.school?.code}/><Field label="School address" value={profile?.school?.address}/></div><div className="sp-note"><ShieldCheck size={17}/><span>Class, section, admission number and academic status are read-only here so they stay consistent with school records.</span></div></div>}

        {activeTab === 'guardian' && <form onSubmit={handleSave} className="sp-tab-content"><div className="sp-section-title"><h3>Parent / guardian details</h3><p>Only details saved by the school are shown. You can update the guardian's contact details.</p></div><div className="sp-fields-grid"><Field label="Parent / guardian name" value={student.guardianName}/><label className="sp-input-field">Guardian phone<input type="tel" autoComplete="tel" maxLength={20} value={contact.guardianPhone} onChange={(event)=>setContact({...contact,guardianPhone:event.target.value})} placeholder="Guardian phone number"/></label><label className="sp-input-field">Guardian email<input type="email" autoComplete="email" maxLength={254} value={contact.guardianEmail} onChange={(event)=>setContact({...contact,guardianEmail:event.target.value})} placeholder="Guardian email address"/></label><Field label="Emergency contact" value={student.guardianPhone || contact.guardianPhone} hint="Uses the guardian number on file; ask the school to record a separate emergency contact."/></div><div className="sp-form-footer"><span>Contact updates are saved to your student record.</span><button className="sp-primary-button" disabled={saving} type="submit">{saving?'Saving…':'Save guardian contacts'}</button></div></form>}

        {activeTab === 'documents' && <div className="sp-tab-content"><div className="sp-section-title"><h3>School documents</h3><p>Documents are shown here only when the school document feature is connected.</p></div><div className="sp-empty-docs"><div><FileText size={24}/></div><strong>No documents available</strong><p>Your school has not made any student documents available in this profile yet. Document uploads and downloads are not enabled in the current backend.</p></div></div>}

        {activeTab === 'security' && <form onSubmit={handleSave} className="sp-tab-content"><div className="sp-section-title"><h3>Account & security</h3><p>Update your login email or change your password securely.</p></div><div className="sp-security-callout"><LockKeyhole size={19}/><div><strong>Protected account</strong><span>Password changes require your current password. Your password is never displayed.</span></div></div><div className="sp-fields-grid"><label className="sp-input-field sp-wide">Login email<input type="email" autoComplete="email" required maxLength={254} value={account.email} onChange={(event)=>setAccount({...account,email:event.target.value})}/></label><label className="sp-input-field">Current password<input type="password" autoComplete="current-password" value={account.currentPassword} onChange={(event)=>setAccount({...account,currentPassword:event.target.value})} placeholder="Required only to change password"/></label><label className="sp-input-field">New password<input type="password" autoComplete="new-password" minLength={6} value={account.newPassword} onChange={(event)=>setAccount({...account,newPassword:event.target.value})} placeholder="At least 6 characters"/></label><Field label="Account role" value={profile?.account?.role || 'student'}/><Field label="Account status" value={profile?.account?.active === false ? 'Inactive' : 'Active'}/><Field label="Account created" value={displayDate(profile?.account?.createdAt)}/></div><div className="sp-form-footer"><span>Use a unique password and keep your login details private.</span><button className="sp-primary-button" disabled={saving} type="submit">{saving?'Saving…':'Save account settings'}</button></div></form>}
      </section>

      <aside className="sp-side-column">
        <section className="sp-card sp-quick-card"><div className="sp-card-heading"><div><span className="sp-eyebrow">STUDENT PORTAL</span><h2>Quick access</h2><p>Go straight to your learning tools.</p></div></div><div className="sp-quick-links">{QUICK_LINKS.map(({label,detail,href,Icon})=><Link to={href} key={href}><span className="sp-quick-icon"><Icon size={17}/></span><span><strong>{label}</strong><small>{detail}</small></span><ChevronRight size={16}/></Link>)}</div></section>
        <section className="sp-card sp-help-card"><div className="sp-help-icon"><ShieldCheck size={19}/></div><h3>Need to correct an official detail?</h3><p>Contact your class teacher or school office to update admission number, date of birth, class, section or other official records.</p></section>
        <section className="sp-card sp-contact-card"><span className="sp-eyebrow">SCHOOL CONTACT</span><h3>{profile?.school?.name || 'Your school'}</h3><p><MapPin size={14}/>{profile?.school?.address || 'School address not recorded'}</p><p><Mail size={14}/>{profile?.school?.code ? `School code: ${profile.school.code}` : 'School contact details not recorded'}</p></section>
      </aside>
    </div>
  </main>
}
export default StudentProfilePage
