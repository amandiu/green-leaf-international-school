import { Link } from "react-router-dom";
import { useSettings } from "../../context/SettingsContext";
import BrandBlock from "../ui/BrandBlock";

const quickLinks = [
  { path: "/about", label: "About Us" },
  { path: "/academics", label: "Academics" },
  { path: "/admissions", label: "Admissions" },
  { path: "/campus", label: "Campus" },
  { path: "/news", label: "News & Events" },
  { path: "/contact", label: "Contact Us" },
];

function Footer() {
  const currentYear = new Date().getFullYear();
  const { settings } = useSettings();
  const { identity, contact, social } = settings;

  const contactInfo = [
    {
      label: contact.address,
      icon: (
        <svg
          className="w-[18px] h-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
          />
        </svg>
      ),
    },
    {
      label: contact.phone,
      icon: (
        <svg
          className="w-[18px] h-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
          />
        </svg>
      ),
    },
    {
      label: contact.email,
      icon: (
        <svg
          className="w-[18px] h-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
      ),
    },
    {
      label: contact.officeHours,
      icon: (
        <svg
          className="w-[18px] h-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  const socialLinks = [
    {
      label: "Facebook",
      href: social.facebook,
      icon: (
        <svg
          className="w-[18px] h-[18px]"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
    {
      label: "YouTube",
      href: social.youtube,
      icon: (
        <svg
          className="w-[18px] h-[18px]"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="bg-black" role="contentinfo">
      {/* ═══ Main Footer Content ═══ */}
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* ── Column 1: School Brand ── */}
          <div className="lg:col-span-4">
            <Link
              to="/"
              className="flex items-center gap-3 mb-5 group"
              aria-label={`${identity.name} — Home`}
            >
              {/* Brand (logo + wordmark) from the central site config */}
              <BrandBlock size="md" theme="dark" />
            </Link>
            <p className="text-[13px] text-white/50 leading-relaxed mb-6 max-w-[280px]">
              {identity.description}
            </p>

            {/* Social Icons — null entries in settings are hidden */}
            <div className="flex gap-3">
              {socialLinks.filter((social) => social.href).map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/40 transition-all duration-300 hover:border-forest-500 hover:bg-forest-600 hover:text-white hover:scale-105"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* ── Column 2: Quick Links ── */}
          <div className="lg:col-span-2 lg:col-start-6">
            <h4 className="text-white font-semibold text-[14px]">
              Quick Links
            </h4>

            <div className="w-[90px] h-[4px] bg-forest-500 rounded-full mb-5" />

            <ul className="">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="group text-[13px] text-white/50 hover:text-white transition-colors duration-200 inline-flex items-center"
                  >
                    {/* Fixed icon area */}
                    <span className="w-5 flex justify-center shrink-0">
                      <span className="text-forest-500 text-[20px] font-extrabold leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        →
                      </span>
                    </span>

                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Column 3: Contact Information ── */}
          <div className="lg:col-span-4 lg:col-start-9">
            <h4 className="text-white font-semibold text-[14px] mb-1">
              Contact Information
            </h4>
            <div className="w-[40%] h-[4px] bg-forest-500 rounded-full mb-5" />
            <ul className="space-y-4">
              {contactInfo.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-forest-500 mt-0.5 shrink-0">
                    {item.icon}
                  </span>
                  <span className="text-[13px] text-white/50 leading-relaxed">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ═══ Divider ═══ */}
      <div className="border-t border-white/[0.08]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-white/30">
            &copy; {currentYear} {identity.name}.
            All rights reserved.
          </p>
          <div className="flex gap-6 text-[12px]">
            <a
              href="#"
              className="text-white/30 hover:text-white/70 transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-white/30 hover:text-white/70 transition-colors duration-200"
            >
              Terms of Use
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
