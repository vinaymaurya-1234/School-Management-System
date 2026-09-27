function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`section-card ${className}`.trim()}>
      <div className="section-card-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <button type="button" className="text-button">{action}</button>}
      </div>
      {children}
    </section>
  )
}

export default SectionCard
