import { useState } from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { SectionWrapper } from '../Components/ui/SectionWrapper';
import Button from '../Components/ui/Button';

function ContactHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/799202494_1523030196506157_181619563109164848_n.jpg"
          alt="Contact Green Leaf International School"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          Contact
        </span>
        <h1 className="font-heading text-display text-white mb-4">Get in Touch</h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          We&apos;d love to hear from you. Reach out with any questions about admissions,
          programs, or campus life.
        </p>
      </div>
    </section>
  );
}

const contactDetails = [
  {
    label: 'Address',
    value: '[School Address]',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    label: 'Phone',
    value: '[Official Phone Number]',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
  },
  {
    label: 'Email',
    value: '[Official Email]',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    label: 'Office Hours',
    value: 'Sun — Thu: 8:00 AM — 4:00 PM',
    sub: 'Fri — Sat: Closed',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const socialLinks = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/greenleafinternationalschoolandcollege/',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@greenleafinternationalscho29/videos',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

function Contact() {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', subject: '', message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const infoRef = useScrollReveal();
  const formRef = useScrollReveal();

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Please enter a valid email';
    if (!formData.subject.trim()) errs.subject = 'Subject is required';
    if (!formData.message.trim()) errs.message = 'Message is required';
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitted(true);
  };

  return (
    <>
      <ContactHero />

      <SectionWrapper bg="bg-white" padding="py-section">
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
          {/* Contact Details + Social */}
          <div ref={infoRef} className="lg:col-span-2 reveal">
            {/* School identity */}
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.jpg" alt="Green Leaf Logo" className="w-10 h-10 rounded-lg object-cover shadow-sm" />
              <div>
                <span className="block text-[13px] font-bold text-charcoal-900 leading-tight">Green Leaf</span>
                <span className="block text-[9px] text-charcoal-400 tracking-[0.12em] uppercase font-medium">International School &amp; College</span>
              </div>
            </div>

            <h2 className="font-heading text-h2 text-charcoal-900 mb-6">
              Contact Information
            </h2>

            <div className="space-y-5">
              {contactDetails.map((detail) => (
                <div key={detail.label} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-forest-50 rounded-xl flex items-center justify-center shrink-0 text-forest-600">
                    {detail.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-charcoal-800 text-body-sm mb-0.5">{detail.label}</h4>
                    <p className="text-body-sm text-charcoal-500">{detail.value}</p>
                    {detail.sub && <p className="text-body-sm text-charcoal-500">{detail.sub}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Social Links */}
            <div className="mt-8">
              <h4 className="text-eyebrow font-semibold text-charcoal-400 uppercase tracking-[0.1em] mb-3">
                Follow Us
              </h4>
              <div className="flex gap-2">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-charcoal-100 text-charcoal-500 transition-all duration-250 ease-premium hover:bg-forest-600 hover:text-white hover:scale-105"
                    aria-label={social.label}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div ref={formRef} className="lg:col-span-3 reveal">
            {submitted ? (
              <div className="bg-cream-50 rounded-2xl p-10 border border-charcoal-100/60 text-center">
                <div className="w-16 h-16 bg-forest-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg className="w-8 h-8 text-forest-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-heading text-h3 text-charcoal-900 mb-2">Message Sent!</h3>
                <p className="text-charcoal-500 text-body-sm mb-6">
                  Thank you for reaching out. We&apos;ll get back to you soon.<br />
                  <span className="text-charcoal-400 italic text-caption">(This is a placeholder — actual submission will be connected in Phase 8)</span>
                </p>
                <Button variant="secondary" size="sm" onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', phone: '', subject: '', message: '' }); }}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-cream-50 rounded-2xl p-8 border border-charcoal-100/60">
                <h2 className="font-heading text-h2 text-charcoal-900 mb-6">
                  Send Us a Message
                </h2>

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="name" className="block text-body-sm font-medium text-charcoal-700 mb-1.5">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 border rounded-lg bg-white text-charcoal-900 text-body-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-500 ${errors.name ? 'border-red-300' : 'border-charcoal-200'}`}
                      placeholder="Your full name"
                    />
                    {errors.name && <p className="text-caption text-red-500 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-body-sm font-medium text-charcoal-700 mb-1.5">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 border rounded-lg bg-white text-charcoal-900 text-body-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-500 ${errors.email ? 'border-red-300' : 'border-charcoal-200'}`}
                      placeholder="your@email.com"
                    />
                    {errors.email && <p className="text-caption text-red-500 mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="phone" className="block text-body-sm font-medium text-charcoal-700 mb-1.5">Phone</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-charcoal-200 rounded-lg bg-white text-charcoal-900 text-body-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-500"
                      placeholder="+880 XXXX-XXXXXX"
                    />
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-body-sm font-medium text-charcoal-700 mb-1.5">
                      Subject <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 border rounded-lg bg-white text-charcoal-900 text-body-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-500 ${errors.subject ? 'border-red-300' : 'border-charcoal-200'}`}
                      placeholder="How can we help?"
                    />
                    {errors.subject && <p className="text-caption text-red-500 mt-1">{errors.subject}</p>}
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="message" className="block text-body-sm font-medium text-charcoal-700 mb-1.5">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    className={`w-full px-4 py-2.5 border rounded-lg bg-white text-charcoal-900 text-body-sm resize-none transition-all duration-200 outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-500 ${errors.message ? 'border-red-300' : 'border-charcoal-200'}`}
                    placeholder="Tell us more..."
                  />
                  {errors.message && <p className="text-caption text-red-500 mt-1">{errors.message}</p>}
                </div>

                <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto">
                  Send Message
                </Button>

                <p className="mt-3 text-caption text-charcoal-400 italic">
                  Form submission will be connected to the backend API in Phase 8.
                </p>
              </form>
            )}
          </div>
        </div>
      </SectionWrapper>

      {/* Map Placeholder */}
      <section className="bg-charcoal-100 h-72 md:h-80 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-charcoal-200 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-charcoal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
          </div>
          <p className="text-body-sm text-charcoal-500">Map integration will be added in a future phase.</p>
        </div>
      </section>
    </>
  );
}

export default Contact;
