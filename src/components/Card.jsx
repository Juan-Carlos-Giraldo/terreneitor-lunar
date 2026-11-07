export default function Card({ title, children, className = "" }) {
  return (
    <section className={`card ${className}`.trim()}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
