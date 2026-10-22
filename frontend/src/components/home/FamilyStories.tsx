import { Quote } from 'lucide-react';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { familyStories } from '@/config/marketing';

const isDev = process.env.NODE_ENV !== 'production';

export function FamilyStories() {
  const hasStories = familyStories.length > 0;
  if (!hasStories && !isDev) return null;

  const stories = hasStories
    ? familyStories
    : [{ quote: 'Add a real, consented family story here.', name: 'Name', relation: 'Relation', photo: undefined }];

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-3">Families</p>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">In their own words</h2>
        </div>
        <div className={`mt-10 grid gap-4 ${stories.length > 1 ? 'md:grid-cols-2' : 'mx-auto max-w-2xl'}`}>
          {stories.map((s) => (
            <figure key={s.name + s.quote} className="surface flex flex-col gap-5 p-6 sm:p-8">
              <Quote className="h-6 w-6 text-primary/40" strokeWidth={1.75} />
              <blockquote className="text-lg leading-relaxed text-foreground">{s.quote}</blockquote>
              <figcaption className="mt-auto flex items-center gap-3">
                <PersonAvatar name={s.name} src={s.photo} />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{s.name}</span>
                  <span className="block text-sm text-muted-foreground">{s.relation}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        {!hasStories && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Preview only. Add stories in <code>src/config/marketing.ts</code>. Hidden in production until then.
          </p>
        )}
      </div>
    </section>
  );
}
