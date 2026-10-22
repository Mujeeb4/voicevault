export default function Template({ children }: { children: React.ReactNode }) {
  // Re-mounts on every navigation, giving each page a gentle fade-in.
  return <div className="animate-fade-in">{children}</div>;
}
