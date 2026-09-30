// ------------------------------------------------------------
// Page Content Management (Phase B.3)
//
// ONE generic admin page for the DB-backed informational pages
// (About / Academics / Campus) built on the EXISTING page section
// editor pattern — no per-page management architecture was
// invented. Each section is an independent card (own load/save,
// own visibility checkbox) exactly like HomepageManagement.
//
// Section visibility: the "Section visible" checkbox maps to
// is_active — an inactive section is hidden on the public page
// (it renders without that band, never an error).
//
// Source-of-truth guards surfaced in the UI copy:
//   • Campus gallery GRID data stays in the Gallery module
//     (gallery_items) — this editor manages the gallery band's
//     heading copy only.
//   • Head/teacher messages stay in Leadership Management.
//   • School-wide identity/contact stays in Site Settings;
//     {{identity.*}} tokens keep following it.
// ------------------------------------------------------------

import SectionEditor from '../components/SectionEditor';
import ImageUploader from '../components/ImageUploader';

const PAGE_TITLES = {
  about: 'About Page',
  academics: 'Academics Page',
  campus: 'Campus Page',
};

/** Single-image editor for the overview bands (image + alt). */
function SingleImageField({ values, set, label = 'Band Image' }) {
  return (
    <ImageUploader
      label={label}
      value={values.image || ''}
      onChange={(v) => set('image', v)}
    />
  );
}

/** Alt text field paired with the single band image. */
function ImageAltField({ values, set }) {
  return (
    <div>
      <label htmlFor="band-image-alt" className="block text-sm font-medium text-charcoal-700">
        Image Alt Text<span className="ml-1 text-red-500" aria-hidden="true">*</span>
      </label>
      <input
        id="band-image-alt"
        type="text"
        maxLength={500}
        className="mt-1 w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent"
        value={values.imageAlt ?? ''}
        onChange={(e) => set('imageAlt', e.target.value)}
      />
    </div>
  );
}

