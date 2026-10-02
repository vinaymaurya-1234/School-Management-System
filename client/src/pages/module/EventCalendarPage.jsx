import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Edit3,
  MapPin,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import apiClient from '../../api/client'
import './EventCalendarPage.css'

const EVENT_TYPES = ['School Event', 'Holiday', 'PTM', 'Exam', 'Meeting', 'Activity']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatInputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function EventCalendarPage() {
  const [events, setEvents] = useState([])
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(getEmptyForm(new Date()))

  const loadEvents = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get('/operations/events')
      setEvents(response?.data?.records || [])
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not load school events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  const calendarDays = useMemo(() => buildCalendarDays(month), [month])
  const monthEvents = useMemo(() => events
    .map(normalizeEvent)
    .filter((event) => event.date && event.date.getFullYear() === month.getFullYear() && event.date.getMonth() === month.getMonth())
    .sort((a, b) => a.date - b.date), [events, month])
  const selectedEvents = useMemo(() => events
    .map(normalizeEvent)
    .filter((event) => sameDay(event.date, selectedDate))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || ''))), [events, selectedDate])

  const openCreate = (date = selectedDate) => {
    setEditingId(null)
    setForm(getEmptyForm(date))
    setModalOpen(true)
    setError('')
  }

  const openEdit = (event) => {
    setEditingId(event.id)
    setForm({
      title: event.title,
      date: formatInputDate(event.date),
      time: event.time || '',
      type: event.type || 'School Event',
      location: event.location || '',
      audience: event.audience || 'Entire school',
      description: event.description || '',
    })
    setModalOpen(true)
    setError('')
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.date) return
    setSaving(true)
    setError('')
    const data = {
      date: form.date,
      time: form.time,
      type: form.type,
      location: form.location,
      audience: form.audience,
      description: form.description,
    }

    try {
      if (editingId) {
        await apiClient.put(`/operations/events/${editingId}`, { title: form.title.trim(), data })
      } else {
        await apiClient.post('/operations/events', { title: form.title.trim(), data })
      }
      setModalOpen(false)
      await loadEvents()
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not save this event.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (event) => {
    if (!window.confirm(`Delete “${event.title}”?`)) return
    try {
      await apiClient.delete(`/operations/events/${event.id}`)
      setEvents((current) => current.filter((record) => (record._id || record.id) !== event.id))
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not delete this event.')
    }
  }

  const shiftMonth = (direction) => {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1)
    setMonth(next)
    setSelectedDate(next)
  }

  const selectDay = (date) => {
    setSelectedDate(date)
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) {
      setMonth(startOfMonth(date))
    }
  }

  return (
    <div className="event-calendar-page">
      <header className="event-page-header">
        <div>
          <span className="event-eyebrow">SCHOOL CALENDAR</span>
          <h1>Events & calendar</h1>
          <p>Plan holidays, PTMs, exams and school activities. Everything added here appears on the principal home screen.</p>
        </div>
        <button className="event-primary-button" type="button" onClick={() => openCreate()}>
          <Plus size={17} /> Add event
        </button>
      </header>

      {error && <div className="event-error"><X size={15} /> {error}</div>}

      <section className="calendar-workspace">
        <div className="calendar-panel">
          <div className="calendar-toolbar">
            <div className="month-control">
              <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ArrowLeft size={16} /></button>
              <h2>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
              <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><ArrowRight size={16} /></button>
            </div>
            <button className="today-button" type="button" onClick={() => { const today = new Date(); setMonth(startOfMonth(today)); setSelectedDate(today) }}>Today</button>
          </div>

          <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {calendarDays.map((date, index) => {
              const dayEvents = events.map(normalizeEvent).filter((event) => sameDay(event.date, date))
              const inMonth = date.getMonth() === month.getMonth()
              return (
                <button
                  type="button"
                  key={`${date.toISOString()}-${index}`}
                  className={`calendar-cell ${inMonth ? '' : 'outside'} ${sameDay(date, selectedDate) ? 'selected' : ''} ${sameDay(date, new Date()) ? 'today' : ''}`}
                  onClick={() => selectDay(date)}
                >
                  <span className="calendar-number">{date.getDate()}</span>
                  <span className="cell-events">
                    {dayEvents.slice(0, 3).map((event) => <span className={`event-dot event-dot-${event.type.toLowerCase().replace(/\s+/g, '-')}`} key={event.id} title={event.title} />)}
                    {dayEvents.length > 3 && <span className="event-more">+{dayEvents.length - 3}</span>}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="calendar-legend">
            <span><i className="legend-dot" /> Event</span>
            <span><i className="legend-ring" /> Today</span>
          </div>
        </div>

        <aside className="agenda-panel">
          <div className="agenda-header">
            <div><span>AGENDA</span><h2>{selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h2></div>
            <button type="button" className="agenda-add" onClick={() => openCreate(selectedDate)}><Plus size={15} /></button>
          </div>

          {loading ? (
            <div className="agenda-empty"><div className="agenda-loader" /><p>Loading events...</p></div>
          ) : selectedEvents.length ? (
            <div className="agenda-list">
              {selectedEvents.map((event) => (
                <article className="agenda-event" key={event.id}>
                  <div className="agenda-event-marker" />
                  <div className="agenda-event-main">
                    <div className="agenda-event-top"><span>{event.type}</span><b>{event.time || 'All day'}</b></div>
                    <h3>{event.title}</h3>
                    {event.description && <p>{event.description}</p>}
                    <div className="agenda-meta">
                      {event.location && <span><MapPin size={12} /> {event.location}</span>}
                      {event.audience && <span>{event.audience}</span>}
                    </div>
                    <div className="agenda-actions">
                      <button type="button" onClick={() => openEdit(event)}><Edit3 size={12} /> Edit</button>
                      <button type="button" className="delete" onClick={() => handleDelete(event)}><Trash2 size={12} /> Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="agenda-empty">
              <span className="agenda-empty-icon"><CalendarDays size={20} /></span>
              <h3>No events</h3>
              <p>This date is clear. Add a PTM, holiday, exam or school activity.</p>
              <button type="button" onClick={() => openCreate(selectedDate)}><Plus size={14} /> Add event</button>
            </div>
          )}
        </aside>
      </section>

      <section className="upcoming-events-panel">
        <div className="upcoming-heading"><div><span>MONTH VIEW</span><h2>Scheduled this month</h2></div><strong>{monthEvents.length} {monthEvents.length === 1 ? 'event' : 'events'}</strong></div>
        {monthEvents.length ? (
          <div className="upcoming-list">
            {monthEvents.map((event) => (
              <button type="button" className="upcoming-row" key={event.id} onClick={() => selectDay(event.date)}>
                <span className="upcoming-date"><b>{event.date.getDate()}</b><small>{event.date.toLocaleDateString('en-IN', { month: 'short' })}</small></span>
                <span className="upcoming-copy"><strong>{event.title}</strong><small>{event.type}{event.time ? ` · ${event.time}` : ''}</small></span>
                <span className="upcoming-status"><Check size={13} /> Scheduled</span>
              </button>
            ))}
          </div>
        ) : <div className="upcoming-empty">No events have been added for this month yet.</div>}
      </section>

      {modalOpen && (
        <div className="event-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}>
          <form className="event-modal" onSubmit={handleSave}>
            <div className="modal-header"><div><span>{editingId ? 'EDIT EVENT' : 'NEW EVENT'}</span><h2>{editingId ? 'Update event' : 'Add an event'}</h2></div><button type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></div>
            <div className="event-form-grid">
              <label className="full"><span>Event name</span><input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Parent Teacher Meeting" required /></label>
              <label><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
              <label><span>Time</span><div className="input-with-icon"><Clock3 size={15} /><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></div></label>
              <label><span>Type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label><span>Audience</span><select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option>Entire school</option><option>Teachers</option><option>Students</option><option>Parents</option><option>Specific classes</option></select></label>
              <label className="full"><span>Location</span><div className="input-with-icon"><MapPin size={15} /><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="e.g. Main Auditorium" /></div></label>
              <label className="full"><span>Description</span><textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add any useful details for staff and parents." /></label>
            </div>
            <div className="modal-footer"><button type="button" className="modal-cancel" onClick={() => setModalOpen(false)}>Cancel</button><button className="modal-save" type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create event'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}

function getEmptyForm(date) {
  return { title: '', date: formatInputDate(date || new Date()), time: '', type: 'School Event', location: '', audience: 'Entire school', description: '' }
}

function normalizeEvent(record) {
  const data = record.data || {}
  return {
    id: record._id || record.id,
    title: record.title || 'Untitled event',
    date: parseDate(data.date || data.startDate || data.eventDate),
    time: data.time || data.startTime || '',
    type: data.type || data.category || 'School Event',
    location: data.location || '',
    audience: data.audience || '',
    description: data.description || data.notes || '',
  }
}

function buildCalendarDays(month) {
  const first = startOfMonth(month)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export default EventCalendarPage
