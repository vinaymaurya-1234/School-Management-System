import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, GraduationCap, IdCard, LockKeyhole, Mail, MapPin, Phone, RefreshCw, ShieldCheck, UserRound, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './TeacherProfilePage.css'

const tabs = [
  { id: 'personal', label: 'Personal details', Icon: UserRound },
  { id: 'employment', label: 'Employment', Icon: GraduationCap },
  { id: 'emergency', label: 'Emergency contact', Icon: Users },
  { id: 'security', label: 'Account & security', Icon: LockKeyhole },
]
const show = (value) => value === 0 ? '0' : value || 'Not recorded'
const dateLabel = (value) => value ? (Number.isNaN(new Date(value).getTime()) ? 'Not recorded' : new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })) : 'Not recorded'
function Field({ label, value }) { return <div className="tp-field"><span>{label}</span><strong>{show(value)}</strong></div> }

export default function TeacherProfilePage() {
  const { user, updateUser } = useAuth()
  const [tab, setTab] = useState('personal')
  const [teacher, setTeacher] = useState(null)
  const [school, setSchool] = useState(null)
  const [account, setAccount] = useState({ email: user?.email || '', currentPassword: '', newPassword: '' })
  const [contact, setContact] = useState({ phone: '', address: '', emergencyContact: { name: '', phone: '', relation: '' } })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [profileResult, accountResult] = await Promise.all([
        apiClient.get('/teacher-profile/me'),
        apiClient.get('/auth/me'),
      ])
      const data = profileResult.data
      setTeacher(data.teacher || null); setSchool(data.school || null)
      setContact({ phone: data.teacher?.phone || '', address: data.teacher?.address || '', emergencyContact: { name: data.teacher?.emergencyContact?.name || '', phone: data.teacher?.emergencyContact?.phone || '', relation: data.teacher?.emergencyContact?.relation || '' } })
      const savedUser = accountResult.data?.user || user
      setAccount((current) => ({ ...current, email: savedUser?.email || '' }))
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your teacher profile. Check that the school has created your staff profile.')
      try { const { data } = await apiClient.get('/auth/me'); setSchool(data.school || null); setAccount((current) => ({ ...current, email: data.user?.email || '' })) } catch {}
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const completion = useMemo(() => {
    const fields = [teacher?.name || user?.name, teacher?.employeeId, teacher?.phone, teacher?.designation, teacher?.department, teacher?.qualification, teacher?.joiningDate, teacher?.address]
    return Math.round(fields.filter(Boolean).length / fields.length * 100)
  }, [teacher, user])

  const saveContact = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const { data } = await apiClient.put('/teacher-profile/me', contact)
      setTeacher(data.teacher); setSchool(data.school || school)
      setNotice(data.message || 'Contact details saved.')
    } catch (err) { setError(err.response?.data?.message || 'Could not save contact details.') }
    finally { setSaving(false) }
  }
  const saveAccount = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      if (!account.email.trim()) throw new Error('Email address is required.')
      if (account.newPassword && account.newPassword.length < 8) throw new Error('Password must be at least 8 characters.')
      if (account.newPassword && !account.currentPassword) throw new Error('Enter your current password to change your password.')
      const payload = { email: account.email.trim().toLowerCase() }
      if (account.newPassword) { payload.password = account.newPassword; payload.currentPassword = account.currentPassword }
      const { data } = await apiClient.put('/auth/me', payload)
      if (data.user && updateUser) updateUser(data.user)
      setAccount((current) => ({ ...current, email: data.user?.email || current.email, currentPassword: '', newPassword: '' }))
      setNotice(data.message || 'Account settings saved.')
    } catch (err) { setError(err.response?.data?.message || err.message || 'Could not save account settings.') }
    finally { setSaving(false) }
  }

  if (loading) return <main className="teacher-profile-page"><div className="tp-state"><RefreshCw className="tp-spin" size={22}/>Loading your profile…</div></main>
  const name = teacher?.name || user?.name || 'Teacher'
  return <main className="teacher-profile-page">
    <header className="tp-hero">
      <div className="tp-kicker">TEACHER ACCOUNT <span className="tp-status"><CheckCircle2 size={14}/>{teacher?.active === false || user?.active === false ? 'Inactive' : 'Active account'}</span></div>
      <div className="tp-identity">
        <div className="tp-avatar">{name.trim().charAt(0).toUpperCase()}</div>
        <div className="tp-identity-copy"><h1>{name}</h1><p>{school?.name || 'School staff'} · {teacher?.designation || 'Teacher'}{teacher?.department ? ' · ' + teacher.department : ''}</p><div className="tp-tags"><span><IdCard size={14}/> Employee ID: {show(teacher?.employeeId)}</span><span><Mail size={14}/>{show(teacher?.email || user?.email)}</span></div></div>
        <div className="tp-completion"><div><span>Profile completion</span><strong>{completion}%</strong></div><div className="tp-progress"><span style={{ width: completion + '%' }}/></div><small>Based on staff information recorded by your school</small></div>
      </div>
    </header>
    <section className="tp-summary">
      <article><span>Employee ID</span><strong>{show(teacher?.employeeId)}</strong><small><IdCard size={13}/> Staff identity</small></article>
      <article><span>Designation</span><strong>{show(teacher?.designation)}</strong><small><GraduationCap size={13}/> Role</small></article>
      <article><span>Department</span><strong>{show(teacher?.department)}</strong><small><Users size={13}/> Faculty</small></article>
      <article><span>Joining date</span><strong>{dateLabel(teacher?.joiningDate)}</strong><small><CalendarDays size={13}/> Employment record</small></article>
    </section>
    {error && <div className="tp-message error" role="alert">{error}<button type="button" onClick={() => setError('')}>Dismiss</button></div>}
    {notice && <div className="tp-message success" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
    <div className="tp-layout">
      <section className="tp-card">
        <header className="tp-card-heading"><div><span className="tp-eyebrow">YOUR INFORMATION</span><h2>Teacher profile</h2><p>View your staff details and manage permitted contact and account settings.</p></div><button className="tp-refresh" type="button" onClick={load} aria-label="Refresh profile"><RefreshCw size={16}/></button></header>
        <nav className="tp-tabs" aria-label="Profile sections">{tabs.map(({id,label,Icon})=><button key={id} type="button" className={tab===id?'active':''} onClick={()=>{setTab(id);setError('');setNotice('')}}><Icon size={16}/><span>{label}</span></button>)}</nav>
        {tab==='personal' && <form className="tp-content" onSubmit={saveContact}><div className="tp-section-title"><h3>Personal details</h3><p>Update your phone number and residential address. Official identity fields are maintained by the school.</p></div><div className="tp-fields"><Field label="Full name" value={name}/><Field label="Email address" value={teacher?.email || user?.email}/><Field label="Date of birth" value={dateLabel(teacher?.dateOfBirth)}/><Field label="Gender" value={teacher?.gender}/><label className="tp-input">Phone number<input type="tel" autoComplete="tel" maxLength={30} value={contact.phone} onChange={e=>setContact({...contact,phone:e.target.value})} placeholder="Enter your phone number"/></label><label className="tp-input tp-wide">Residential address<textarea rows={3} maxLength={500} value={contact.address} onChange={e=>setContact({...contact,address:e.target.value})} placeholder="Enter your current address"/></label></div><div className="tp-footer"><span>Employee ID, name, date of birth and gender are managed by the school.</span><button className="tp-primary" disabled={saving||!teacher} type="submit">{saving?'Saving…':'Save contact details'}</button></div></form>}
        {tab==='employment' && <div className="tp-content"><div className="tp-section-title"><h3>Employment & qualifications</h3><p>Official staff details from your school record.</p></div><div className="tp-fields"><Field label="Employee ID" value={teacher?.employeeId}/><Field label="Designation" value={teacher?.designation}/><Field label="Department" value={teacher?.department}/><Field label="Qualification" value={teacher?.qualification}/><Field label="Specialization / subject" value={teacher?.specialization}/><Field label="Joining date" value={dateLabel(teacher?.joiningDate)}/><Field label="School name" value={school?.name}/><Field label="School code" value={school?.code}/><Field label="School address" value={school?.address}/><Field label="Staff profile created" value={dateLabel(teacher?.createdAt)}/></div><div className="tp-note"><ShieldCheck size={17}/><span>For changes to employee ID, designation, qualification or employment dates, contact the principal or school administrator.</span></div></div>}
        {tab==='emergency' && <form className="tp-content" onSubmit={saveContact}><div className="tp-section-title"><h3>Emergency contact</h3><p>Keep a trusted contact available for urgent school matters.</p></div><div className="tp-fields"><label className="tp-input">Contact name<input maxLength={100} value={contact.emergencyContact.name} onChange={e=>setContact({...contact,emergencyContact:{...contact.emergencyContact,name:e.target.value}})} placeholder="Full name"/></label><label className="tp-input">Contact phone<input type="tel" maxLength={30} value={contact.emergencyContact.phone} onChange={e=>setContact({...contact,emergencyContact:{...contact.emergencyContact,phone:e.target.value}})} placeholder="Phone number"/></label><label className="tp-input">Relationship<input maxLength={60} value={contact.emergencyContact.relation} onChange={e=>setContact({...contact,emergencyContact:{...contact.emergencyContact,relation:e.target.value}})} placeholder="e.g. Spouse, parent"/></label></div><div className="tp-footer"><span>Only your saved emergency contact is displayed.</span><button className="tp-primary" disabled={saving||!teacher} type="submit">{saving?'Saving…':'Save emergency contact'}</button></div></form>}
        {tab==='security' && <form className="tp-content" onSubmit={saveAccount}><div className="tp-section-title"><h3>Account & security</h3><p>Update your login email or change your password.</p></div><div className="tp-security"><LockKeyhole size={19}/><div><strong>Protected account</strong><span>Changing your password requires your current password. Your password is never displayed.</span></div></div><div className="tp-fields"><label className="tp-input tp-wide">Login email<input type="email" required maxLength={254} autoComplete="email" value={account.email} onChange={e=>setAccount({...account,email:e.target.value})}/></label><label className="tp-input">Current password<input type="password" autoComplete="current-password" value={account.currentPassword} onChange={e=>setAccount({...account,currentPassword:e.target.value})} placeholder="Required to change password"/></label><label className="tp-input">New password<input type="password" minLength={8} autoComplete="new-password" value={account.newPassword} onChange={e=>setAccount({...account,newPassword:e.target.value})} placeholder="At least 8 characters"/></label><Field label="Account role" value="Teacher"/><Field label="Account status" value={user?.active===false?'Inactive':'Active'}/><Field label="School" value={school?.name}/></div><div className="tp-footer"><span>Use a unique password and keep your login credentials private.</span><button className="tp-primary" disabled={saving} type="submit">{saving?'Saving…':'Save account settings'}</button></div></form>}
      </section>
      <aside className="tp-side"><section className="tp-card tp-help"><span className="tp-eyebrow">STAFF SUPPORT</span><div className="tp-help-icon"><ShieldCheck size={20}/></div><h3>Need to correct an official detail?</h3><p>Contact the principal or school office to update your employee ID, designation, qualifications or employment records.</p></section><section className="tp-card tp-school"><span className="tp-eyebrow">YOUR SCHOOL</span><h3>{school?.name || 'School details'}</h3><p><MapPin size={15}/>{show(school?.address)}</p><p><IdCard size={15}/>School code: {show(school?.code)}</p><p><Phone size={15}/>Phone: {show(teacher?.phone)}</p></section></aside>
    </div>
  </main>
}