function PageContentManagement({ page, onUnauthorized }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-forest-700">{PAGE_TITLES[page]}</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          Edit the public page content. Changes appear on the next public page load. Image fields use
          the secure uploader (existing stored paths keep working).
        </p>
      </div>

      <div className="space-y-4">
        {page === 'about' && (
          <>
            <SectionEditor
              page="about"
              sectionKey="intro"
              title="Introduction (Our Story)"
              description="Story heading, two paragraphs and the band image."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, TextField: TF, TextAreaField: TA }) => (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TF id="about-intro-eyebrow" label="Eyebrow (badge)" maxLength={100}
                      value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                    <TF id="about-intro-title" label="Title" required maxLength={200}
                      value={values.title} onChange={(v) => set('title', v)} />
                    <TA id="about-intro-p1" label="Paragraph 1" maxLength={1000} rows={3}
                      value={values.paragraph1} onChange={(v) => set('paragraph1', v)} required />
                    <TA id="about-intro-p2" label="Paragraph 2" maxLength={1000} rows={3}
                      value={values.paragraph2} onChange={(v) => set('paragraph2', v)} />
                    <SingleImageField values={values} set={set} />
                    <ImageAltField values={values} set={set} />
                  </div>
                </>
              )}
            </SectionEditor>

            <SectionEditor
              page="about"
              sectionKey="coreValues"
              title="Core Values"
              description="Section heading and the value cards (max 8)."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, ArrayEditor: Arr, TextField: TF, TextAreaField: TA }) => (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TF id="about-cv-eyebrow" label="Eyebrow (badge)" maxLength={100}
                      value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                    <TF id="about-cv-title" label="Title" required maxLength={200}
                      value={values.title} onChange={(v) => set('title', v)} />
                    <TA id="about-cv-description" label="Description" maxLength={1000}
                      value={values.description} onChange={(v) => set('description', v)} />
                  </div>
                  <Arr
                    title="Values"
                    itemNoun="value"
                    items={values.values || []}
                    onChange={(next) => set('values', next)}
                    maxItems={8}
                    newItem={{ title: '', description: '', icon: '⭐' }}
                    preview={(item) => (
                      <p className="truncate text-sm font-medium text-charcoal-700">{item.title}</p>
                    )}
                    fields={[
                      { name: 'title', label: 'Title', maxLength: 200, required: true },
                      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
                      { name: 'icon', label: 'Icon (emoji)', maxLength: 8 },
                    ]}
                  />
                </>
              )}
            </SectionEditor>

            <SectionEditor
              page="about"
              sectionKey="visionMission"
              title="Vision & Mission"
              description="The two statement cards."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, TextAreaField: TA }) => (
                <div className="mt-4 grid gap-4">
                  <TA id="about-vm-vision" label="Vision statement" maxLength={1000} rows={3}
                    value={values.vision} onChange={(v) => set('vision', v)} required />
                  <TA id="about-vm-mission" label="Mission statement" maxLength={1000} rows={3}
                    value={values.mission} onChange={(v) => set('mission', v)} required />
                </div>
              )}
            </SectionEditor>
          </>
        )}

        {page === 'academics' && (
          <>
            <SectionEditor
              page="academics"
              sectionKey="overview"
              title="Curriculum Overview"
              description="Academic approach heading, two paragraphs and the band image."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, TextField: TF, TextAreaField: TA }) => (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <TF id="acad-overview-eyebrow" label="Eyebrow (badge)" maxLength={100}
                    value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                  <TF id="acad-overview-title" label="Title" required maxLength={200}
                    value={values.title} onChange={(v) => set('title', v)} />
                  <TA id="acad-overview-p1" label="Paragraph 1" maxLength={1000} rows={3}
                    value={values.paragraph1} onChange={(v) => set('paragraph1', v)} required />
                  <TA id="acad-overview-p2" label="Paragraph 2" maxLength={1000} rows={3}
                    value={values.paragraph2} onChange={(v) => set('paragraph2', v)} />
                  <SingleImageField values={values} set={set} />
                  <ImageAltField values={values} set={set} />
                </div>
              )}
            </SectionEditor>

            <SectionEditor
              page="academics"
              sectionKey="programs"
              title="Academic Programs"
              description="Section heading and the program level cards (max 8)."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, ArrayEditor: Arr, TextField: TF, TextAreaField: TA }) => (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TF id="acad-programs-eyebrow" label="Eyebrow (badge)" maxLength={100}
                      value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                    <TF id="acad-programs-title" label="Title" required maxLength={200}
                      value={values.title} onChange={(v) => set('title', v)} />
                    <TA id="acad-programs-description" label="Description" maxLength={1000}
                      value={values.description} onChange={(v) => set('description', v)} />
                  </div>
                  <Arr
                    title="Programs"
                    itemNoun="program"
                    items={values.programs || []}
                    onChange={(next) => set('programs', next)}
                    maxItems={8}
                    newItem={{ title: '', subtitle: '', description: '', icon: '📚' }}
                    preview={(item) => (
                      <p className="truncate text-sm font-medium text-charcoal-700">{item.title}</p>
                    )}
                    fields={[
                      { name: 'title', label: 'Level', maxLength: 200, required: true },
                      { name: 'subtitle', label: 'Grades line', maxLength: 500 },
                      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
                      { name: 'icon', label: 'Icon (emoji)', maxLength: 8 },
                    ]}
                  />
                </>
              )}
            </SectionEditor>

            <SectionEditor
              page="academics"
              sectionKey="environment"
              title="Learning Environment"
              description="Section heading and the highlight cards (max 8)."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, ArrayEditor: Arr, TextField: TF, TextAreaField: TA }) => (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TF id="acad-env-eyebrow" label="Eyebrow (badge)" maxLength={100}
                      value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                    <TF id="acad-env-title" label="Title" required maxLength={200}
                      value={values.title} onChange={(v) => set('title', v)} />
                    <TA id="acad-env-description" label="Description" maxLength={1000}
                      value={values.description} onChange={(v) => set('description', v)} />
                  </div>
                  <Arr
                    title="Highlights"
                    itemNoun="highlight"
                    items={values.items || []}
                    onChange={(next) => set('items', next)}
                    maxItems={8}
                    newItem={{ title: '', description: '', icon: '💻' }}
                    preview={(item) => (
                      <p className="truncate text-sm font-medium text-charcoal-700">{item.title}</p>
                    )}
                    fields={[
                      { name: 'title', label: 'Title', maxLength: 200, required: true },
                      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
                      { name: 'icon', label: 'Icon (emoji)', maxLength: 8 },
                    ]}
                  />
                </>
              )}
            </SectionEditor>

            <SectionEditor
              page="academics"
              sectionKey="academicsCta"
              title="Academics CTA"
              description="The bottom call-to-action band. This page's own CTA — distinct from the shared reusable Admissions CTA block."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, TextField: TF }) => (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <TF id="acad-cta-title" label="Title" required maxLength={200}
                    value={values.title} onChange={(v) => set('title', v)} />
                  <TF id="acad-cta-description" label="Description" maxLength={1000}
                    value={values.description} onChange={(v) => set('description', v)} />
                  <TF id="acad-cta-buttonText" label="Button Text" required maxLength={100}
                    value={values.buttonText} onChange={(v) => set('buttonText', v)} />
                  <TF id="acad-cta-buttonLink" label="Button Link" maxLength={500}
                    value={values.buttonLink} onChange={(v) => set('buttonLink', v)}
                    placeholder="/contact or https://…" />
                </div>
              )}
            </SectionEditor>
          </>
        )}

        {page === 'campus' && (
          <>
            <SectionEditor
              page="campus"
              sectionKey="overview"
              title="Campus Overview"
              description="Overview heading, two paragraphs and the band image."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, TextField: TF, TextAreaField: TA }) => (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <TF id="campus-overview-eyebrow" label="Eyebrow (badge)" maxLength={100}
                    value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                  <TF id="campus-overview-title" label="Title" required maxLength={200}
                    value={values.title} onChange={(v) => set('title', v)} />
                  <TA id="campus-overview-p1" label="Paragraph 1" maxLength={1000} rows={3}
                    value={values.paragraph1} onChange={(v) => set('paragraph1', v)} required />
                  <TA id="campus-overview-p2" label="Paragraph 2" maxLength={1000} rows={3}
                    value={values.paragraph2} onChange={(v) => set('paragraph2', v)} />
                  <SingleImageField values={values} set={set} />
                  <ImageAltField values={values} set={set} />
                </div>
              )}
            </SectionEditor>

            <SectionEditor
              page="campus"
              sectionKey="facilities"
              title="Facilities"
              description="Section heading and the facility cards (max 12)."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, ArrayEditor: Arr, TextField: TF, TextAreaField: TA }) => (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TF id="campus-fac-eyebrow" label="Eyebrow (badge)" maxLength={100}
                      value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                    <TF id="campus-fac-title" label="Title" required maxLength={200}
                      value={values.title} onChange={(v) => set('title', v)} />
                    <TA id="campus-fac-description" label="Description" maxLength={1000}
                      value={values.description} onChange={(v) => set('description', v)} />
                  </div>
                  <Arr
                    title="Facilities"
                    itemNoun="facility"
                    items={values.facilities || []}
                    onChange={(next) => set('facilities', next)}
                    maxItems={12}
                    newItem={{ title: '', description: '', icon: '🏫' }}
                    preview={(item) => (
                      <p className="truncate text-sm font-medium text-charcoal-700">{item.title}</p>
                    )}
                    fields={[
                      { name: 'title', label: 'Title', maxLength: 200, required: true },
                      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
                      { name: 'icon', label: 'Icon (emoji)', maxLength: 8 },
                    ]}
                  />
                </>
              )}
            </SectionEditor>

            <SectionEditor
              page="campus"
              sectionKey="galleryHighlight"
              title="Campus Gallery (heading only)"
              description="Heading copy for the gallery band. The PHOTOS are managed in the Gallery module (published items appear here automatically) — do not duplicate them here."
              onUnauthorized={onUnauthorized}
            >
              {({ values, set, TextField: TF, TextAreaField: TA }) => (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <TF id="campus-gal-eyebrow" label="Eyebrow (badge)" maxLength={100}
                    value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                  <TF id="campus-gal-title" label="Title" required maxLength={200}
                    value={values.title} onChange={(v) => set('title', v)} />
                  <TA id="campus-gal-description" label="Description" maxLength={1000}
                    value={values.description} onChange={(v) => set('description', v)} />
                </div>
              )}
            </SectionEditor>
          </>
        )}
      </div>
    </div>
  );
}

export default PageContentManagement;
