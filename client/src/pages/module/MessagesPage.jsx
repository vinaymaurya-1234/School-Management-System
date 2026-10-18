import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import {
  Search, Plus, Send, Paperclip, Image as ImageIcon, FileText, Video,
  Users, MessageCircle, MoreVertical, ArrowLeft, X, CheckCheck, LoaderCircle,
  ShieldCheck, CircleUserRound, Download, MessagesSquare,
} from 'lucide-react'
import apiClient from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './MessagesPage.css'

const roleTabs = [
  { label: 'All', value: '' },
  { label: 'Teachers', value: 'teacher' },
  { label: 'Students', value: 'student' },
  { label: 'Parents', value: 'parent' },
  { label: 'Principal', value: 'principal' },
]
const roleLabel = (role) => ({ principal: 'Principal', teacher: 'Teacher', student: 'Student', parent: 'Parent' }[role] || role || 'School member')
const socketBase = () => (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')

function Avatar({ user, group = false }) {
  return <span className={`chat-avatar ${group ? 'group-avatar' : ''}`}>{group ? <Users size={19} /> : (user?.name || '?').trim().charAt(0).toUpperCase()}</span>
}
function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString() === new Date().toLocaleDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: 'short' })
}
function formatSize(bytes) {
  if (!bytes) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function MessagesPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [people, setPeople] = useState([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState([])
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [personSearch, setPersonSearch] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newMode, setNewMode] = useState('direct')
  const [groupTitle, setGroupTitle] = useState('')
  const [groupType, setGroupType] = useState('custom')
  const [selectedPeople, setSelectedPeople] = useState([])
  const [error, setError] = useState('')
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const socketRef = useRef(null)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeId) || null, [conversations, activeId])
  const activePerson = activeConversation?.otherParticipant
  const visibleConversations = useMemo(() => conversations.filter((item) => {
    const title = item.type === 'group' ? item.title : item.otherParticipant?.name
    const matchesSearch = `${title || ''} ${item.lastMessagePreview || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = !filter || (item.type === 'group' ? filter === 'group' : item.otherParticipant?.role === filter)
    return matchesSearch && matchesFilter
  }), [conversations, search, filter])
  const visiblePeople = useMemo(() => people.filter((person) => {
    const matches = `${person.name} ${person.role}`.toLowerCase().includes(personSearch.toLowerCase())
    return matches && (newMode === 'group' || !selectedPeople.includes(person.id)) && !(newMode === 'group' && groupType === 'teachers' && person.role !== 'teacher')
  }), [people, personSearch, newMode, selectedPeople])

  const loadConversations = useCallback(async (preferId = '') => {
    const response = await apiClient.get('/chat/conversations')
    const rows = response.data.conversations || []
    setConversations(rows)
    const desired = preferId || activeId
    if (desired && rows.some((row) => row.id === desired)) setActiveId(desired)
    else if (!activeId && rows.length) setActiveId(rows[0].id)
    return rows
  }, [activeId])

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) { setMessages([]); return }
    const response = await apiClient.get(`/chat/conversations/${conversationId}/messages`)
    setMessages(response.data.messages || [])
    await apiClient.post(`/chat/conversations/${conversationId}/read`).catch(() => {})
    setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item))
  }, [])

  const loadPeople = useCallback(async (role = '') => {
    const response = await apiClient.get('/chat/users', { params: { role: role || undefined } })
    setPeople(response.data.users || [])
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([loadConversations(), loadPeople()])
      .catch((requestError) => { if (alive) setError(requestError.response?.data?.message || 'Could not load chats. Please try again.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, []) // Initial load only.

  useEffect(() => {
    const token = localStorage.getItem('school-management-token')
    if (!token) return undefined
    const socket = io(socketBase(), { auth: { token }, transports: ['websocket', 'polling'] })
    socketRef.current = socket
    socket.on('message:new', (message) => {
      setMessages((current) => {
        if (message.conversationId !== activeId || current.some((item) => item.id === message.id)) return current
        return [...current, message]
      })
      setConversations((current) => current.map((item) => {
        if (item.id !== message.conversationId) return item
        return { ...item, lastMessageAt: message.createdAt, lastMessagePreview: message.text || message.attachments?.[0]?.name || 'Attachment', unreadCount: message.sender?.id === user?.id || message.sender === user?.id ? item.unreadCount : item.unreadCount + (message.conversationId === activeId ? 0 : 1) }
      }).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)))
    })
    return () => { socket.disconnect(); socketRef.current = null }
  }, [activeId, user?.id])

  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    socketRef.current?.emit('conversation:join', activeId)
    loadMessages(activeId).catch((requestError) => setError(requestError.response?.data?.message || 'Could not load messages.'))
    return () => socketRef.current?.emit('conversation:leave', activeId)
  }, [activeId, loadMessages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])

  const openConversation = (id) => {
    setActiveId(id)
    setMobileChatOpen(true)
    setError('')
  }

  const startDirect = async (personId) => {
    try {
      const response = await apiClient.post('/chat/conversations/direct', { recipientId: personId })
      await loadConversations(response.data.conversation.id)
      setActiveId(response.data.conversation.id)
      setShowNew(false)
      setMobileChatOpen(true)
      setPersonSearch('')
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not start conversation.')
    }
  }

  const createGroup = async () => {
    if (!groupTitle.trim() || selectedPeople.length < 1) {
      setError('Enter a group name and choose at least one member.')
      return
    }
    try {
      const response = await apiClient.post('/chat/conversations/group', { title: groupTitle.trim(), groupType, participantIds: selectedPeople })
      await loadConversations(response.data.conversation.id)
      setActiveId(response.data.conversation.id)
      setShowNew(false)
      setMobileChatOpen(true)
      setGroupTitle('')
      setSelectedPeople([])
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create group.')
    }
  }

  const sendMessage = async (event) => {
    event?.preventDefault()
    if ((!text.trim() && !pendingAttachments.length) || !activeId || sending) return
    setSending(true)
    setError('')
    try {
      const response = await apiClient.post(`/chat/conversations/${activeId}/messages`, { text: text.trim(), attachments: pendingAttachments })
      const message = response.data.message
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      setText('')
      setPendingAttachments([])
      await loadConversations(activeId)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Message could not be sent.')
    } finally { setSending(false) }
  }

  const [pendingAttachments, setPendingAttachments] = useState([])
  const uploadFile = async (file) => {
    if (!file) return
    if (file.size > 30 * 1024 * 1024) { setError('Each file must be 30 MB or smaller.'); return }
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await apiClient.post('/chat/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPendingAttachments((current) => [...current, response.data.attachment].slice(0, 5))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Upload failed. Check file sharing setup.')
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const togglePerson = (id) => setSelectedPeople((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const selectedLabel = activeConversation?.type === 'group' ? activeConversation.title : activePerson?.name || 'Select a conversation'

  return (
    <section className="messages-page">
      <header className="messages-heading">
        <div><span className="messages-eyebrow">SCHOOL COMMUNICATION</span><h1>Messages</h1><p>Chat with authorized parents, teachers, students and principal.</p></div>
        <button className="messages-primary-button" type="button" onClick={() => { setShowNew(true); setNewMode('direct'); setError(''); loadPeople().catch(() => {}) }}><Plus size={18} /> New chat</button>
      </header>

      {error && <div className="messages-error" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}

      <div className={`messages-workspace ${mobileChatOpen ? 'mobile-chat-open' : ''}`}>
        <aside className="messages-inbox">
          <div className="messages-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></div>
          <div className="messages-filter-row">
            {roleTabs.filter((tab) => tab.value !== 'principal' || user?.role !== 'principal').map((tab) => <button key={tab.value || 'all'} className={filter === tab.value ? 'active' : ''} onClick={() => setFilter(tab.value)} type="button">{tab.label}</button>)}
            <button className={filter === 'group' ? 'active' : ''} onClick={() => setFilter(filter === 'group' ? '' : 'group')} type="button">Groups</button>
          </div>
          <div className="messages-list-heading"><span>Recent conversations</span><span>{visibleConversations.length}</span></div>
          <div className="messages-conversation-list">
            {loading ? <div className="messages-empty"><LoaderCircle className="spin" size={24} /><span>Loading conversations…</span></div> : visibleConversations.length ? visibleConversations.map((item) => {
              const title = item.type === 'group' ? item.title : item.otherParticipant?.name || 'School member'
              const role = item.type === 'group' ? `${item.participants?.length || 0} members` : roleLabel(item.otherParticipant?.role)
              return <button key={item.id} type="button" className={`messages-conversation ${activeId === item.id ? 'active' : ''}`} onClick={() => openConversation(item.id)}>
                <Avatar user={item.otherParticipant} group={item.type === 'group'} />
                <span className="messages-conversation-copy"><strong>{title}</strong><small>{role}</small><span>{item.lastMessagePreview || 'Start a conversation'}</span></span>
                <span className="messages-conversation-meta"><small>{formatTime(item.lastMessageAt)}</small>{item.unreadCount > 0 && <b>{item.unreadCount}</b>}</span>
              </button>
            }) : <div className="messages-empty"><MessageCircle size={26} /><strong>No conversations yet</strong><span>Start a new chat to get connected.</span><button type="button" onClick={() => setShowNew(true)}>Start a chat</button></div>}
          </div>
          <div className="messages-privacy-note"><ShieldCheck size={16} /><span>Only authorized school contacts can chat with you.</span></div>
        </aside>

        <main className="messages-chat-panel">
          {activeConversation ? <>
            <header className="messages-chat-header">
              <button type="button" className="messages-back-button" onClick={() => setMobileChatOpen(false)} aria-label="Back to conversations"><ArrowLeft size={20} /></button>
              <Avatar user={activePerson} group={activeConversation.type === 'group'} />
              <div className="messages-chat-title"><strong>{selectedLabel}</strong><span>{activeConversation.type === 'group' ? `${activeConversation.participants?.length || 0} members · ${activeConversation.groupType} group` : roleLabel(activePerson?.role)}</span></div>
              <button type="button" className="messages-icon-button" title="Conversation details" onClick={() => setError(activeConversation.type === 'group' ? `Members: ${activeConversation.participants.map((person) => person.name).join(', ')}` : `School contact: ${roleLabel(activePerson?.role)}`)}><MoreVertical size={20} /></button>
            </header>
            <div className="messages-thread">
              <div className="messages-thread-security"><ShieldCheck size={14} /> School account conversation</div>
              {messages.map((message) => {
                const senderId = typeof message.sender === 'string' ? message.sender : message.sender?.id
                const mine = senderId === user?.id
                return <div key={message.id} className={`messages-message-row ${mine ? 'mine' : ''}`}>
                  {!mine && <Avatar user={typeof message.sender === 'object' ? message.sender : null} />}
                  <div className="messages-message-content">
                    {!mine && activeConversation.type === 'group' && <small className="messages-sender-name">{message.sender?.name || 'Member'}</small>}
                    <div className="messages-bubble">
                      {message.text && <p>{message.text}</p>}
                      {message.attachments?.map((file, index) => <a className="messages-attachment" key={`${message.id}-${index}`} href={file.url} target="_blank" rel="noreferrer">
                        {file.mimeType?.startsWith('image/') ? <ImageIcon size={20} /> : file.mimeType?.startsWith('video/') ? <Video size={20} /> : <FileText size={20} />}
                        <span><strong>{file.name}</strong><small>{file.mimeType?.split('/').pop()?.toUpperCase()} · {formatSize(file.size)}</small></span><Download size={16} />
                      </a>)}
                    </div>
                    <span className="messages-message-time">{formatTime(message.createdAt)} {mine && <CheckCheck size={14} />}</span>
                  </div>
                </div>
              })}
              {messages.length === 0 && <div className="messages-thread-empty"><MessagesSquare size={34} /><strong>Start the conversation</strong><span>Send a message, photo, video or PDF.</span></div>}
              <div ref={bottomRef} />
            </div>
            {pendingAttachments.length > 0 && <div className="messages-pending-files">{pendingAttachments.map((file) => <div key={file.publicId}><FileText size={16} /><span>{file.name}</span><button type="button" onClick={() => setPendingAttachments((current) => current.filter((item) => item.publicId !== file.publicId))} aria-label={`Remove ${file.name}`}><X size={15} /></button></div>)}</div>}
            <form className="messages-composer" onSubmit={sendMessage}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf" hidden onChange={(event) => uploadFile(event.target.files?.[0])} />
              <button className="messages-icon-button" type="button" title="Attach image, video or PDF" disabled={uploading || pendingAttachments.length >= 5} onClick={() => fileRef.current?.click()}>{uploading ? <LoaderCircle className="spin" size={20} /> : <Paperclip size={20} />}</button>
              <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a message…" maxLength={5000} aria-label="Message text" />
              <span className="messages-attachment-hint"><ImageIcon size={14} /><Video size={14} /><FileText size={14} /></span>
              <button className="messages-send-button" type="submit" disabled={sending || uploading || (!text.trim() && pendingAttachments.length === 0)} aria-label="Send message">{sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button>
            </form>
            <div className="messages-composer-footnote">Images, videos and PDFs · Up to 30 MB per file · Maximum 5 attachments per message</div>
          </> : <div className="messages-welcome"><span className="messages-welcome-icon"><MessagesSquare size={34} /></span><h2>Your school conversations, in one place</h2><p>Choose a conversation or start a new chat with an authorized school contact.</p><button className="messages-primary-button" type="button" onClick={() => { setShowNew(true); setNewMode('direct') }}><Plus size={18} /> Start a conversation</button></div>}
        </main>
      </div>

      {showNew && <div className="messages-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNew(false) }}>
        <section className="messages-modal" role="dialog" aria-modal="true" aria-labelledby="new-chat-title">
          <header><div><span className="messages-eyebrow">NEW CONVERSATION</span><h2 id="new-chat-title">{newMode === 'group' ? 'Create a group' : 'Start a chat'}</h2></div><button className="messages-icon-button" type="button" aria-label="Close" onClick={() => setShowNew(false)}><X size={20} /></button></header>
          <div className="messages-modal-tabs"><button type="button" className={newMode === 'direct' ? 'active' : ''} onClick={() => { setNewMode('direct'); setSelectedPeople([]); setError('') }}>Direct message</button><button type="button" className={newMode === 'group' ? 'active' : ''} onClick={() => { setNewMode('group'); setSelectedPeople([]); setError(''); loadPeople().catch(() => {}) }}>Create group</button></div>
          {newMode === 'group' && <div className="messages-group-fields"><label>Group name<input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="e.g. Class 10-A Parents" maxLength={100} /></label><label>Group type<select value={groupType} onChange={(event) => setGroupType(event.target.value)}><option value="custom">Custom group</option><option value="class">Class group</option><option value="teachers">Teachers group</option><option value="school">School group</option></select></label></div>}
          <div className="messages-search modal-search"><Search size={17} /><input value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} placeholder="Find a school contact" /></div>
          {newMode === 'group' && <p className="messages-selected-count">{selectedPeople.length} member(s) selected · you will be added automatically</p>}
          <div className="messages-people-list">{visiblePeople.map((person) => <button key={person.id} type="button" className={selectedPeople.includes(person.id) ? 'selected' : ''} onClick={() => newMode === 'group' ? togglePerson(person.id) : startDirect(person.id)}><Avatar user={person} /><span><strong>{person.name}</strong><small>{roleLabel(person.role)}</small></span>{newMode === 'group' ? <span className="messages-select-indicator">{selectedPeople.includes(person.id) ? '✓' : '+'}</span> : <MessageCircle size={18} />}</button>)}{visiblePeople.length === 0 && <div className="messages-empty"><CircleUserRound size={24} /><span>No authorized contacts found.</span></div>}</div>
          {newMode === 'group' && <button className="messages-primary-button group-create-button" type="button" onClick={createGroup}><Users size={17} /> Create group</button>}
          <p className="messages-modal-note"><ShieldCheck size={14} /> Only active users from your school can be added.</p>
        </section>
      </div>}
    </section>
  )
}
