// CSS class utilities for animations
export const fadeIn = 'animate-[fadeIn_0.6s_ease-out_forwards]';
export const fadeInUp = 'animate-[fadeInUp_0.6s_ease-out_forwards]';
export const fadeInLeft = 'animate-[fadeInLeft_0.6s_ease-out_forwards]';
export const fadeInRight = 'animate-[fadeInRight_0.6s_ease-out_forwards]';
export const scaleIn = 'animate-[scaleIn_0.4s_ease-out_forwards]';

// Stagger delay helpers
export const stagger = (index, baseDelay = 0.1) => ({
  animationDelay: `${index * baseDelay}s`,
});

// Keyframe definitions (to be added to CSS or via Tailwind)
export const keyframes = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeInLeft {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeInRight {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
`;
